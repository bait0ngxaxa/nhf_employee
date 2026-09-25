import type { NotificationOutbox, Prisma } from "@prisma/client";

import { getCurrentWorkforceDepartmentSnapshotInTransaction } from "@/modules/employee";
import { createForUserOnce } from "@/modules/notification";
import {
    hasPrismaErrorCode,
    runSerializableTransaction,
} from "@/lib/db/transaction";
import { APP_ROUTES } from "@/lib/ssot/routes";

import { findITOperatorAudience } from "../operator-audience";
import {
    buildITTicketNotificationEventKey,
    parseITTicketNotificationPayload,
    type ITTicketNotificationPayloadV1,
} from "../../domain/ticket-notification";
import {
    findITTicketNotificationCommentSource,
    findITTicketNotificationEventSource,
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

type ITTicketNotificationSource =
    | { readonly kind: "EVENT"; readonly fact: ITTicketNotificationEventSource }
    | { readonly kind: "COMMENT"; readonly fact: ITTicketNotificationCommentSource };

function parseStoredPayload(payload: string): ITTicketNotificationPayloadV1 {
    let parsed: unknown;
    try {
        parsed = JSON.parse(payload) as unknown;
    } catch {
        throw new Error("Invalid IT_TICKET_IN_APP payload JSON");
    }
    return parseITTicketNotificationPayload(parsed);
}

async function loadSource(
    tx: Prisma.TransactionClient,
    payload: ITTicketNotificationPayloadV1,
): Promise<ITTicketNotificationSource> {
    if (payload.source.kind === "EVENT") {
        const fact = await findITTicketNotificationEventSource(tx, payload.source.id);
        if (fact === null) {
            throw new Error("IT_TICKET_IN_APP event source not found");
        }
        return { kind: "EVENT", fact };
    }

    const fact = await findITTicketNotificationCommentSource(tx, payload.source.id);
    if (fact === null) {
        throw new Error("IT_TICKET_IN_APP comment source not found");
    }
    return { kind: "COMMENT", fact };
}

function assertSourceMatchesPayload(
    source: ITTicketNotificationSource,
    payload: ITTicketNotificationPayloadV1,
): number {
    if (source.fact.ticketId !== payload.ticketId) {
        throw new Error("IT_TICKET_IN_APP source Ticket mismatch");
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
            throw new Error("IT_TICKET_IN_APP event source does not match event");
        }
        return fact.actorUserId;
    }

    const expectedKind = payload.event === "OPERATOR_COMMENTED"
        ? "OPERATOR"
        : payload.event === "REQUESTER_COMMENTED"
            ? "REQUESTER"
            : null;
    if (expectedKind === null || source.fact.kind !== expectedKind) {
        throw new Error("IT_TICKET_IN_APP comment source does not match event");
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
    if (payload.event === "WAITING_REQUESTER") {
        return ticket.status === "WAITING_REQUESTER";
    }
    return true;
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

/** Dispatches one IT-owned outbox row and leaves retry lifecycle to the shared processor. */
export async function dispatchITTicketNotificationOutbox(
    notification: NotificationOutbox,
): Promise<ITTicketNotificationDispatchOutcome> {
    if (notification.type !== "IT_TICKET_IN_APP") return null;

    const payload = parseStoredPayload(notification.payload);
    const eventKey = buildITTicketNotificationEventKey(payload);
    if (notification.eventKey !== eventKey) {
        throw new Error("IT_TICKET_IN_APP event identity mismatch");
    }

    try {
        return await runSerializableTransaction(async (tx) => {
            const source = await loadSource(tx, payload);
            const sourceActorUserId = assertSourceMatchesPayload(source, payload);
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
                dedupeKey: eventKey,
            }, tx);
            return "SENT";
        });
    } catch (error) {
        if (hasPrismaErrorCode(error, "P2003")) {
            return "SUPERSEDED";
        }
        throw error;
    }
}
