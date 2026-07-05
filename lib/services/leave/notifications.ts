import { Prisma, type NotificationType } from "@prisma/client";

import { emailService } from "@/lib/email";
import { prisma } from "@/lib/db/prisma";
import {
    APP_DASHBOARD_TABS,
    toDashboardTabPath,
} from "@/lib/ssot/routes";
import {
    formatLeaveFlagSummary,
    formatLeaveSummary,
    getLeaveTypeLabel,
} from "@/lib/services/leave/notification-format";
import type {
    LeaveActionPayload,
    LeaveCancelledPayload,
    LeaveNotTakenConfirmedPayload,
    LeaveNotTakenRequestedPayload,
    LeaveNotificationPayload,
    LeaveResultPayload,
} from "@/lib/services/leave/notification-payloads";
import { getPublicOrigin } from "@/lib/network/public-url";

type LeaveNotificationInput = {
    userId: number | null;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl: string;
    referenceId: string;
};

function isUniqueConstraintError(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    );
}

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

async function createNotificationOnce(
    input: LeaveNotificationInput,
): Promise<void> {
    if (!input.userId) {
        return;
    }

    const { userId, ...data } = input;
    try {
        await prisma.notification.create({
            data: { ...data, userId, dedupeKey: buildDedupeKey(input) },
        });
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return;
        }
        throw error;
    }
}

function getAbsoluteDashboardPath(tab: string): string {
    return `${getPublicOrigin()}${toDashboardTabPath(tab)}`;
}

function buildLeaveMessage(data: LeaveNotificationPayload): string {
    return `${getLeaveTypeLabel(data.leaveType)} ${formatLeaveSummary(data)}`;
}

function buildLeaveActionMessage(data: LeaveActionPayload): string {
    return `${data.employee.name} ส่งคำขอ${buildLeaveMessage(data)}${formatLeaveFlagSummary(data)}`;
}

export async function sendLeaveActionNotifications(
    payload: LeaveActionPayload,
): Promise<void> {
    const dashboardLink = getAbsoluteDashboardPath(
        APP_DASHBOARD_TABS.managerApproval,
    );
    await createNotificationOnce({
        userId: payload.approver.userId,
        type: "LEAVE_REQUESTED",
        title: "มีคำขอลาใหม่รออนุมัติ",
        message: buildLeaveActionMessage(payload),
        actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.managerApproval),
        referenceId: payload.leaveId,
    });

    await assertEmailSent(
        await emailService.sendLeaveActionNotification(payload, dashboardLink),
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
            ? "คำขอลาได้รับการอนุมัติ"
            : "คำขอลาไม่ได้รับการอนุมัติ",
        message: isApproved
            ? `ผู้อนุมัติอนุมัติ${buildLeaveMessage(payload)}แล้ว`
            : `ผู้อนุมัติไม่อนุมัติ${buildLeaveMessage(payload)}`,
        actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.leaveHistory),
        referenceId: payload.leaveId,
    });

    await assertEmailSent(
        await emailService.sendLeaveResultNotification(payload),
        "LEAVE_RESULT",
    );
}

export async function sendLeaveCancelledNotifications(
    payload: LeaveCancelledPayload,
): Promise<void> {
    await createNotificationOnce({
        userId: payload.approver.userId,
        type: "LEAVE_CANCELLED",
        title: "คำขอลาถูกยกเลิก",
        message: `${payload.employee.name} ยกเลิกคำขอ${buildLeaveMessage(payload)}`,
        actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.managerApproval),
        referenceId: payload.leaveId,
    });

    await assertEmailSent(
        await emailService.sendLeaveCancelledNotification(payload),
        "LEAVE_CANCELLED",
    );
}

export async function sendLeaveNotTakenRequestedNotifications(
    payload: LeaveNotTakenRequestedPayload,
): Promise<void> {
    await createNotificationOnce({
        userId: payload.approver.userId,
        type: "LEAVE_NOT_TAKEN_REQUESTED",
        title: "มีรายการแจ้งไม่ได้ใช้วันลารอยืนยัน",
        message: `${payload.employee.name} แจ้งไม่ได้ใช้วันลา: ${buildLeaveMessage(payload)}`,
        actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.managerApproval),
        referenceId: payload.leaveId,
    });

    await assertEmailSent(
        await emailService.sendLeaveNotTakenRequestedNotification(payload),
        "LEAVE_NOT_TAKEN_REQUESTED",
    );
}

export async function sendLeaveNotTakenConfirmedNotifications(
    payload: LeaveNotTakenConfirmedPayload,
): Promise<void> {
    await createNotificationOnce({
        userId: payload.employee.userId,
        type: "LEAVE_NOT_TAKEN_CONFIRMED",
        title: "ยืนยันไม่ได้ใช้วันลาแล้ว",
        message: `ผู้อนุมัติยืนยันไม่ได้ใช้วันลา: ${buildLeaveMessage(payload)}`,
        actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.leaveHistory),
        referenceId: payload.leaveId,
    });

    await assertEmailSent(
        await emailService.sendLeaveNotTakenConfirmedNotification(payload),
        "LEAVE_NOT_TAKEN_CONFIRMED",
    );
}
