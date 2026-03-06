import type { NotificationOutbox } from "@prisma/client";
import { lineNotificationService } from "@/lib/line";
import { prisma } from "@/lib/prisma";
import { TICKET_WITH_USERS_INCLUDE } from "@/lib/services/ticket/constants";
import {
    sendTicketCreatedNotifications,
    sendTicketUpdatedNotifications,
} from "@/lib/services/ticket/notifications";
import type { TicketWithRelations } from "@/lib/services/ticket/types";
import {
    MAX_OUTBOX_ATTEMPTS,
    OUTBOX_STATUSES,
    STALE_OUTBOX_PROCESSING_MINUTES,
    isOutboxNotificationType,
} from "./types";

const OUTBOX_STATUS_PENDING = OUTBOX_STATUSES[0];
const OUTBOX_STATUS_PROCESSING = OUTBOX_STATUSES[1];
const OUTBOX_STATUS_SENT = OUTBOX_STATUSES[2];
const OUTBOX_STATUS_FAILED = OUTBOX_STATUSES[3];

type OutboxProcessResult = {
    processed: number;
    failed: number;
};

type TicketCreatedPayload = {
    ticketId: number;
};

type TicketUpdatedPayload = {
    ticketId: number;
    oldStatus: string;
};

type EmailRequestPayload = {
    thaiName: string;
    englishName: string;
    phone: string;
    nickname: string;
    position: string;
    department: string;
    replyEmail: string;
    requestedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parsePayload(payload: string): unknown {
    try {
        return JSON.parse(payload) as unknown;
    } catch {
        throw new Error("Invalid payload JSON");
    }
}

function parseTicketCreatedPayload(payload: unknown): TicketCreatedPayload {
    if (!isRecord(payload) || typeof payload.ticketId !== "number") {
        throw new Error("Invalid TICKET_CREATED payload");
    }

    return { ticketId: payload.ticketId };
}

function parseTicketUpdatedPayload(payload: unknown): TicketUpdatedPayload {
    if (
        !isRecord(payload) ||
        typeof payload.ticketId !== "number" ||
        typeof payload.oldStatus !== "string"
    ) {
        throw new Error("Invalid TICKET_UPDATED payload");
    }

    return {
        ticketId: payload.ticketId,
        oldStatus: payload.oldStatus,
    };
}

function parseEmailRequestPayload(payload: unknown): EmailRequestPayload {
    if (
        !isRecord(payload) ||
        typeof payload.thaiName !== "string" ||
        typeof payload.englishName !== "string" ||
        typeof payload.phone !== "string" ||
        typeof payload.position !== "string" ||
        typeof payload.department !== "string" ||
        typeof payload.replyEmail !== "string" ||
        typeof payload.requestedAt !== "string"
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
        requestedAt: payload.requestedAt,
    };
}

async function markStaleProcessingRows(): Promise<void> {
    const staleBefore = new Date(
        Date.now() - STALE_OUTBOX_PROCESSING_MINUTES * 60_000,
    );

    await prisma.notificationOutbox.updateMany({
        where: {
            status: OUTBOX_STATUS_PROCESSING,
            updatedAt: { lt: staleBefore },
            attempts: { lt: MAX_OUTBOX_ATTEMPTS },
        },
        data: {
            status: OUTBOX_STATUS_FAILED,
            error: "Processing timeout",
            attempts: { increment: 1 },
        },
    });
}

async function claimNotification(notificationId: number): Promise<boolean> {
    const claimed = await prisma.notificationOutbox.updateMany({
        where: {
            id: notificationId,
            status: { in: [OUTBOX_STATUS_PENDING, OUTBOX_STATUS_FAILED] },
        },
        data: {
            status: OUTBOX_STATUS_PROCESSING,
        },
    });

    return claimed.count === 1;
}

async function getTicketById(ticketId: number): Promise<TicketWithRelations> {
    const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: TICKET_WITH_USERS_INCLUDE,
    });

    if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
    }

    return ticket as TicketWithRelations;
}

async function dispatchNotification(notification: NotificationOutbox): Promise<void> {
    if (!isOutboxNotificationType(notification.type)) {
        throw new Error(`Unknown notification type: ${notification.type}`);
    }

    const payload = parsePayload(notification.payload);

    switch (notification.type) {
        case "TICKET_CREATED": {
            const parsedPayload = parseTicketCreatedPayload(payload);
            const ticket = await getTicketById(parsedPayload.ticketId);
            await sendTicketCreatedNotifications(ticket);
            return;
        }
        case "TICKET_UPDATED": {
            const parsedPayload = parseTicketUpdatedPayload(payload);
            const ticket = await getTicketById(parsedPayload.ticketId);
            await sendTicketUpdatedNotifications(ticket, parsedPayload.oldStatus);
            return;
        }
        case "EMAIL_REQUEST": {
            const parsedPayload = parseEmailRequestPayload(payload);
            await lineNotificationService.sendEmailRequestNotification(parsedPayload);
            return;
        }
    }
}

/**
 * Process pending notifications in the outbox.
 */
export async function processOutbox(batchSize = 10): Promise<OutboxProcessResult> {
    await markStaleProcessingRows();

    const candidates = await prisma.notificationOutbox.findMany({
        where: {
            status: { in: [OUTBOX_STATUS_PENDING, OUTBOX_STATUS_FAILED] },
            attempts: { lt: MAX_OUTBOX_ATTEMPTS },
        },
        take: batchSize,
        orderBy: { createdAt: "asc" },
    });

    if (candidates.length === 0) {
        return { processed: 0, failed: 0 };
    }

    let processedCount = 0;
    let failedCount = 0;

    for (const notification of candidates) {
        const isClaimed = await claimNotification(notification.id);
        if (!isClaimed) {
            continue;
        }

        try {
            await dispatchNotification(notification);

            await prisma.notificationOutbox.updateMany({
                where: { id: notification.id, status: OUTBOX_STATUS_PROCESSING },
                data: {
                    status: OUTBOX_STATUS_SENT,
                    error: null,
                },
            });
            processedCount++;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unknown error";

            console.error(
                `Error processing notification ${notification.id}:`,
                error,
            );

            await prisma.notificationOutbox.updateMany({
                where: { id: notification.id, status: OUTBOX_STATUS_PROCESSING },
                data: {
                    status: OUTBOX_STATUS_FAILED,
                    attempts: { increment: 1 },
                    error: message,
                },
            });
            failedCount++;
        }
    }

    return { processed: processedCount, failed: failedCount };
}

