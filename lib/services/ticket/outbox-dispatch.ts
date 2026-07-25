import type { NotificationOutbox } from "@prisma/client";

import {
    parseTicketCreatedNotificationSnapshot,
} from "@/lib/services/ticket/created-notification-snapshot";
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

function isLegacyTicketCreatedPayload(payload: unknown): boolean {
    return (
        isRecord(payload)
        && typeof payload.ticketId === "number"
        && !("title" in payload)
    );
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

async function dispatchCreated(
    notification: NotificationOutbox,
    payload: unknown,
): Promise<"SENT" | "SUPERSEDED" | null> {
    if (
        notification.type !== "TICKET_CREATED_IN_APP"
        && notification.type !== "TICKET_CREATED_LINE"
        && notification.type !== "TICKET_CREATED_EMAIL_REPORTER"
        && notification.type !== "TICKET_CREATED_EMAIL_IT"
    ) {
        return null;
    }
    if (isLegacyTicketCreatedPayload(payload)) {
        return "SUPERSEDED";
    }
    const eventKey = requireEventKey(notification);
    const snapshot = parseTicketCreatedNotificationSnapshot(payload);

    if (notification.type === "TICKET_CREATED_IN_APP") {
        await sendTicketCreatedInAppNotification(snapshot, eventKey);
    } else if (notification.type === "TICKET_CREATED_LINE") {
        await sendTicketCreatedLineNotification(snapshot, eventKey);
    } else if (notification.type === "TICKET_CREATED_EMAIL_REPORTER") {
        await sendTicketCreatedReporterEmailNotification(snapshot, eventKey);
    } else if (notification.type === "TICKET_CREATED_EMAIL_IT") {
        await sendTicketCreatedITEmailNotification(snapshot, eventKey);
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
