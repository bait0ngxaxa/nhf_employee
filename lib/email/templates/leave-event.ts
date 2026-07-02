import type { LeaveSummaryInput } from "@/lib/services/leave/notification-format";
import {
    formatLeaveDateRange,
    formatLeaveDurationDays,
    getLeavePeriodLabel,
    getLeaveTypeLabel,
    type LeaveTypeValue,
} from "@/lib/services/leave/notification-format";
import { escapeHtml, textToHtml } from "./html";

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
    const title = escapeHtml(data.title);
    const intro = escapeHtml(data.intro);
    const employeeName = escapeHtml(data.employeeName);
    const typeLabel = escapeHtml(getLeaveTypeLabel(data.leaveType));
    const dateRange = escapeHtml(formatLeaveDateRange(data.startDate, data.endDate));
    const durationDays = escapeHtml(formatLeaveDurationDays(data.durationDays));
    const periodLabel = escapeHtml(getLeavePeriodLabel(data.period));
    const dashboardHref = escapeHtml(data.dashboardLink);
    const ctaLabel = escapeHtml(data.ctaLabel);
    const actorLabel = data.actorLabel ? escapeHtml(data.actorLabel) : "";
    const actorName = data.actorName ? escapeHtml(data.actorName) : "";
    const noteLabel = data.noteLabel ? escapeHtml(data.noteLabel) : "";
    const note = data.note ? textToHtml(data.note) : "";

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
        <h2 style="color: #2c3e50; margin-top: 0; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
            ${title}
        </h2>
        <p>${intro}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; width: 30%; color: #6c757d;">พนักงาน:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${employeeName}</td>
            </tr>
            ${actorLabel && actorName ? `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">${actorLabel}:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${actorName}</td>
            </tr>
            ` : ""}
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">ประเภทการลา:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; font-weight: bold;">${typeLabel}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">วันที่:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${dateRange}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">จำนวนวัน:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${durationDays} วัน (${periodLabel})</td>
            </tr>
        </table>
        ${note ? `
        <div style="background-color: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #ffeeba;">
            <strong>${noteLabel}:</strong><br>
            ${note}
        </div>
        ` : ""}
        <p style="margin-top: 30px; text-align: center;">
            <a href="${dashboardHref}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                ${ctaLabel}
            </a>
        </p>
        <p style="font-size: 12px; color: #6c757d; margin-top: 40px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            ระบบจัดการวันลา NHF<br>
            อีเมลฉบับนี้สร้างโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ
        </p>
    </div>
</body>
</html>`;
}
