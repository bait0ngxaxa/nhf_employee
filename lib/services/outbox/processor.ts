import type { NotificationOutbox } from "@prisma/client";
import { lineNotificationService } from "@/lib/line";
import { prisma } from "@/lib/db/prisma";
import { dispatchTicketOutbox } from "@/lib/services/ticket/outbox-dispatch";
import type {
    EmailRequestData,
    StockLowLineData,
    StockRequestLineData,
} from "@/types/api";
import { createEmailRequestInAppNotification } from "@/lib/services/email-request/notifications";
import {
    notifyAdminsLowStockInApp,
    notifyAdminsStockRequestLineInApp,
} from "@/lib/services/stock/notifications";
import {
    parseLeaveActionPayload,
    parseLeaveCancelledPayload,
    parseLeaveNotTakenConfirmedPayload,
    parseLeaveNotTakenRequestedPayload,
    parseLeaveResultPayload,
} from "@/lib/services/leave/notification-payloads";
import { dispatchCurrentLeaveAction } from "@/lib/services/leave/current-action-recipient";
import {
    isSharedDriveOption,
    type SharedDriveOption,
} from "@/constants/email-request";
import {
    MAX_OUTBOX_ATTEMPTS,
    OUTBOX_RETRY_BASE_DELAY_MS,
    OUTBOX_STATUSES,
    STALE_OUTBOX_PROCESSING_MINUTES,
    isOutboxNotificationType,
} from "./types";

const OUTBOX_STATUS_PENDING = OUTBOX_STATUSES[0];
const OUTBOX_STATUS_PROCESSING = OUTBOX_STATUSES[1];
const OUTBOX_STATUS_SENT = OUTBOX_STATUSES[2];
const OUTBOX_STATUS_FAILED = OUTBOX_STATUSES[3];
const OUTBOX_STATUS_DEAD = OUTBOX_STATUSES[4];

type OutboxProcessResult = {
    processed: number;
    failed: number;
};

type DispatchOutcome = "SENT" | "SUPERSEDED";

type StockRequestLinePayload = StockRequestLineData;
type StockLowLinePayload = StockLowLineData;

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

function parseSharedDriveAccess(
    payload: Record<string, unknown>,
): EmailRequestData["sharedDriveAccess"] {
    const value = payload.sharedDriveAccess;

    if (value === undefined || value === null) {
        return [];
    }

    if (
        !Array.isArray(value) ||
        !value.every(
            (item) =>
                typeof item === "string" && isSharedDriveOption(item),
        )
    ) {
        throw new Error("Invalid EMAIL_REQUEST sharedDriveAccess payload");
    }

    return value as SharedDriveOption[];
}

function parseEmailRequestPayload(payload: unknown): EmailRequestData {
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
        needsDocumentSystem:
            typeof payload.needsDocumentSystem === "boolean"
                ? payload.needsDocumentSystem
                : false,
        sharedDriveAccess: parseSharedDriveAccess(payload),
        requestedAt: payload.requestedAt,
    };
}

function parseStockRequestItems(
    items: unknown[],
): StockRequestLinePayload["items"] {
    return items.map((item, index) => {
        if (
            !isRecord(item) ||
            typeof item.name !== "string" ||
            typeof item.quantity !== "number" ||
            typeof item.unit !== "string"
        ) {
            throw new Error(`Invalid STOCK_REQUEST_LINE payload item at index ${index}`);
        }

        return {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            variantLabel:
                typeof item.variantLabel === "string" ? item.variantLabel : undefined,
        };
    });
}

function parseStockLowItems(items: unknown[]): StockLowLinePayload["items"] {
    return items.map((item, index) => {
        if (
            !isRecord(item) ||
            typeof item.itemId !== "number" ||
            typeof item.quantity !== "number" ||
            typeof item.minStock !== "number" ||
            typeof item.unit !== "string"
        ) {
            throw new Error(`Invalid STOCK_LOW_LINE payload item at index ${index}`);
        }

        if ("variantId" in item) {
            if (
                typeof item.variantId !== "number" ||
                typeof item.itemName !== "string" ||
                typeof item.variantSku !== "string" ||
                typeof item.variantLabel !== "string"
            ) {
                throw new Error(`Invalid STOCK_LOW_LINE variant item at index ${index}`);
            }

            return {
                itemId: item.itemId,
                variantId: item.variantId,
                itemName: item.itemName,
                variantSku: item.variantSku,
                variantLabel: item.variantLabel,
                quantity: item.quantity,
                minStock: item.minStock,
                unit: item.unit,
            };
        }

        if (typeof item.name !== "string" || typeof item.sku !== "string") {
            throw new Error(`Invalid STOCK_LOW_LINE aggregate item at index ${index}`);
        }

        return {
            itemId: item.itemId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            minStock: item.minStock,
            unit: item.unit,
        };
    });
}

function parseStockRequestLinePayload(
    payload: unknown,
): StockRequestLinePayload {
    if (
        !isRecord(payload) ||
        typeof payload.requestId !== "number" ||
        typeof payload.projectCode !== "string" ||
        typeof payload.requesterName !== "string" ||
        typeof payload.requestedAt !== "string" ||
        typeof payload.itemCount !== "number" ||
        typeof payload.totalQuantity !== "number" ||
        !Array.isArray(payload.items)
    ) {
        throw new Error("Invalid STOCK_REQUEST_LINE payload");
    }

    return {
        requestId: payload.requestId,
        projectCode: payload.projectCode,
        requesterName: payload.requesterName,
        note: typeof payload.note === "string" ? payload.note : null,
        requestedAt: payload.requestedAt,
        itemCount: payload.itemCount,
        totalQuantity: payload.totalQuantity,
        items: parseStockRequestItems(payload.items),
    };
}

function parseStockLowLinePayload(payload: unknown): StockLowLinePayload {
    if (
        !isRecord(payload) ||
        typeof payload.alertedAt !== "string" ||
        typeof payload.itemCount !== "number" ||
        !Array.isArray(payload.items)
    ) {
        throw new Error("Invalid STOCK_LOW_LINE payload");
    }

    return {
        alertedAt: payload.alertedAt,
        itemCount: payload.itemCount,
        items: parseStockLowItems(payload.items),
    };
}

async function assertLineSent(
    isSent: boolean,
    label: string,
): Promise<void> {
    if (!isSent) {
        throw new Error(`${label} failed`);
    }
}

async function markStaleProcessingRows(): Promise<void> {
    const now = new Date();
    const staleBefore = new Date(
        now.getTime() - STALE_OUTBOX_PROCESSING_MINUTES * 60_000,
    );

    await prisma.notificationOutbox.updateMany({
        where: {
            status: OUTBOX_STATUS_PROCESSING,
            updatedAt: { lt: staleBefore },
            attempts: { gte: MAX_OUTBOX_ATTEMPTS - 1 },
        },
        data: {
            status: OUTBOX_STATUS_DEAD,
            lastError: "Processing timeout",
            attempts: { increment: 1 },
        },
    });

    await prisma.notificationOutbox.updateMany({
        where: {
            status: OUTBOX_STATUS_PROCESSING,
            updatedAt: { lt: staleBefore },
            attempts: { lt: MAX_OUTBOX_ATTEMPTS - 1 },
        },
        data: {
            status: OUTBOX_STATUS_FAILED,
            lastError: "Processing timeout",
            attempts: { increment: 1 },
            nextAttemptAt: new Date(now.getTime() + OUTBOX_RETRY_BASE_DELAY_MS),
        },
    });
}

async function claimNotification(
    notificationId: number,
    now: Date,
): Promise<boolean> {
    const claimed = await prisma.notificationOutbox.updateMany({
        where: {
            id: notificationId,
            status: { in: [OUTBOX_STATUS_PENDING, OUTBOX_STATUS_FAILED] },
            attempts: { lt: MAX_OUTBOX_ATTEMPTS },
            nextAttemptAt: { lte: now },
        },
        data: {
            status: OUTBOX_STATUS_PROCESSING,
        },
    });

    return claimed.count === 1;
}

function getNextAttemptAt(attempts: number, now: Date): Date {
    const exponent = Math.max(0, attempts - 1);
    return new Date(
        now.getTime() + OUTBOX_RETRY_BASE_DELAY_MS * (2 ** exponent),
    );
}

async function dispatchNotification(
    notification: NotificationOutbox,
): Promise<DispatchOutcome> {
    if (!isOutboxNotificationType(notification.type)) {
        throw new Error(`Unknown notification type: ${notification.type}`);
    }

    const payload = parsePayload(notification.payload);
    const ticketOutcome = await dispatchTicketOutbox(notification, payload);
    if (ticketOutcome) return ticketOutcome;

    switch (notification.type) {
        case "EMAIL_REQUEST": {
            const parsedPayload = parseEmailRequestPayload(payload);
            await createEmailRequestInAppNotification(parsedPayload);
            await assertLineSent(
                await lineNotificationService.sendEmailRequestNotification(
                    parsedPayload,
                ),
                "LINE email request notification",
            );
            return "SENT";
        }
        case "LEAVE_ACTION": {
            const parsedLeaveAction = parseLeaveActionPayload(payload);
            return dispatchCurrentLeaveAction(notification.id, parsedLeaveAction);
        }
        case "LEAVE_RESULT": {
            const parsedLeaveResult = parseLeaveResultPayload(payload);
            const { sendLeaveResultNotifications } = await import(
                "../leave/notifications"
            );
            await sendLeaveResultNotifications(parsedLeaveResult);
            return "SENT";
        }
        case "LEAVE_CANCELLED": {
            const parsedLeaveCancelled = parseLeaveCancelledPayload(payload);
            const { sendLeaveCancelledNotifications } = await import(
                "../leave/notifications"
            );
            await sendLeaveCancelledNotifications(parsedLeaveCancelled);
            return "SENT";
        }
        case "LEAVE_NOT_TAKEN_REQUESTED": {
            const parsedNotTaken = parseLeaveNotTakenRequestedPayload(payload);
            const { sendLeaveNotTakenRequestedNotifications } = await import(
                "../leave/notifications"
            );
            await sendLeaveNotTakenRequestedNotifications(parsedNotTaken);
            return "SENT";
        }
        case "LEAVE_NOT_TAKEN_CONFIRMED": {
            const parsedConfirmed = parseLeaveNotTakenConfirmedPayload(payload);
            const { sendLeaveNotTakenConfirmedNotifications } = await import(
                "../leave/notifications"
            );
            await sendLeaveNotTakenConfirmedNotifications(parsedConfirmed);
            return "SENT";
        }
        case "STOCK_REQUEST_LINE": {
            const parsedPayload = parseStockRequestLinePayload(payload);
            await notifyAdminsStockRequestLineInApp(parsedPayload);
            await assertLineSent(
                await lineNotificationService.sendStockRequestNotification(
                    parsedPayload,
                ),
                "LINE stock request notification",
            );
            return "SENT";
        }
        case "STOCK_LOW_LINE": {
            const parsedPayload = parseStockLowLinePayload(payload);
            await notifyAdminsLowStockInApp(parsedPayload);
            await assertLineSent(
                await lineNotificationService.sendStockLowNotification(
                    parsedPayload,
                ),
                "LINE low stock notification",
            );
            return "SENT";
        }
        default:
            throw new Error(`Unhandled notification type: ${notification.type}`);
    }
}

/**
 * ส่ง outbox แบบ at-least-once: side effect ภายนอกอาจสำเร็จก่อน process ล้ม
 * และก่อน mark SENT จึงต้องพึ่ง idempotency ของแต่ละ provider เมื่อ retry.
 */
export async function processOutbox(batchSize = 10): Promise<OutboxProcessResult> {
    await markStaleProcessingRows();
    const now = new Date();

    const candidates = await prisma.notificationOutbox.findMany({
        where: {
            status: { in: [OUTBOX_STATUS_PENDING, OUTBOX_STATUS_FAILED] },
            attempts: { lt: MAX_OUTBOX_ATTEMPTS },
            nextAttemptAt: { lte: now },
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
        const isClaimed = await claimNotification(notification.id, now);
        if (!isClaimed) {
            continue;
        }

        try {
            const outcome = await dispatchNotification(notification);

            await prisma.notificationOutbox.updateMany({
                where: { id: notification.id, status: OUTBOX_STATUS_PROCESSING },
                data: {
                    status: outcome,
                    lastError:
                        outcome === OUTBOX_STATUS_SENT
                            ? null
                            : "Superseded legacy bundled ticket notification",
                },
            });
            processedCount++;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unknown error";
            const nextAttempts = notification.attempts + 1;
            const isTerminal = nextAttempts >= MAX_OUTBOX_ATTEMPTS;

            console.error(
                `Error processing notification ${notification.id}:`,
                error,
            );

            const retryData = isTerminal
                ? {}
                : { nextAttemptAt: getNextAttemptAt(nextAttempts, now) };
            await prisma.notificationOutbox.updateMany({
                where: { id: notification.id, status: OUTBOX_STATUS_PROCESSING },
                data: {
                    status: isTerminal ? OUTBOX_STATUS_DEAD : OUTBOX_STATUS_FAILED,
                    attempts: { increment: 1 },
                    lastError: message,
                    ...retryData,
                },
            });
            failedCount++;
        }
    }

    return { processed: processedCount, failed: failedCount };
}

