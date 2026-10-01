import type { NotificationOutbox, Prisma } from "@prisma/client";
import { z } from "zod";

import { findActiveUsersWithConfiguredCapabilityScope } from "@/modules/authorization";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { createLineRetryKey } from "@/lib/services/outbox/provider-key";

import { isSharedDriveOption } from "../../domain/email-request/constants";
import type {
    EmailRequestChannelOutboxPayloadV1,
    EmailRequestData,
} from "../../domain/email-request/contracts";
import {
    sendEmailRequestEmailNotification,
} from "../../infrastructure/notifications/email-request-email";
import {
    sendEmailRequestLineNotification,
} from "../../infrastructure/notifications/email-request-line";
import {
    normalizeITNotificationEmail,
} from "../../infrastructure/notifications/email-recipient";
import {
    findITTicketNotificationRecipientEmail,
} from "../../infrastructure/persistence/ticket-notification-repository";
import {
    findEmailRequestNotificationSource,
} from "../../infrastructure/persistence/email-request-repository";
import {
    buildEmailRequestEmailEventKey,
    buildEmailRequestLineEventKey,
    enqueueEmailRequestNotificationChannels,
} from "./notifications";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parseStoredPayload(payload: string, type: string): unknown {
    try {
        return JSON.parse(payload) as unknown;
    } catch {
        throw new Error(`Invalid ${type} payload JSON`);
    }
}

function parseSharedDriveAccess(payload: Record<string, unknown>): EmailRequestData["sharedDriveAccess"] {
    const value = payload.sharedDriveAccess;
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || !value.every(
        (item) => typeof item === "string" && isSharedDriveOption(item),
    )) {
        throw new Error("Invalid EMAIL_REQUEST sharedDriveAccess payload");
    }
    return [...value];
}

export function parseEmailRequestOutboxPayload(payload: unknown): EmailRequestData {
    if (
        !isRecord(payload)
        || typeof payload.thaiName !== "string"
        || typeof payload.englishName !== "string"
        || typeof payload.phone !== "string"
        || typeof payload.position !== "string"
        || typeof payload.department !== "string"
        || typeof payload.replyEmail !== "string"
        || typeof payload.requestedAt !== "string"
    ) {
        throw new Error("Invalid EMAIL_REQUEST payload");
    }

    if (payload.emailRequestId !== undefined
        && (typeof payload.emailRequestId !== "number"
            || !Number.isInteger(payload.emailRequestId)
            || payload.emailRequestId <= 0
            || payload.emailRequestId > 2_147_483_647)) {
        throw new Error("Invalid EMAIL_REQUEST id");
    }

    return {
        ...(typeof payload.emailRequestId === "number"
            ? { emailRequestId: payload.emailRequestId }
            : {}),
        thaiName: payload.thaiName,
        englishName: payload.englishName,
        phone: payload.phone,
        nickname: typeof payload.nickname === "string" ? payload.nickname : "",
        position: payload.position,
        department: payload.department,
        replyEmail: payload.replyEmail,
        needsDocumentSystem: typeof payload.needsDocumentSystem === "boolean"
            ? payload.needsDocumentSystem
            : false,
        sharedDriveAccess: parseSharedDriveAccess(payload),
        requestedAt: payload.requestedAt,
    };
}

const positiveIdSchema = z.number().int().positive().max(2_147_483_647);
const emailRequestChannelPayloadSchema = z.object({
    version: z.literal(1),
    accessVersion: z.number().int().min(2).max(2_147_483_647).optional(),
    emailRequestId: positiveIdSchema.nullable(),
    parentOutboxId: positiveIdSchema,
    recipientUserId: positiveIdSchema,
}).strict();

function parseEmailRequestChannelPayload(
    payload: unknown,
    type: "EMAIL_REQUEST_EMAIL" | "EMAIL_REQUEST_LINE",
): EmailRequestChannelOutboxPayloadV1 {
    const parsed = emailRequestChannelPayloadSchema.safeParse(payload);
    if (!parsed.success) throw new Error(`Invalid ${type} payload`);
    return parsed.data;
}

function resolveEmailRequestId(
    notification: NotificationOutbox,
    payload: EmailRequestData,
): number | null {
    const sourceId = notification.eventKey?.match(/^email-request:(\d+):created$/)?.[1];
    const eventKeyId = sourceId === undefined ? null : Number(sourceId);
    if (eventKeyId !== null && !positiveIdSchema.safeParse(eventKeyId).success) {
        throw new Error("Invalid EMAIL_REQUEST event identity");
    }
    if (
        payload.emailRequestId !== undefined
        && eventKeyId !== null
        && payload.emailRequestId !== eventKeyId
    ) {
        throw new Error("EMAIL_REQUEST event identity mismatch");
    }
    return payload.emailRequestId ?? eventKeyId;
}

type ChildValidationResult =
    | { readonly applicable: false }
    | { readonly applicable: true; readonly recipientEmail?: string | null };

async function validateEmailRequestRecipient(
    tx: Prisma.TransactionClient,
    payload: EmailRequestChannelOutboxPayloadV1,
    isEmail: boolean,
): Promise<ChildValidationResult> {
    if (payload.emailRequestId !== null) {
        const source = await findEmailRequestNotificationSource(
            tx,
            payload.emailRequestId,
        );
        if (source === null) return { applicable: false };
    }

    const recipients = await findActiveUsersWithConfiguredCapabilityScope({
        capability: "email.request.read",
        scope: "ALL",
    }, tx);
    if (!recipients.includes(payload.recipientUserId)) {
        return { applicable: false };
    }

    if (!isEmail) return { applicable: true };

    const storedEmail = await findITTicketNotificationRecipientEmail(
        tx,
        payload.recipientUserId,
    );
    return {
        applicable: true,
        recipientEmail: normalizeITNotificationEmail(storedEmail),
    };
}

export type ITEmailRequestOutboxDispatchOutcome = "SENT" | "SUPERSEDED" | null;

/** Handles Email Request parent fan-out and independent per-recipient channel rows. */
export async function dispatchITEmailRequestOutbox(
    notification: NotificationOutbox,
): Promise<ITEmailRequestOutboxDispatchOutcome> {
    if (notification.type === "EMAIL_REQUEST_ACCESS_UPDATED") {
        const payload = z.object({ version: z.literal(1), emailRequestId: positiveIdSchema,
            accessVersion: z.number().int().min(2).max(2_147_483_647) }).strict()
            .parse(parseStoredPayload(notification.payload, notification.type));
        if (notification.eventKey !== `email-request:${payload.emailRequestId}:access:${payload.accessVersion}`) {
            throw new Error("EMAIL_REQUEST_ACCESS_UPDATED event identity mismatch");
        }
        await enqueueEmailRequestNotificationChannels(payload.emailRequestId, notification.id, payload);
        return "SENT";
    }
    if (notification.type === "EMAIL_REQUEST") {
        const payload = parseEmailRequestOutboxPayload(
            parseStoredPayload(notification.payload, notification.type),
        );
        const emailRequestId = resolveEmailRequestId(notification, payload);
        await enqueueEmailRequestNotificationChannels(
            emailRequestId,
            notification.id,
            payload,
        );
        return "SENT";
    }

    if (
        notification.type !== "EMAIL_REQUEST_EMAIL"
        && notification.type !== "EMAIL_REQUEST_LINE"
    ) return null;

    const type = notification.type;
    const payload = parseEmailRequestChannelPayload(
        parseStoredPayload(notification.payload, type),
        type,
    );
    const expectedEventKey = type === "EMAIL_REQUEST_EMAIL"
        ? buildEmailRequestEmailEventKey(
            payload.emailRequestId,
            payload.parentOutboxId,
            payload.recipientUserId,
            payload.accessVersion,
        )
        : buildEmailRequestLineEventKey(
            payload.emailRequestId,
            payload.parentOutboxId,
            payload.recipientUserId,
            payload.accessVersion,
        );
    if (notification.eventKey !== expectedEventKey) {
        throw new Error(`${type} event identity mismatch`);
    }

    const isEmail = type === "EMAIL_REQUEST_EMAIL";
    const validation = await runSerializableTransaction((tx) =>
        validateEmailRequestRecipient(tx, payload, isEmail),
    );
    if (!validation.applicable) return "SUPERSEDED";

    if (isEmail) {
        if (!validation.recipientEmail) return "SUPERSEDED";
        const sent = await sendEmailRequestEmailNotification(
            payload.emailRequestId,
            validation.recipientEmail,
            payload.recipientUserId,
            payload.parentOutboxId,
            payload.accessVersion,
        );
        if (!sent) throw new Error("Email Request Email notification failed");
        return "SENT";
    }

    const result = await sendEmailRequestLineNotification({
        userId: payload.recipientUserId,
        emailRequestId: payload.emailRequestId,
        retryKey: createLineRetryKey(expectedEventKey),
        ...(payload.accessVersion === undefined ? {} : { accessVersion: payload.accessVersion }),
    });
    return result.status === "SENT" ? "SENT" : "SUPERSEDED";
}
