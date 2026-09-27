import type { NotificationOutbox, Prisma } from "@prisma/client";

import { getCurrentWorkforceDepartmentSnapshotInTransaction } from "@/modules/employee";
import { createForUserOnce } from "@/modules/notification";
import { sendAppLineNotification } from "@/lib/line/app-notification";
import {
    hasPrismaErrorCode,
    runSerializableTransaction,
} from "@/lib/db/transaction";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { createLineRetryKey } from "@/lib/services/outbox/provider-key";

import { findITOperatorAudience } from "../operator-audience";
import {
    buildITTicketEmailEventKey,
    buildITTicketLineEventKey,
    buildITTicketNotificationEventKey,
    isITTicketLineNotification,
    parseITTicketNotificationPayload,
    type ITTicketNotificationPayloadV1,
} from "../../domain/ticket-notification";
import {
    buildITTicketLineFlexMessage,
} from "../../infrastructure/notifications/line-flex";
import {
    normalizeITNotificationEmail,
} from "../../infrastructure/notifications/email-recipient";
import {
    sendITTicketEmailNotification,
} from "../../infrastructure/notifications/ticket-email";
import {
    findITTicketNotificationCommentSource,
    findITTicketNotificationEventSource,
    findITTicketNotificationRecipientEmail,
    findITTicketNotificationResource,
    findLatestITTicketAssignmentGeneration,
    findLatestITTicketStatusGeneration,
    type ITTicketNotificationCommentSource,
    type ITTicketNotificationEventSource,
} from "../../infrastructure/persistence/ticket-notification-repository";

export type ITTicketNotificationDispatchOutcome =
    | "SENT"
    | "SUPERSEDED"
    | null;

type ITTicketNotificationOutboxType =
    | "IT_TICKET_IN_APP"
    | "IT_TICKET_LINE"
    | "IT_TICKET_EMAIL";

type ITTicketNotificationSource =
    | { readonly kind: "EVENT"; readonly fact: ITTicketNotificationEventSource }
    | { readonly kind: "COMMENT"; readonly fact: ITTicketNotificationCommentSource };

type ITTicketNotificationValidation =
    | { readonly applicable: false }
    | { readonly applicable: true; readonly recipientEmail?: string | null };

class ITTicketNotificationSourceMismatchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ITTicketNotificationSourceMismatchError";
    }
}

function parseStoredPayload(
    payload: string,
    type: ITTicketNotificationOutboxType,
): ITTicketNotificationPayloadV1 {
    let parsed: unknown;
    try {
        parsed = JSON.parse(payload) as unknown;
    } catch {
        throw new Error(`Invalid ${type} payload JSON`);
    }
    return parseITTicketNotificationPayload(parsed);
}

async function loadSource(
    tx: Prisma.TransactionClient,
    payload: ITTicketNotificationPayloadV1,
    type: ITTicketNotificationOutboxType,
): Promise<ITTicketNotificationSource> {
    if (payload.source.kind === "EVENT") {
        const fact = await findITTicketNotificationEventSource(tx, payload.source.id);
        if (fact === null) {
            throw new ITTicketNotificationSourceMismatchError(
                `${type} event source not found`,
            );
        }
        return { kind: "EVENT", fact };
    }

    const fact = await findITTicketNotificationCommentSource(tx, payload.source.id);
    if (fact === null) {
        throw new ITTicketNotificationSourceMismatchError(
            `${type} comment source not found`,
        );
    }
    return { kind: "COMMENT", fact };
}

function assertSourceMatchesPayload(
    source: ITTicketNotificationSource,
    payload: ITTicketNotificationPayloadV1,
    type: ITTicketNotificationOutboxType,
): number {
    if (source.fact.ticketId !== payload.ticketId) {
        throw new ITTicketNotificationSourceMismatchError(
            `${type} source Ticket mismatch`,
        );
    }

    if (source.kind === "EVENT") {
        const { fact } = source;
        const matches = payload.event === "CREATED"
            ? fact.kind === "CREATED"
            : payload.event === "ASSIGNED"
                ? fact.kind === "ASSIGNED"
                    && fact.toAssigneeUserId === payload.recipientUserId
                : payload.event === "WAITING_REQUESTER"
                    ? fact.kind === "STATUS_CHANGED"
                        && fact.toStatus === "WAITING_REQUESTER"
                    : payload.event === "RESOLVED"
                        ? fact.kind === "STATUS_CHANGED"
                            && fact.toStatus === "RESOLVED"
                        : false;
        if (!matches) {
            throw new ITTicketNotificationSourceMismatchError(
                `${type} event source does not match event`,
            );
        }
        return fact.actorUserId;
    }

    const expectedKind = payload.event === "OPERATOR_COMMENTED"
        ? "OPERATOR"
        : payload.event === "REQUESTER_COMMENTED"
            ? "REQUESTER"
            : null;
    if (expectedKind === null || source.fact.kind !== expectedKind) {
        throw new ITTicketNotificationSourceMismatchError(
            `${type} comment source does not match event`,
        );
    }
    return source.fact.authorUserId;
}

async function isCurrentlyApplicable(
    tx: Prisma.TransactionClient,
    payload: ITTicketNotificationPayloadV1,
    sourceActorUserId: number,
): Promise<boolean> {
    if (sourceActorUserId === payload.recipientUserId) return false;

    const ticket = await findITTicketNotificationResource(tx, payload.ticketId);
    if (ticket === null) return false;

    if (payload.audience === "REQUESTER") {
        if (ticket.requesterUserId !== payload.recipientUserId) return false;
        if (payload.event === "WAITING_REQUESTER") {
            if (ticket.status !== "WAITING_REQUESTER" || payload.source.kind !== "EVENT") {
                return false;
            }
            const latestStatusGeneration =
                await findLatestITTicketStatusGeneration(tx, payload.ticketId);
            if (latestStatusGeneration?.id !== payload.source.id) return false;
        }
        return (await getCurrentWorkforceDepartmentSnapshotInTransaction(
            tx,
            payload.recipientUserId,
        )) !== null;
    }

    const operatorIsEligible = (await findITOperatorAudience(tx)).some(
        (operator) => operator.userId === payload.recipientUserId,
    );
    if (!operatorIsEligible) return false;

    if (payload.event === "ASSIGNED") {
        if (payload.source.kind !== "EVENT") return false;
        const latestAssignmentGeneration =
            await findLatestITTicketAssignmentGeneration(tx, payload.ticketId);
        return ticket.assignedToUserId === payload.recipientUserId
            && latestAssignmentGeneration?.id === payload.source.id;
    }
    if (payload.event === "REQUESTER_COMMENTED") {
        return payload.audience === "ASSIGNEE"
            ? ticket.assignedToUserId === payload.recipientUserId
            : ticket.assignedToUserId === null;
    }
    return true;
}

async function validateNotification(
    notification: NotificationOutbox,
    payload: ITTicketNotificationPayloadV1,
): Promise<ITTicketNotificationValidation> {
    const type = notification.type as ITTicketNotificationOutboxType;
    try {
        return await runSerializableTransaction(async (tx) => {
            const source = await loadSource(tx, payload, type);
            const sourceActorUserId = assertSourceMatchesPayload(source, payload, type);
            if (!(await isCurrentlyApplicable(tx, payload, sourceActorUserId))) {
                return { applicable: false };
            }

            if (type === "IT_TICKET_EMAIL") {
                const storedEmail = await findITTicketNotificationRecipientEmail(
                    tx,
                    payload.recipientUserId,
                );
                return {
                    applicable: true,
                    recipientEmail: normalizeITNotificationEmail(storedEmail),
                };
            }

            return { applicable: true };
        });
    } catch (error) {
        if (error instanceof ITTicketNotificationSourceMismatchError) {
            return { applicable: false };
        }
        throw error;
    }
}

function composeInboxContent(
    payload: ITTicketNotificationPayloadV1,
): { readonly title: string; readonly message: string; readonly actionUrl: string } {
    const requesterPath = `${APP_ROUTES.dashboardIT}/${payload.ticketId}`;
    const operatorPath = `${APP_ROUTES.dashboardITQueue}/${payload.ticketId}`;
    const actionUrl = payload.audience === "REQUESTER"
        ? requesterPath
        : operatorPath;
    const ticketLabel = `Ticket IT #${payload.ticketId}`;

    switch (payload.event) {
        case "CREATED":
            return {
                title: "มีคำขอ IT ใหม่",
                message: `${ticketLabel} รอรับเรื่องในคิว IT`,
                actionUrl,
            };
        case "ASSIGNED":
            return {
                title: "คุณได้รับมอบหมาย Ticket IT",
                message: `${ticketLabel} อยู่ในความรับผิดชอบของคุณ`,
                actionUrl,
            };
        case "OPERATOR_COMMENTED":
            return {
                title: "IT ตอบกลับคำขอของคุณ",
                message: `${ticketLabel} มีข้อความตอบกลับใหม่`,
                actionUrl,
            };
        case "REQUESTER_COMMENTED":
            return {
                title: "ผู้ขอส่งข้อความใหม่ใน Ticket IT",
                message: `${ticketLabel} มีข้อความจากผู้ขอ`,
                actionUrl,
            };
        case "WAITING_REQUESTER":
            return {
                title: "IT ต้องการข้อมูลเพิ่มเติม",
                message: `${ticketLabel} รอข้อมูลเพิ่มเติมจากคุณ`,
                actionUrl,
            };
        case "RESOLVED":
            return {
                title: "คำขอ IT ได้รับการแก้ไขแล้ว",
                message: `${ticketLabel} ได้รับการแก้ไขแล้ว`,
                actionUrl,
            };
    }
}

/** Dispatches one IT-owned channel row; shared processor owns retry lifecycle. */
export async function dispatchITTicketNotificationOutbox(
    notification: NotificationOutbox,
): Promise<ITTicketNotificationDispatchOutcome> {
    if (
        notification.type !== "IT_TICKET_IN_APP"
        && notification.type !== "IT_TICKET_LINE"
        && notification.type !== "IT_TICKET_EMAIL"
    ) return null;

    const type = notification.type;
    const payload = parseStoredPayload(notification.payload, type);
    const expectedEventKey = type === "IT_TICKET_LINE"
        ? buildITTicketLineEventKey(payload)
        : type === "IT_TICKET_EMAIL"
            ? buildITTicketEmailEventKey(payload)
            : buildITTicketNotificationEventKey(payload);
    if (notification.eventKey !== expectedEventKey) {
        throw new Error(`${type} event identity mismatch`);
    }

    if (type === "IT_TICKET_IN_APP") {
        try {
            return await runSerializableTransaction(async (tx) => {
                const source = await loadSource(tx, payload, type);
                const sourceActorUserId = assertSourceMatchesPayload(source, payload, type);
                if (!(await isCurrentlyApplicable(tx, payload, sourceActorUserId))) {
                    return "SUPERSEDED";
                }

                const inbox = composeInboxContent(payload);
                await createForUserOnce({
                    userId: payload.recipientUserId,
                    type: "IT_TICKET",
                    title: inbox.title,
                    message: inbox.message,
                    actionUrl: inbox.actionUrl,
                    referenceId: String(payload.ticketId),
                    dedupeKey: expectedEventKey,
                }, tx);
                return "SENT";
            });
        } catch (error) {
            if (hasPrismaErrorCode(error, "P2003")) {
                return "SUPERSEDED";
            }
            if (error instanceof ITTicketNotificationSourceMismatchError) {
                return "SUPERSEDED";
            }
            throw error;
        }
    }

    if (type === "IT_TICKET_LINE") {
        if (!isITTicketLineNotification(payload)) return "SUPERSEDED";
        const validation = await validateNotification(notification, payload);
        if (!validation.applicable) return "SUPERSEDED";

        const message = buildITTicketLineFlexMessage(payload);

        const result = await sendAppLineNotification({
            userId: payload.recipientUserId,
            message,
            retryKey: createLineRetryKey(expectedEventKey),
        });
        return result.status === "SENT" ? "SENT" : "SUPERSEDED";
    }

    const validation = await validateNotification(notification, payload);
    if (!validation.applicable || !validation.recipientEmail) {
        return "SUPERSEDED";
    }

    const isSent = await sendITTicketEmailNotification(
        payload,
        validation.recipientEmail,
        expectedEventKey,
    );
    if (!isSent) throw new Error("IT Ticket Email notification failed");
    return "SENT";
}
