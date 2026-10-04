import type { LeaveResultPayload } from "../../../application/notifications/notification-payloads";
import { formatLeaveDateRange, formatLeaveDurationDays, getLeavePeriodLabel, getLeaveTypeLabel } from "../../../application/notifications/notification-format";
import { LEAVE_NOTIFICATION_TITLES } from "../../../domain/notification-content";
import { generateNotificationEmailHTML, type NotificationEmailDetail } from "@/lib/email/templates/notification";
import { NOTIFICATION_ACTIONS } from "@/shared/notifications/presentation";

export function generateLeaveResultEmailHTML(data: LeaveResultPayload, dashboardUrl: string): string {
    const title = data.status === "APPROVED" ? LEAVE_NOTIFICATION_TITLES.approved : LEAVE_NOTIFICATION_TITLES.rejected;
    const details: NotificationEmailDetail[] = [
        { label: "ผู้อนุมัติ", value: data.approverName ?? "ผู้อนุมัติ" },
        { label: "ประเภทการลา", value: getLeaveTypeLabel(data.leaveType) },
        { label: "วันที่", value: formatLeaveDateRange(data.startDate, data.endDate) },
        { label: "จำนวนวัน", value: `${formatLeaveDurationDays(data.durationDays)} วัน (${getLeavePeriodLabel(data.period)})` },
        { label: "สถานะ", value: data.status === "APPROVED" ? "อนุมัติ" : "ไม่อนุมัติ" },
    ];
    if (data.reason) details.push({ label: "เหตุผลจากผู้อนุมัติ", value: data.reason });
    return generateNotificationEmailHTML({ module: "Leave", categoryLabel: "คำขอลา", title,
        intro: "ตรวจสอบผลการพิจารณาและรายละเอียดคำขอลาของคุณได้ด้านล่าง",
        details, actionLabel: NOTIFICATION_ACTIONS.details, actionUrl: dashboardUrl });
}
