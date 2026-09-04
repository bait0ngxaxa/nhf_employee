import type { NotificationOutbox, Prisma } from "@prisma/client";

import { runSerializableTransaction } from "@/lib/db/transaction";
import { prisma } from "@/lib/db/prisma";
import { sendAppLineNotification } from "@/lib/line/app-notification";
import {
    generateLeaveActionFlexMessage,
    generateLeaveCancelledAfterApprovalFlexMessage,
    generateLeaveCancelledFlexMessage,
    generateLeaveCancellationRequestedFlexMessage,
    generateLeaveNotTakenConfirmedFlexMessage,
    generateLeaveNotTakenRequestedFlexMessage,
    generateLeaveResultFlexMessage,
} from "@/modules/leave/infrastructure/notifications/line-flex";
import { buildLeaveLiffRequestUrl } from "@/modules/leave/infrastructure/notifications/links";
import { createLineRetryKey } from "@/lib/services/outbox/provider-key";
import {
    buildLegacyLeaveActionDeliveryIdentity,
    getLeaveActionDeliveryIdentity,
    parseLeaveActionLinePayload,
    parseLeaveCancelledAfterApprovalLinePayload,
    parseLeaveCancelledLinePayload,
    parseLeaveCancellationRequestedLinePayload,
    parseLeaveNotTakenConfirmedLinePayload,
    parseLeaveNotTakenRequestedLinePayload,
    parseLeaveResultLinePayload,
    type LeaveActionLinePayload,
    type LeaveCancelledAfterApprovalLinePayload,
    type LeaveCancelledLinePayload,
    type LeaveCancellationRequestedLinePayload,
    type LeaveNotTakenConfirmedLinePayload,
    type LeaveNotTakenRequestedLinePayload,
    type LeaveResultLinePayload,
    type LeaveActionPayload,
    type LeaveCancelledAfterApprovalPayload,
    type LeaveCancelledPayload,
    type LeaveCancellationRequestedPayload,
    type LeaveNotTakenConfirmedPayload,
    type LeaveNotTakenRequestedPayload,
    type LeaveResultPayload,
} from "@/modules/leave/application/notifications/notification-payloads";
import {
    resolveCurrentLeaveAction,
    resolveCurrentLeaveCancellationAction,
    resolveCurrentLeaveNotTakenAction,
} from "@/modules/leave/application/approvals/current-action-validation";
import { lockLeaveRequestRow } from "@/modules/leave/infrastructure/persistence/transaction";

export const LEAVE_LINE_OUTBOX_TYPES = [
    "LEAVE_ACTION_LINE",
    "LEAVE_RESULT_LINE",
    "LEAVE_CANCELLED_LINE",
    "LEAVE_CANCELLATION_REQUESTED_LINE",
    "LEAVE_CANCELLED_AFTER_APPROVAL_LINE",
    "LEAVE_NOT_TAKEN_REQUESTED_LINE",
    "LEAVE_NOT_TAKEN_CONFIRMED_LINE",
] as const;

export type LeaveLineOutboxType = (typeof LEAVE_LINE_OUTBOX_TYPES)[number];

type LeaveLinePayload =
    | LeaveActionLinePayload
    | LeaveResultLinePayload
    | LeaveCancelledLinePayload
    | LeaveCancellationRequestedLinePayload
    | LeaveCancelledAfterApprovalLinePayload
    | LeaveNotTakenRequestedLinePayload
    | LeaveNotTakenConfirmedLinePayload;

export type LeaveLineEnqueueInput =
    | { type: "LEAVE_ACTION_LINE"; payload: LeaveActionPayload }
    | { type: "LEAVE_RESULT_LINE"; payload: LeaveResultPayload }
    | { type: "LEAVE_CANCELLED_LINE"; payload: LeaveCancelledPayload }
    | {
        type: "LEAVE_CANCELLATION_REQUESTED_LINE";
        payload: LeaveCancellationRequestedPayload;
    }
    | {
        type: "LEAVE_CANCELLED_AFTER_APPROVAL_LINE";
        payload: LeaveCancelledAfterApprovalPayload;
    }
    | {
        type: "LEAVE_NOT_TAKEN_REQUESTED_LINE";
        payload: LeaveNotTakenRequestedPayload;
    }
    | {
        type: "LEAVE_NOT_TAKEN_CONFIRMED_LINE";
        payload: LeaveNotTakenConfirmedPayload;
    };

type LeaveLineDeliveryInput =
    | { type: "LEAVE_ACTION_LINE"; payload: LeaveActionLinePayload }
    | { type: "LEAVE_RESULT_LINE"; payload: LeaveResultLinePayload }
    | { type: "LEAVE_CANCELLED_LINE"; payload: LeaveCancelledLinePayload }
    | {
        type: "LEAVE_CANCELLATION_REQUESTED_LINE";
        payload: LeaveCancellationRequestedLinePayload;
    }
    | {
        type: "LEAVE_CANCELLED_AFTER_APPROVAL_LINE";
        payload: LeaveCancelledAfterApprovalLinePayload;
    }
    | {
        type: "LEAVE_NOT_TAKEN_REQUESTED_LINE";
        payload: LeaveNotTakenRequestedLinePayload;
    }
    | {
        type: "LEAVE_NOT_TAKEN_CONFIRMED_LINE";
        payload: LeaveNotTakenConfirmedLinePayload;
    };

type LeaveLineOutboxClient = Pick<
    Prisma.TransactionClient,
    "notificationOutbox"
>;

export function isLeaveLineOutboxType(
    value: string,
): value is LeaveLineOutboxType {
    return LEAVE_LINE_OUTBOX_TYPES.includes(value as LeaveLineOutboxType);
}

export function buildLeaveLineEventKey(
    type: LeaveLineOutboxType,
    leaveId: string,
    userId: number,
    deliveryIdentity?: string,
): string {
    // The Leave action producer owns the generation encoded in deliveryIdentity.
    // Never rebuild this key from the recipient alone: the same approver can be
    // assigned again in a later generation.
    if (type === "LEAVE_ACTION_LINE") {
        return `leave:${leaveId}:action:${deliveryIdentity
            ?? buildLegacyLeaveActionDeliveryIdentity(leaveId, userId)}:line`;
    }

    return `leave:${leaveId}:${type}:user:${userId}`;
}

function getRecipientUserId(input: LeaveLineEnqueueInput): number | null {
    switch (input.type) {
        case "LEAVE_ACTION_LINE":
        case "LEAVE_CANCELLED_LINE":
        case "LEAVE_CANCELLATION_REQUESTED_LINE":
        case "LEAVE_NOT_TAKEN_REQUESTED_LINE":
            return input.payload.approver.userId;
        case "LEAVE_RESULT_LINE":
        case "LEAVE_CANCELLED_AFTER_APPROVAL_LINE":
        case "LEAVE_NOT_TAKEN_CONFIRMED_LINE":
            return input.payload.employee.userId;
    }
}

export async function enqueueLeaveLineNotification(
    input: LeaveLineEnqueueInput,
    client: LeaveLineOutboxClient = prisma,
): Promise<void> {
    const userId = getRecipientUserId(input);
    if (userId === null) return;

    const deliveryIdentity = input.type === "LEAVE_ACTION_LINE"
        ? getLeaveActionDeliveryIdentity(input.payload)
        : undefined;
    const eventKey = buildLeaveLineEventKey(
        input.type,
        input.payload.leaveId,
        userId,
        deliveryIdentity,
    );
    const payload = input.type === "LEAVE_ACTION_LINE"
        ? {
            ...input.payload,
            deliveryIdentity,
            retryKey: createLineRetryKey(eventKey),
        }
        : {
            ...input.payload,
            retryKey: createLineRetryKey(eventKey),
        };

    await client.notificationOutbox.createMany({
        data: [{
            type: input.type,
            eventKey,
            payload: JSON.stringify(payload),
        }],
        skipDuplicates: true,
    });
}

async function markLeaveLineSuperseded(
    notificationId: number,
    lastError: string,
): Promise<void> {
    await runSerializableTransaction((tx) =>
        tx.notificationOutbox.updateMany({
            where: { id: notificationId, status: "PROCESSING" },
            data: { status: "SUPERSEDED", lastError },
        }),
    );
}

async function markLeaveLineSupersededInTransaction(
    tx: Prisma.TransactionClient,
    notificationId: number,
    lastError: string,
): Promise<void> {
    await tx.notificationOutbox.updateMany({
        where: { id: notificationId, status: "PROCESSING" },
        data: { status: "SUPERSEDED", lastError },
    });
}

function parseLeaveLinePayload(
    type: LeaveLineOutboxType,
    value: unknown,
): LeaveLinePayload | null {
    try {
        switch (type) {
            case "LEAVE_ACTION_LINE":
                return parseLeaveActionLinePayload(value);
            case "LEAVE_RESULT_LINE":
                return parseLeaveResultLinePayload(value);
            case "LEAVE_CANCELLED_LINE":
                return parseLeaveCancelledLinePayload(value);
            case "LEAVE_CANCELLATION_REQUESTED_LINE":
                return parseLeaveCancellationRequestedLinePayload(value);
            case "LEAVE_CANCELLED_AFTER_APPROVAL_LINE":
                return parseLeaveCancelledAfterApprovalLinePayload(value);
            case "LEAVE_NOT_TAKEN_REQUESTED_LINE":
                return parseLeaveNotTakenRequestedLinePayload(value);
            case "LEAVE_NOT_TAKEN_CONFIRMED_LINE":
                return parseLeaveNotTakenConfirmedLinePayload(value);
        }
    } catch {
        return null;
    }
}

function getDeliveryRecipientUserId(input: LeaveLineDeliveryInput): number | null {
    switch (input.type) {
        case "LEAVE_ACTION_LINE":
        case "LEAVE_CANCELLED_LINE":
        case "LEAVE_CANCELLATION_REQUESTED_LINE":
        case "LEAVE_NOT_TAKEN_REQUESTED_LINE":
            return input.payload.approver.userId;
        case "LEAVE_RESULT_LINE":
        case "LEAVE_CANCELLED_AFTER_APPROVAL_LINE":
        case "LEAVE_NOT_TAKEN_CONFIRMED_LINE":
            return input.payload.employee.userId;
    }
}

function buildLeaveLineMessage(input: LeaveLineDeliveryInput) {
    switch (input.type) {
        case "LEAVE_ACTION_LINE":
            return generateLeaveActionFlexMessage(
                input.payload,
                buildLeaveLiffRequestUrl(input.payload.leaveId, { action: "approve" }),
            );
        case "LEAVE_RESULT_LINE":
            return generateLeaveResultFlexMessage(
                input.payload,
                buildLeaveLiffRequestUrl(input.payload.leaveId),
            );
        case "LEAVE_CANCELLED_LINE":
            return generateLeaveCancelledFlexMessage(
                input.payload,
                buildLeaveLiffRequestUrl(input.payload.leaveId, { action: "review" }),
            );
        case "LEAVE_CANCELLATION_REQUESTED_LINE":
            return generateLeaveCancellationRequestedFlexMessage(
                input.payload,
                buildLeaveLiffRequestUrl(input.payload.leaveId, { action: "review" }),
            );
        case "LEAVE_CANCELLED_AFTER_APPROVAL_LINE":
            return generateLeaveCancelledAfterApprovalFlexMessage(
                input.payload,
                buildLeaveLiffRequestUrl(input.payload.leaveId),
            );
        case "LEAVE_NOT_TAKEN_REQUESTED_LINE":
            return generateLeaveNotTakenRequestedFlexMessage(
                input.payload,
                buildLeaveLiffRequestUrl(input.payload.leaveId, { action: "not-taken" }),
            );
        case "LEAVE_NOT_TAKEN_CONFIRMED_LINE":
            return generateLeaveNotTakenConfirmedFlexMessage(
                input.payload,
                buildLeaveLiffRequestUrl(input.payload.leaveId),
            );
    }
}

async function ensureLeaveLineOutboxClaimed(
    notificationId: number,
): Promise<boolean> {
    const claimed = await runSerializableTransaction((tx) =>
        tx.notificationOutbox.findFirst({
            where: { id: notificationId, status: "PROCESSING" },
            select: { id: true },
        }),
    );
    return claimed !== null;
}

type ActionableLeaveLineDeliveryInput =
    | { type: "LEAVE_ACTION_LINE"; payload: LeaveActionLinePayload }
    | {
        type: "LEAVE_CANCELLATION_REQUESTED_LINE";
        payload: LeaveCancellationRequestedLinePayload;
    }
    | {
        type: "LEAVE_NOT_TAKEN_REQUESTED_LINE";
        payload: LeaveNotTakenRequestedLinePayload;
    };

async function resolveCurrentActionableLeaveLinePayload(
    notificationId: number,
    input: ActionableLeaveLineDeliveryInput,
): Promise<ActionableLeaveLineDeliveryInput | null> {
    return runSerializableTransaction(async (tx) => {
        const claimed = await tx.notificationOutbox.findFirst({
            where: { id: notificationId, status: "PROCESSING" },
            select: { id: true },
        });
        if (!claimed) return null;

        await lockLeaveRequestRow(tx, input.payload.leaveId);
        switch (input.type) {
            case "LEAVE_ACTION_LINE": {
                const currentPayload = await resolveCurrentLeaveAction(
                    tx,
                    input.payload,
                );
                if (!currentPayload) break;
                return {
                    type: input.type,
                    payload: {
                        ...currentPayload,
                        retryKey: input.payload.retryKey,
                    },
                };
            }
            case "LEAVE_CANCELLATION_REQUESTED_LINE": {
                const currentPayload = await resolveCurrentLeaveCancellationAction(
                    tx,
                    input.payload,
                );
                if (!currentPayload) break;
                return {
                    type: input.type,
                    payload: {
                        ...currentPayload,
                        retryKey: input.payload.retryKey,
                    },
                };
            }
            case "LEAVE_NOT_TAKEN_REQUESTED_LINE": {
                const currentPayload = await resolveCurrentLeaveNotTakenAction(
                    tx,
                    input.payload,
                );
                if (!currentPayload) break;
                return {
                    type: input.type,
                    payload: {
                        ...currentPayload,
                        retryKey: input.payload.retryKey,
                    },
                };
            }
        }
        const staleError = input.type === "LEAVE_ACTION_LINE"
            ? "Superseded by stale leave-action LINE delivery"
            : `Superseded by stale ${input.type} delivery`;
        await markLeaveLineSupersededInTransaction(
            tx,
            notificationId,
            staleError,
        );
        return null;
    });
}

async function dispatchTypedLeaveLine(
    notification: NotificationOutbox,
    input: LeaveLineDeliveryInput,
): Promise<"SENT" | "SUPERSEDED"> {
    const recipientUserId = getDeliveryRecipientUserId(input);
    if (recipientUserId === null) {
        await markLeaveLineSuperseded(
            notification.id,
            "Superseded Leave LINE delivery without recipient",
        );
        return "SUPERSEDED";
    }

    const expectedEventKey = buildLeaveLineEventKey(
        input.type,
        input.payload.leaveId,
        recipientUserId,
        input.type === "LEAVE_ACTION_LINE"
            ? getLeaveActionDeliveryIdentity(input.payload)
            : undefined,
    );
    if (notification.eventKey !== expectedEventKey) {
        await markLeaveLineSuperseded(
            notification.id,
            "Superseded mismatched Leave LINE event key",
        );
        return "SUPERSEDED";
    }
    if (input.payload.retryKey !== createLineRetryKey(expectedEventKey)) {
        await markLeaveLineSuperseded(
            notification.id,
            "Superseded mismatched Leave LINE retry key",
        );
        return "SUPERSEDED";
    }

    let delivery = input;
    if (
        input.type === "LEAVE_ACTION_LINE"
        || input.type === "LEAVE_CANCELLATION_REQUESTED_LINE"
        || input.type === "LEAVE_NOT_TAKEN_REQUESTED_LINE"
    ) {
        const currentDelivery = await resolveCurrentActionableLeaveLinePayload(
            notification.id,
            input,
        );
        if (!currentDelivery) return "SUPERSEDED";
        delivery = currentDelivery;
    } else if (!(await ensureLeaveLineOutboxClaimed(notification.id))) {
        return "SUPERSEDED";
    }

    const deliveryRecipientUserId = getDeliveryRecipientUserId(delivery);
    if (deliveryRecipientUserId === null) return "SUPERSEDED";

    try {
        const result = await sendAppLineNotification({
            userId: deliveryRecipientUserId,
            message: buildLeaveLineMessage(delivery),
            retryKey: delivery.payload.retryKey,
        });
        if (result.status === "SKIPPED") {
            await markLeaveLineSuperseded(
                notification.id,
                "Superseded Leave LINE delivery for unavailable recipient",
            );
            return "SUPERSEDED";
        }
    } catch {
        throw new Error("Leave LINE notification delivery failed");
    }

    return "SENT";
}

export async function dispatchLeaveLineOutbox(
    notification: NotificationOutbox,
    value: unknown,
): Promise<"SENT" | "SUPERSEDED" | null> {
    if (!isLeaveLineOutboxType(notification.type)) return null;

    const payload = parseLeaveLinePayload(notification.type, value);
    if (!payload) {
        await markLeaveLineSuperseded(
            notification.id,
            "Superseded invalid Leave LINE payload",
        );
        return "SUPERSEDED";
    }

    switch (notification.type) {
        case "LEAVE_ACTION_LINE":
            return dispatchTypedLeaveLine(notification, {
                type: notification.type,
                payload: payload as LeaveActionLinePayload,
            });
        case "LEAVE_RESULT_LINE":
            return dispatchTypedLeaveLine(notification, {
                type: notification.type,
                payload: payload as LeaveResultLinePayload,
            });
        case "LEAVE_CANCELLED_LINE":
            return dispatchTypedLeaveLine(notification, {
                type: notification.type,
                payload: payload as LeaveCancelledLinePayload,
            });
        case "LEAVE_CANCELLATION_REQUESTED_LINE":
            return dispatchTypedLeaveLine(notification, {
                type: notification.type,
                payload: payload as LeaveCancellationRequestedLinePayload,
            });
        case "LEAVE_CANCELLED_AFTER_APPROVAL_LINE":
            return dispatchTypedLeaveLine(notification, {
                type: notification.type,
                payload: payload as LeaveCancelledAfterApprovalLinePayload,
            });
        case "LEAVE_NOT_TAKEN_REQUESTED_LINE":
            return dispatchTypedLeaveLine(notification, {
                type: notification.type,
                payload: payload as LeaveNotTakenRequestedLinePayload,
            });
        case "LEAVE_NOT_TAKEN_CONFIRMED_LINE":
            return dispatchTypedLeaveLine(notification, {
                type: notification.type,
                payload: payload as LeaveNotTakenConfirmedLinePayload,
            });
    }
}
