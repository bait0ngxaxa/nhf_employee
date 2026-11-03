import { buildNotificationFlex, notificationFlexStatus, notificationFlexText } from "@/lib/line/notification-flex";
import {
    NOTIFICATION_ACTIONS,
    NOTIFICATION_COLORS,
    type NotificationStatus,
} from "@/shared/notifications/presentation";
import { LEAVE_NOTIFICATION_TITLES } from "../../domain/notification-content";
import type { LineFlexComponent, LineFlexMessage } from "@/types/api";

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
    LeaveResultPayload,
} from "@/modules/leave/application/notifications/notification-payloads";

type LeaveSummaryPayload = {
    employee: { name: string };
    leaveType: LeaveActionPayload["leaveType"];
    startDate: string;
    endDate: string;
    period: LeaveActionPayload["period"];
    durationDays: number;
};

type LeaveFlexMessageData = {
    title: string;
    employeeName: string;
    leaveSummary: string;
    details?: string;
    statusLabel?: string;
    actionLabel: string;
    actionUrl: string;
    status: NotificationStatus;
};

function buildLeaveFlexMessage(data: LeaveFlexMessageData): LineFlexMessage {
    const detailContents: LineFlexComponent[] = [
        {
            type: "text",
            text: "รายละเอียดคำขอ",
            color: NOTIFICATION_COLORS.body,
            size: "sm",
            weight: "bold",
            wrap: true,
        },
    ];
    if (data.statusLabel) {
        detailContents.push(notificationFlexStatus(`สถานะ: ${data.statusLabel}`, data.status));
    }
    if (data.details) {
        detailContents.push({
            type: "text",
            text: data.details,
            color: NOTIFICATION_COLORS.muted,
            size: "sm",
            wrap: true,
        });
    }

    return buildNotificationFlex({
        module: "Leave", categoryLabel: "คำขอลา", title: data.title,
        contents: [notificationFlexText(data.employeeName), notificationFlexText(data.leaveSummary), ...detailContents],
        actionLabel: data.actionLabel, actionUrl: data.actionUrl, status: data.status,
    });
}

function formatSummary(payload: LeaveSummaryPayload): string {
    return `${getLeaveTypeLabel(payload.leaveType)} ${formatLeaveSummary(payload)}`;
}

export function generateLeaveActionFlexMessage(
    payload: LeaveActionPayload,
    actionUrl: string,
): LineFlexMessage {
    const summary = formatSummary(payload);
    return buildLeaveFlexMessage({
        title: LEAVE_NOTIFICATION_TITLES.action,
        employeeName: payload.employee.name,
        leaveSummary: summary,
        details: `รายละเอียดเพิ่มเติม${formatLeaveFlagSummary(payload)}`,
        actionLabel: NOTIFICATION_ACTIONS.review,
        actionUrl,
        status: "warning",
    });
}

export function generateLeaveResultFlexMessage(
    payload: LeaveResultPayload,
    actionUrl: string,
): LineFlexMessage {
    const isApproved = payload.status === "APPROVED";
    const statusLabel = isApproved ? "อนุมัติ" : "ไม่อนุมัติ";
    const details = payload.approverName
        ? `ผู้อนุมัติ: ${payload.approverName}`
        : undefined;
    return buildLeaveFlexMessage({
        title: isApproved
            ? LEAVE_NOTIFICATION_TITLES.approved
            : LEAVE_NOTIFICATION_TITLES.rejected,
        employeeName: payload.employee.name,
        leaveSummary: formatSummary(payload),
        details,
        statusLabel,
        actionLabel: NOTIFICATION_ACTIONS.details,
        actionUrl,
        status: isApproved ? "success" : "danger",
    });
}

export function generateLeaveCancelledFlexMessage(
    payload: LeaveCancelledPayload,
    actionUrl: string,
): LineFlexMessage {
    return buildLeaveFlexMessage({
        title: LEAVE_NOTIFICATION_TITLES.cancelled,
        employeeName: payload.employee.name,
        leaveSummary: formatSummary(payload),
        actionLabel: NOTIFICATION_ACTIONS.details,
        actionUrl,
        status: "neutral",
    });
}

export function generateLeaveCancellationRequestedFlexMessage(
    payload: LeaveCancellationRequestedPayload,
    actionUrl: string,
): LineFlexMessage {
    return buildLeaveFlexMessage({
        title: LEAVE_NOTIFICATION_TITLES.cancellationRequested,
        employeeName: payload.employee.name,
        leaveSummary: formatSummary(payload),
        details: `หมายเหตุ: ${payload.note}`,
        actionLabel: NOTIFICATION_ACTIONS.review,
        actionUrl,
        status: "warning",
    });
}

export function generateLeaveCancelledAfterApprovalFlexMessage(
    payload: LeaveCancelledAfterApprovalPayload,
    actionUrl: string,
): LineFlexMessage {
    return buildLeaveFlexMessage({
        title: LEAVE_NOTIFICATION_TITLES.cancelledAfterApproval,
        employeeName: payload.employee.name,
        leaveSummary: formatSummary(payload),
        details: `ผู้ยืนยัน: ${formatLeaveDecisionActor(payload)}`,
        statusLabel: "ยกเลิกแล้ว",
        actionLabel: NOTIFICATION_ACTIONS.details,
        actionUrl,
        status: "neutral",
    });
}

export function generateLeaveNotTakenRequestedFlexMessage(
    payload: LeaveNotTakenRequestedPayload,
    actionUrl: string,
): LineFlexMessage {
    return buildLeaveFlexMessage({
        title: LEAVE_NOTIFICATION_TITLES.notTakenRequested,
        employeeName: payload.employee.name,
        leaveSummary: formatSummary(payload),
        details: `หมายเหตุ: ${payload.note}`,
        actionLabel: NOTIFICATION_ACTIONS.review,
        actionUrl,
        status: "warning",
    });
}

export function generateLeaveNotTakenConfirmedFlexMessage(
    payload: LeaveNotTakenConfirmedPayload,
    actionUrl: string,
): LineFlexMessage {
    return buildLeaveFlexMessage({
        title: LEAVE_NOTIFICATION_TITLES.notTakenConfirmed,
        employeeName: payload.employee.name,
        leaveSummary: formatSummary(payload),
        details: `ผู้ยืนยัน: ${formatLeaveDecisionActor(payload)}`,
        statusLabel: "ไม่ได้ใช้วันลา",
        actionLabel: NOTIFICATION_ACTIONS.details,
        actionUrl,
        status: "neutral",
    });
}
