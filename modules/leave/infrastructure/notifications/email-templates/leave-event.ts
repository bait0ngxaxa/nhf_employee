import type { LeaveSummaryInput } from "@/modules/leave/application/notifications/notification-format";
import {
    formatLeaveDateRange,
    formatLeaveDurationDays,
    getLeavePeriodLabel,
    getLeaveTypeLabel,
    type LeaveTypeValue,
} from "@/modules/leave/application/notifications/notification-format";
import { generateNotificationEmailHTML, type NotificationEmailDetail } from "@/lib/email/templates/notification";

export type LeaveEventEmailData = LeaveSummaryInput & {
    title: string;
    intro: string;
    employeeName: string;
    leaveType: LeaveTypeValue;
    dashboardLink: string;
    ctaLabel: string;
    actorLabel?: string;
    actorName?: string | null;
    noteLabel?: string;
    note?: string | null;
};

export function generateLeaveEventEmailHTML(data: LeaveEventEmailData): string {
    const details: NotificationEmailDetail[] = [
        { label: "พนักงาน", value: data.employeeName },
        { label: "ประเภทการลา", value: getLeaveTypeLabel(data.leaveType) },
        { label: "วันที่", value: formatLeaveDateRange(data.startDate, data.endDate) },
        { label: "จำนวนวัน", value: `${formatLeaveDurationDays(data.durationDays)} วัน (${getLeavePeriodLabel(data.period)})` },
    ];
    if (data.actorLabel && data.actorName) details.push({ label: data.actorLabel, value: data.actorName });
    if (data.note) details.push({ label: data.noteLabel ?? "หมายเหตุ", value: data.note });
    return generateNotificationEmailHTML({ module: "Leave", categoryLabel: "คำขอลา", title: data.title,
        intro: data.intro, details, actionLabel: data.ctaLabel, actionUrl: data.dashboardLink });
}
