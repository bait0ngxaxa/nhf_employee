import { LEAVE_NOTIFICATION_TITLES } from "../../domain/notification-content";
import type { NotificationType, Prisma } from "@prisma/client";

import {
    sendLeaveActionNotification,
    sendLeaveCancelledAfterApprovalNotification,
    sendLeaveCancelledNotification,
    sendLeaveCancellationRequestedNotification,
    sendLeaveNotTakenConfirmedNotification,
    sendLeaveNotTakenRequestedNotification,
    sendLeaveResultNotification,
} from "@/modules/leave/infrastructure/notifications/email";
import { prisma } from "@/lib/db/prisma";
import {
    APP_DASHBOARD_TABS,
    toDashboardMenuPath,
} from "@/lib/ssot/routes";
import {
    formatLeaveDecisionActor,
    formatLeaveFlagSummary,
    formatLeaveSummary,
    getLeaveTypeLabel,
} from "@/modules/leave/application/notifications/notification-format";
import type {
    LeaveActionPayload,
    LeaveCancelledAfterApprovalPayload,
    LeaveCancelledPayload,
    LeaveCancellationRequestedPayload,
    LeaveNotTakenConfirmedPayload,
    LeaveNotTakenRequestedPayload,
    LeaveNotificationPayload,
    LeaveResultPayload,
} from "@/modules/leave/application/notifications/notification-payloads";
import { getPublicOrigin } from "@/lib/network/public-url";
import {
    createForUserOnce,
    type NotificationPersistenceContext,
} from "@/modules/notification";

type LeaveNotificationInput = {
    userId: number | null;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl: string;
    referenceId: string;
};

type NotificationClient = NotificationPersistenceContext;

async function assertEmailSent(
    isSent: boolean,
    label: string,
): Promise<void> {
    if (!isSent) {
        throw new Error(`${label} email notification failed`);
    }
}

function buildDedupeKey(input: LeaveNotificationInput): string {
    return `leave:${input.userId}:${input.type}:${input.referenceId}`;
}

async function createNotificationOnceWithClient(
    client: NotificationClient,
    input: LeaveNotificationInput,
): Promise<void> {
    if (!input.userId) {
        return;
    }

    const { userId, ...data } = input;
    await createForUserOnce({
        ...data,
        userId,
        dedupeKey: buildDedupeKey(input),
    }, client);
}

async function createNotificationOnce(input: LeaveNotificationInput): Promise<void> {
    await createNotificationOnceWithClient(prisma, input);
}

function getAbsoluteDashboardPath(tab: string): string {
    return `${getPublicOrigin()}${toDashboardMenuPath(tab)}`;
}

function buildLeaveMessage(data: LeaveNotificationPayload): string {
    return `${getLeaveTypeLabel(data.leaveType)} ${formatLeaveSummary(data)}`;
}

function buildLeaveActionMessage(data: LeaveActionPayload): string {
    return `${data.employee.name} · ${buildLeaveMessage(data)}${formatLeaveFlagSummary(data)}`;
}

export async function createLeaveActionInAppNotification(
    tx: Prisma.TransactionClient,
    payload: LeaveActionPayload,
): Promise<void> {
    await createNotificationOnceWithClient(tx, {
        userId: payload.approver.userId,
        type: "LEAVE_REQUESTED",
        title: LEAVE_NOTIFICATION_TITLES.action,
        message: buildLeaveActionMessage(payload),
        actionUrl: toDashboardMenuPath(APP_DASHBOARD_TABS.managerApproval),
        referenceId: payload.leaveId,
    });
}

export async function sendLeaveActionNotifications(
    payload: LeaveActionPayload,
    options: { createInApp?: boolean } = {},
): Promise<void> {
    const dashboardLink = getAbsoluteDashboardPath(
        APP_DASHBOARD_TABS.managerApproval,
    );
    if (options.createInApp !== false) {
        await createLeaveActionInAppNotification(prisma, payload);
    }

    await assertEmailSent(
        await sendLeaveActionNotification(payload, dashboardLink),
        "LEAVE_ACTION",
    );
}

export async function sendLeaveResultNotifications(
    payload: LeaveResultPayload,
): Promise<void> {
    const isApproved = payload.status === "APPROVED";
    await createNotificationOnce({
        userId: payload.employee.userId,
        type: isApproved ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        title: isApproved
            ? LEAVE_NOTIFICATION_TITLES.approved
            : LEAVE_NOTIFICATION_TITLES.rejected,
        message: buildLeaveMessage(payload),
        actionUrl: toDashboardMenuPath(APP_DASHBOARD_TABS.leaveHistory),
        referenceId: payload.leaveId,
    });

    await assertEmailSent(
        await sendLeaveResultNotification(payload),
        "LEAVE_RESULT",
    );
}

export async function sendLeaveCancelledNotifications(
    payload: LeaveCancelledPayload,
): Promise<void> {
    await createNotificationOnce({
        userId: payload.approver.userId,
        type: "LEAVE_CANCELLED",
        title: LEAVE_NOTIFICATION_TITLES.cancelled,
        message: `${payload.employee.name} · ${buildLeaveMessage(payload)}`,
        actionUrl: toDashboardMenuPath(APP_DASHBOARD_TABS.managerApproval),
        referenceId: payload.leaveId,
    });

    await assertEmailSent(
        await sendLeaveCancelledNotification(payload),
        "LEAVE_CANCELLED",
    );
}

export async function sendLeaveCancellationRequestedNotifications(
    payload: LeaveCancellationRequestedPayload,
): Promise<void> {
    await createNotificationOnce({
        userId: payload.approver.userId,
        type: "LEAVE_CANCELLATION_REQUESTED",
        title: LEAVE_NOTIFICATION_TITLES.cancellationRequested,
        message: `${payload.employee.name} · ${buildLeaveMessage(payload)}ที่อนุมัติแล้ว`,
        actionUrl: toDashboardMenuPath(APP_DASHBOARD_TABS.managerApproval),
        referenceId: payload.leaveId,
    });

    await assertEmailSent(
        await sendLeaveCancellationRequestedNotification(payload),
        "LEAVE_CANCELLATION_REQUESTED",
    );
}

export async function sendLeaveCancelledAfterApprovalNotifications(
    payload: LeaveCancelledAfterApprovalPayload,
): Promise<void> {
    const decisionActor = formatLeaveDecisionActor(payload);
    await createNotificationOnce({
        userId: payload.employee.userId,
        type: "LEAVE_CANCELLED_AFTER_APPROVAL",
        title: LEAVE_NOTIFICATION_TITLES.cancelledAfterApproval,
        message: `${buildLeaveMessage(payload)} · ผู้ยืนยัน: ${decisionActor}`,
        actionUrl: toDashboardMenuPath(APP_DASHBOARD_TABS.leaveHistory),
        referenceId: payload.leaveId,
    });

    await assertEmailSent(
        await sendLeaveCancelledAfterApprovalNotification(payload),
        "LEAVE_CANCELLED_AFTER_APPROVAL",
    );
}

export async function sendLeaveNotTakenRequestedNotifications(
    payload: LeaveNotTakenRequestedPayload,
): Promise<void> {
    await createNotificationOnce({
        userId: payload.approver.userId,
        type: "LEAVE_NOT_TAKEN_REQUESTED",
        title: LEAVE_NOTIFICATION_TITLES.notTakenRequested,
        message: `${payload.employee.name} · ${buildLeaveMessage(payload)}`,
        actionUrl: toDashboardMenuPath(APP_DASHBOARD_TABS.managerApproval),
        referenceId: payload.leaveId,
    });

    await assertEmailSent(
        await sendLeaveNotTakenRequestedNotification(payload),
        "LEAVE_NOT_TAKEN_REQUESTED",
    );
}

export async function sendLeaveNotTakenConfirmedNotifications(
    payload: LeaveNotTakenConfirmedPayload,
): Promise<void> {
    const decisionActor = formatLeaveDecisionActor(payload);
    await createNotificationOnce({
        userId: payload.employee.userId,
        type: "LEAVE_NOT_TAKEN_CONFIRMED",
        title: LEAVE_NOTIFICATION_TITLES.notTakenConfirmed,
        message: `${buildLeaveMessage(payload)} · ผู้ยืนยัน: ${decisionActor}`,
        actionUrl: toDashboardMenuPath(APP_DASHBOARD_TABS.leaveHistory),
        referenceId: payload.leaveId,
    });

    await assertEmailSent(
        await sendLeaveNotTakenConfirmedNotification(payload),
        "LEAVE_NOT_TAKEN_CONFIRMED",
    );
}
