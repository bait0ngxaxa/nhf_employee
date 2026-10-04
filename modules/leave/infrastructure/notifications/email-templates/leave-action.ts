import type { LeaveActionPayload } from "../../../application/notifications/notification-payloads";
import { formatLeaveDateRange, formatLeaveDurationDays, getLeavePeriodLabel, getLeaveTypeLabel } from "../../../application/notifications/notification-format";
import { LEAVE_NOTIFICATION_TITLES } from "../../../domain/notification-content";
import { generateNotificationEmailHTML, type NotificationEmailDetail } from "@/lib/email/templates/notification";
import { NOTIFICATION_ACTIONS } from "@/shared/notifications/presentation";

export function generateLeaveActionEmailHTML(data: LeaveActionPayload, dashboardLink: string): string {
    const details: NotificationEmailDetail[] = [
        { label: "พนักงาน", value: data.employee.name },
        { label: "ประเภทการลา", value: getLeaveTypeLabel(data.leaveType) },
        { label: "วันที่", value: formatLeaveDateRange(data.startDate, data.endDate) },
        { label: "จำนวนวัน", value: `${formatLeaveDurationDays(data.durationDays)} วัน (${getLeavePeriodLabel(data.period)})` },
        { label: "เหตุผล", value: data.reason },
    ];
    if (data.emergencyReason) details.push({ label: "เหตุผลในการลาย้อนหลัง", value: data.emergencyReason });
    if (data.specialReason || data.overQuotaDays > 0) details.push({ label: "เกินโควต้า", value: `${formatLeaveDurationDays(data.overQuotaDays)} วัน${data.specialReason ? `\n${data.specialReason}` : ""}` });
    return generateNotificationEmailHTML({
        module: "Leave", categoryLabel: "คำขอลา", title: LEAVE_NOTIFICATION_TITLES.action,
        intro: `คำขอลาของ ${data.employee.name} รอการพิจารณาจากคุณ`,
        details, actionLabel: NOTIFICATION_ACTIONS.review, actionUrl: dashboardLink,
    });
}
