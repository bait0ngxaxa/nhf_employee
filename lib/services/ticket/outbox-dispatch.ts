import type { NotificationOutbox } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { TICKET_WITH_USERS_INCLUDE } from "@/lib/services/ticket/constants";
import {
    sendTicketCommentInAppNotification,
    sendTicketCreatedITEmailNotification,
    sendTicketCreatedInAppNotification,
    sendTicketCreatedLineNotification,
    sendTicketCreatedReporterEmailNotification,
    sendTicketUpdatedInAppNotification,
    sendTicketUpdatedLineNotification,
    sendTicketUpdatedReporterEmailNotification,
    type TicketCommentNotificationData,
} from "@/lib/services/ticket/notifications";
import type { TicketWithRelations } from "@/lib/services/ticket/types";
import {
    parseTicketUpdatedNotificationSnapshot,
} from "@/lib/services/ticket/update-notification-snapshot";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function requireEventKey(notification: NotificationOutbox): string {
    if (!notification.eventKey) {
        throw new Error(`Missing event key for ${notification.type}`);
    }
    return notification.eventKey;
}

function parseTicketId(payload: unknown, type: string): number {
    if (!isRecord(payload) || typeof payload.ticketId !== "number") {
        throw new Error(`Invalid ${type} payload`);
    }
    return payload.ticketId;
}

function isLegacyTicketUpdatedPayload(payload: unknown): boolean {
    return (
        isRecord(payload)
        && typeof payload.ticketId === "number"
        && typeof payload.oldStatus === "string"
        && !("newStatus" in payload)
    );
}

function parseTicketCommentPayload(
    payload: unknown,
): TicketCommentNotificationData {
    if (
        !isRecord(payload)
        || typeof payload.ticketId !== "number"
        || typeof payload.commentId !== "number"
        || typeof payload.recipientId !== "number"
        || typeof payload.authorId !== "number"
        || typeof payload.authorName !== "string"
        || typeof payload.ticketTitle !== "string"
        || typeof payload.authorIsOwner !== "boolean"
    ) {
        throw new Error("Invalid TICKET_COMMENT_IN_APP payload");
    }
    return {
        ticketId: payload.ticketId,
        commentId: payload.commentId,
        recipientId: payload.recipientId,
        authorId: payload.authorId,
        authorName: payload.authorName,
        ticketTitle: payload.ticketTitle,
        authorIsOwner: payload.authorIsOwner,
    };
}

async function getTicket(ticketId: number): Promise<TicketWithRelations> {
    const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId, deletedAt: null },
        include: TICKET_WITH_USERS_INCLUDE,
    });
    if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);
    return ticket as TicketWithRelations;
}

async function dispatchCreated(
    notification: NotificationOutbox,
    payload: unknown,
): Promise<"SENT" | null> {
    if (
        notification.type !== "TICKET_CREATED_IN_APP"
        && notification.type !== "TICKET_CREATED_LINE"
        && notification.type !== "TICKET_CREATED_EMAIL_REPORTER"
        && notification.type !== "TICKET_CREATED_EMAIL_IT"
    ) {
        return null;
    }
    const eventKey = requireEventKey(notification);
    const ticket = await getTicket(
        parseTicketId(payload, notification.type),
    );

    if (notification.type === "TICKET_CREATED_IN_APP") {
        await sendTicketCreatedInAppNotification(ticket, eventKey);
    } else if (notification.type === "TICKET_CREATED_LINE") {
        await sendTicketCreatedLineNotification(ticket, eventKey);
    } else if (notification.type === "TICKET_CREATED_EMAIL_REPORTER") {
        await sendTicketCreatedReporterEmailNotification(ticket, eventKey);
    } else if (notification.type === "TICKET_CREATED_EMAIL_IT") {
        await sendTicketCreatedITEmailNotification(ticket, eventKey);
    } else {
        return null;
    }
    return "SENT";
}

async function dispatchUpdated(
    notification: NotificationOutbox,
    payload: unknown,
): Promise<"SENT" | "SUPERSEDED" | null> {
    if (
        notification.type !== "TICKET_UPDATED_IN_APP_REPORTER"
        && notification.type !== "TICKET_UPDATED_EMAIL_REPORTER"
        && notification.type !== "TICKET_UPDATED_LINE"
    ) {
        return null;
    }
    if (isLegacyTicketUpdatedPayload(payload)) {
        return "SUPERSEDED";
    }
    const snapshot = parseTicketUpdatedNotificationSnapshot(payload);
    const eventKey = requireEventKey(notification);

    if (notification.type === "TICKET_UPDATED_IN_APP_REPORTER") {
        await sendTicketUpdatedInAppNotification(snapshot, eventKey);
    } else if (notification.type === "TICKET_UPDATED_EMAIL_REPORTER") {
        await sendTicketUpdatedReporterEmailNotification(
            snapshot,
            eventKey,
        );
    } else if (notification.type === "TICKET_UPDATED_LINE") {
        await sendTicketUpdatedLineNotification(snapshot, eventKey);
    } else {
        return null;
    }
    return "SENT";
}

export async function dispatchTicketOutbox(
    notification: NotificationOutbox,
    payload: unknown,
): Promise<"SENT" | "SUPERSEDED" | null> {
    if (
        notification.type === "TICKET_CREATED"
        || notification.type === "TICKET_UPDATED"
    ) {
        return "SUPERSEDED";
    }

    const createdOutcome = await dispatchCreated(notification, payload);
    if (createdOutcome) return createdOutcome;
    const updatedOutcome = await dispatchUpdated(notification, payload);
    if (updatedOutcome) return updatedOutcome;
    if (notification.type !== "TICKET_COMMENT_IN_APP") return null;

    await sendTicketCommentInAppNotification(
        parseTicketCommentPayload(payload),
        requireEventKey(notification),
    );
    return "SENT";
}
