import type { LineFlexComponent, LineFlexMessage } from "@/types/api";

import {
    formatLeaveDecisionActor,
    formatLeaveFlagSummary,
    formatLeaveSummary,
    getLeaveTypeLabel,
} from "@/lib/services/leave/notification-format";
import type {
    LeaveActionPayload,
    LeaveCancelledAfterApprovalPayload,
    LeaveCancelledPayload,
    LeaveCancellationRequestedPayload,
    LeaveNotTakenConfirmedPayload,
    LeaveNotTakenRequestedPayload,
    LeaveResultPayload,
} from "@/lib/services/leave/notification-payloads";

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
    altText: string;
    employeeName: string;
    leaveSummary: string;
    details?: string;
    statusLabel?: string;
    statusColor?: string;
    actionLabel: string;
    actionUrl: string;
    accentColor: string;
};

function buildLeaveFlexMessage(data: LeaveFlexMessageData): LineFlexMessage {
    const detailContents: LineFlexComponent[] = [
        {
            type: "text",
            text: "รายละเอียดคำขอ",
            color: "#374151",
            size: "sm",
            weight: "bold",
            wrap: true,
        },
    ];
    if (data.statusLabel) {
        detailContents.push({
            type: "text",
            text: `สถานะ: ${data.statusLabel}`,
            color: data.statusColor ?? "#111827",
            size: "sm",
            weight: "bold",
            wrap: true,
        });
    }
    if (data.details) {
        detailContents.push({
            type: "text",
            text: data.details,
            color: "#4B5563",
            size: "sm",
            wrap: true,
        });
    }

    return {
        type: "flex",
        altText: data.altText,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: data.title,
                        weight: "bold",
                        color: "#FFFFFF",
                        size: "lg",
                        wrap: true,
                    },
                ],
                backgroundColor: data.accentColor,
                paddingAll: "20px",
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "text",
                        text: data.employeeName,
                        weight: "bold",
                        size: "lg",
                        wrap: true,
                    },
                    {
                        type: "text",
                        text: data.leaveSummary,
                        color: "#111827",
                        size: "sm",
                        wrap: true,
                        margin: "sm",
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "md",
                        spacing: "sm",
                        contents: detailContents,
                    },
                ],
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: data.actionLabel,
                            uri: data.actionUrl,
                        },
                        color: data.accentColor,
                    },
                ],
            },
        },
    };
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
        title: "มีคำขอลาใหม่รออนุมัติ",
        altText: `${payload.employee.name} ส่งคำขอลาใหม่`,
        employeeName: payload.employee.name,
        leaveSummary: summary,
        details: `รายละเอียดเพิ่มเติม${formatLeaveFlagSummary(payload)}`,
        actionLabel: "ตรวจสอบคำขอ",
        actionUrl,
        accentColor: "#2563EB",
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
            ? "คำขอลาได้รับการอนุมัติ"
            : "คำขอลาไม่ได้รับการอนุมัติ",
        altText: `${getLeaveTypeLabel(payload.leaveType)}${statusLabel}`,
        employeeName: payload.employee.name,
        leaveSummary: formatSummary(payload),
        details,
        statusLabel,
        statusColor: isApproved ? "#047857" : "#B91C1C",
        actionLabel: "เปิดรายละเอียด",
        actionUrl,
        accentColor: isApproved ? "#059669" : "#DC2626",
    });
}

export function generateLeaveCancelledFlexMessage(
    payload: LeaveCancelledPayload,
    actionUrl: string,
): LineFlexMessage {
    return buildLeaveFlexMessage({
        title: "คำขอลาถูกยกเลิก",
        altText: `${payload.employee.name} ยกเลิกคำขอลา`,
        employeeName: payload.employee.name,
        leaveSummary: formatSummary(payload),
        actionLabel: "เปิดรายละเอียด",
        actionUrl,
        accentColor: "#6B7280",
    });
}

export function generateLeaveCancellationRequestedFlexMessage(
    payload: LeaveCancellationRequestedPayload,
    actionUrl: string,
): LineFlexMessage {
    return buildLeaveFlexMessage({
        title: "มีคำขอยกเลิกวันลารอยืนยัน",
        altText: `${payload.employee.name} ขอยกเลิกวันลา`,
        employeeName: payload.employee.name,
        leaveSummary: formatSummary(payload),
        details: `หมายเหตุ: ${payload.note}`,
        actionLabel: "ตรวจสอบคำขอ",
        actionUrl,
        accentColor: "#D97706",
    });
}

export function generateLeaveCancelledAfterApprovalFlexMessage(
    payload: LeaveCancelledAfterApprovalPayload,
    actionUrl: string,
): LineFlexMessage {
    return buildLeaveFlexMessage({
        title: "ยกเลิกวันลาที่อนุมัติแล้วเรียบร้อย",
        altText: `${formatLeaveDecisionActor(payload)} ยืนยันการยกเลิกวันลา`,
        employeeName: payload.employee.name,
        leaveSummary: formatSummary(payload),
        details: `ผู้ยืนยัน: ${formatLeaveDecisionActor(payload)}`,
        statusLabel: "ยกเลิกแล้ว",
        statusColor: "#6B7280",
        actionLabel: "เปิดรายละเอียด",
        actionUrl,
        accentColor: "#6B7280",
    });
}

export function generateLeaveNotTakenRequestedFlexMessage(
    payload: LeaveNotTakenRequestedPayload,
    actionUrl: string,
): LineFlexMessage {
    return buildLeaveFlexMessage({
        title: "มีรายการแจ้งไม่ได้ใช้วันลารอยืนยัน",
        altText: `${payload.employee.name} แจ้งไม่ได้ใช้วันลา`,
        employeeName: payload.employee.name,
        leaveSummary: formatSummary(payload),
        details: `หมายเหตุ: ${payload.note}`,
        actionLabel: "ตรวจสอบคำขอ",
        actionUrl,
        accentColor: "#D97706",
    });
}

export function generateLeaveNotTakenConfirmedFlexMessage(
    payload: LeaveNotTakenConfirmedPayload,
    actionUrl: string,
): LineFlexMessage {
    return buildLeaveFlexMessage({
        title: "ยืนยันไม่ได้ใช้วันลาแล้ว",
        altText: `${formatLeaveDecisionActor(payload)} ยืนยันไม่ได้ใช้วันลา`,
        employeeName: payload.employee.name,
        leaveSummary: formatSummary(payload),
        details: `ผู้ยืนยัน: ${formatLeaveDecisionActor(payload)}`,
        statusLabel: "ไม่ได้ใช้วันลา",
        statusColor: "#6B7280",
        actionLabel: "เปิดรายละเอียด",
        actionUrl,
        accentColor: "#6B7280",
    });
}
