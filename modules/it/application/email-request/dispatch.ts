import type { NotificationOutbox } from "@prisma/client";

import { isSharedDriveOption } from "../../domain/email-request/constants";
import type { EmailRequestData } from "../../domain/email-request/contracts";
import { sendEmailRequestLineNotification } from "../../infrastructure/notifications/email-request-line";
import { createEmailRequestInboxNotifications } from "./notifications";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parseStoredPayload(payload: string): unknown {
    try {
        return JSON.parse(payload) as unknown;
    } catch {
        throw new Error("Invalid EMAIL_REQUEST payload JSON");
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

    return {
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

export type ITEmailRequestOutboxDispatchOutcome = "SENT" | null;

/** Dispatch Email Request meaning while the shared processor retains row lifecycle and retries. */
export async function dispatchITEmailRequestOutbox(
    notification: NotificationOutbox,
    retryKey: string,
): Promise<ITEmailRequestOutboxDispatchOutcome> {
    if (notification.type !== "EMAIL_REQUEST") return null;

    const payload = parseEmailRequestOutboxPayload(
        parseStoredPayload(notification.payload),
    );
    await createEmailRequestInboxNotifications(payload);

    const isSent = await sendEmailRequestLineNotification(payload, retryKey);
    if (!isSent) throw new Error("LINE email request notification failed");

    return "SENT";
}
