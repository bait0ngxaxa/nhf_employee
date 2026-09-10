import type { NotificationOutbox } from "@prisma/client";
import { lineNotificationService } from "@/lib/line";
import { prisma } from "@/lib/db/prisma";
import { createOutboxLineRetryKey } from "./provider-key";
import type { EmailRequestData } from "@/types/api";
import { createEmailRequestInAppNotification } from "@/lib/services/email-request/notifications";
import { dispatchStockOutbox } from "@/modules/stock";
import {
    parseLeaveActionPayload,
    parseLeaveCancellationRequestedPayload,
    parseLeaveCancelledAfterApprovalPayload,
    parseLeaveCancelledPayload,
    parseLeaveNotTakenConfirmedPayload,
    parseLeaveNotTakenRequestedPayload,
    parseLeaveResultPayload,
    dispatchCurrentLeaveAction,
    dispatchLeaveLineOutbox,
    enqueueLeaveLineNotification,
    sendLeaveResultNotifications,
    sendLeaveCancelledNotifications,
    sendLeaveCancellationRequestedNotifications,
    sendLeaveCancelledAfterApprovalNotifications,
    sendLeaveNotTakenRequestedNotifications,
    sendLeaveNotTakenConfirmedNotifications,
} from "@/modules/leave";
import {
    isSharedDriveOption,
    type SharedDriveOption,
} from "@/constants/email-request";
import {
    dispatchRoutineReminderOutbox,
    dispatchRoutineContractExpiryOutbox,
} from "@/modules/routine";
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

type DispatchOutcome = "SENT" | "SUPERSEDED" | "DEFERRED";

type OutboxOperationalEvent =
    | "outbox_provider_attempt"
    | "outbox_retry_scheduled"
    | "outbox_stale_recovered"
    | "outbox_dead_lettered";

type OutboxOperationalMetadata = {
    event: OutboxOperationalEvent;
    outboxId: number | null;
    outboxType: string;
    attempt: number | null;
    nextStatus: string;
    nextAttemptAt: string | null;
    isRetry?: boolean;
};

function emitOutboxOperationalEvent(
    event: OutboxOperationalEvent,
    metadata: Omit<OutboxOperationalMetadata, "event">,
): void {
    console.warn(event, { event, ...metadata });
}

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

    const staleRows = await prisma.notificationOutbox.findMany({
        where: {
            status: OUTBOX_STATUS_PROCESSING,
            updatedAt: { lt: staleBefore },
        },
        select: {
            id: true,
            type: true,
            attempts: true,
        },
    });

    for (const row of staleRows) {
        const nextAttempts = Math.min(
            row.attempts + 1,
            MAX_OUTBOX_ATTEMPTS,
        );
        const isTerminal = row.attempts >= MAX_OUTBOX_ATTEMPTS - 1;
        const nextAttemptAt = isTerminal
            ? null
            : new Date(now.getTime() + OUTBOX_RETRY_BASE_DELAY_MS);
        const recovered = await prisma.notificationOutbox.updateMany({
            where: {
                id: row.id,
                status: OUTBOX_STATUS_PROCESSING,
                updatedAt: { lt: staleBefore },
                attempts: row.attempts,
            },
            data: {
                status: isTerminal ? OUTBOX_STATUS_DEAD : OUTBOX_STATUS_FAILED,
                lastError: "Processing timeout",
                ...(row.attempts < MAX_OUTBOX_ATTEMPTS
                    ? { attempts: { increment: 1 } }
                    : {}),
                ...(nextAttemptAt ? { nextAttemptAt } : {}),
            },
        });
        if (recovered.count !== 1) continue;

        emitOutboxOperationalEvent("outbox_stale_recovered", {
            outboxId: row.id,
            outboxType: row.type,
            attempt: nextAttempts,
            nextStatus: isTerminal ? OUTBOX_STATUS_DEAD : OUTBOX_STATUS_FAILED,
            nextAttemptAt: nextAttemptAt?.toISOString() ?? null,
        });
        if (isTerminal) {
            emitOutboxOperationalEvent("outbox_dead_lettered", {
                outboxId: row.id,
                outboxType: row.type,
                attempt: nextAttempts,
                nextStatus: OUTBOX_STATUS_DEAD,
                nextAttemptAt: null,
            });
        } else {
            emitOutboxOperationalEvent("outbox_retry_scheduled", {
                outboxId: row.id,
                outboxType: row.type,
                attempt: nextAttempts,
                nextStatus: OUTBOX_STATUS_FAILED,
                nextAttemptAt: nextAttemptAt?.toISOString() ?? null,
            });
        }
    }
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

export async function dispatchNotification(
    notification: NotificationOutbox,
): Promise<DispatchOutcome> {
    if (!isOutboxNotificationType(notification.type)) {
        throw new Error(`Unknown notification type: ${notification.type}`);
    }

    const stockOutcome = await dispatchStockOutbox(notification);
    if (stockOutcome) return stockOutcome;

    let payload: unknown;
    try {
        payload = parsePayload(notification.payload);
    } catch (error) {
        const routineOutcome = await dispatchRoutineReminderOutbox(
            notification,
            null,
        );
        if (routineOutcome) return routineOutcome;
        const routineContractOutcome = await dispatchRoutineContractExpiryOutbox(
            notification,
            null,
        );
        if (routineContractOutcome) return routineContractOutcome;
        const leaveLineOutcome = await dispatchLeaveLineOutbox(
            notification,
            null,
        );
        if (leaveLineOutcome) return leaveLineOutcome;
        throw error;
    }
    const routineOutcome = await dispatchRoutineReminderOutbox(
        notification,
        payload,
    );
    if (routineOutcome) return routineOutcome;

    const routineContractOutcome = await dispatchRoutineContractExpiryOutbox(
        notification,
        payload,
    );
    if (routineContractOutcome) return routineContractOutcome;

    const leaveLineOutcome = await dispatchLeaveLineOutbox(
        notification,
        payload,
    );
    if (leaveLineOutcome) return leaveLineOutcome;

    switch (notification.type) {
        case "EMAIL_REQUEST": {
            const parsedPayload = parseEmailRequestPayload(payload);
            await createEmailRequestInAppNotification(parsedPayload);
            await assertLineSent(
                await lineNotificationService.sendEmailRequestNotification(
                    parsedPayload,
                    createOutboxLineRetryKey(
                        notification.type,
                        notification.id,
                        notification.eventKey,
                    ),
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
            await enqueueLeaveLineNotification({
                type: "LEAVE_RESULT_LINE",
                payload: parsedLeaveResult,
            });
            await sendLeaveResultNotifications(parsedLeaveResult);
            return "SENT";
        }
        case "LEAVE_CANCELLED": {
            const parsedLeaveCancelled = parseLeaveCancelledPayload(payload);
            await enqueueLeaveLineNotification({
                type: "LEAVE_CANCELLED_LINE",
                payload: parsedLeaveCancelled,
            });
            await sendLeaveCancelledNotifications(parsedLeaveCancelled);
            return "SENT";
        }
        case "LEAVE_CANCELLATION_REQUESTED": {
            const parsedCancellationRequested = parseLeaveCancellationRequestedPayload(payload);
            await enqueueLeaveLineNotification({
                type: "LEAVE_CANCELLATION_REQUESTED_LINE",
                payload: parsedCancellationRequested,
            });
            await sendLeaveCancellationRequestedNotifications(parsedCancellationRequested);
            return "SENT";
        }
        case "LEAVE_CANCELLED_AFTER_APPROVAL": {
            const parsedCancelledAfterApproval = parseLeaveCancelledAfterApprovalPayload(payload);
            await enqueueLeaveLineNotification({
                type: "LEAVE_CANCELLED_AFTER_APPROVAL_LINE",
                payload: parsedCancelledAfterApproval,
            });
            await sendLeaveCancelledAfterApprovalNotifications(parsedCancelledAfterApproval);
            return "SENT";
        }
        case "LEAVE_NOT_TAKEN_REQUESTED": {
            const parsedNotTaken = parseLeaveNotTakenRequestedPayload(payload);
            await enqueueLeaveLineNotification({
                type: "LEAVE_NOT_TAKEN_REQUESTED_LINE",
                payload: parsedNotTaken,
            });
            await sendLeaveNotTakenRequestedNotifications(parsedNotTaken);
            return "SENT";
        }
        case "LEAVE_NOT_TAKEN_CONFIRMED": {
            const parsedConfirmed = parseLeaveNotTakenConfirmedPayload(payload);
            await enqueueLeaveLineNotification({
                type: "LEAVE_NOT_TAKEN_CONFIRMED_LINE",
                payload: parsedConfirmed,
            });
            await sendLeaveNotTakenConfirmedNotifications(parsedConfirmed);
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

        emitOutboxOperationalEvent("outbox_provider_attempt", {
            outboxId: notification.id,
            outboxType: notification.type,
            attempt: notification.attempts + 1,
            nextStatus: OUTBOX_STATUS_PROCESSING,
            nextAttemptAt: null,
            isRetry: notification.attempts > 0,
        });

        try {
            const outcome = await dispatchNotification(notification);

            if (outcome === "DEFERRED") {
                processedCount++;
                continue;
            }

            await prisma.notificationOutbox.updateMany({
                where: { id: notification.id, status: OUTBOX_STATUS_PROCESSING },
                data: {
                    status: outcome,
                    lastError:
                        outcome === OUTBOX_STATUS_SENT
                            ? null
                            : "Superseded notification",
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

            const nextStatus = isTerminal
                ? OUTBOX_STATUS_DEAD
                : OUTBOX_STATUS_FAILED;
            const nextAttemptAt = isTerminal
                ? null
                : getNextAttemptAt(nextAttempts, now);
            const failureTransition = await prisma.notificationOutbox.updateMany({
                where: { id: notification.id, status: OUTBOX_STATUS_PROCESSING },
                data: {
                    status: nextStatus,
                    attempts: { increment: 1 },
                    lastError: message,
                    ...(nextAttemptAt ? { nextAttemptAt } : {}),
                },
            });
            if (failureTransition.count === 1) {
                if (isTerminal) {
                    emitOutboxOperationalEvent("outbox_dead_lettered", {
                        outboxId: notification.id,
                        outboxType: notification.type,
                        attempt: nextAttempts,
                        nextStatus,
                        nextAttemptAt: null,
                    });
                } else {
                    emitOutboxOperationalEvent("outbox_retry_scheduled", {
                        outboxId: notification.id,
                        outboxType: notification.type,
                        attempt: nextAttempts,
                        nextStatus,
                        nextAttemptAt: nextAttemptAt?.toISOString() ?? null,
                    });
                }
            }
            failedCount++;
        }
    }

    return { processed: processedCount, failed: failedCount };
}

