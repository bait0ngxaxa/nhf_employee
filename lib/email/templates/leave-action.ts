import { type LeaveActionPayload } from "../types";
import {
    formatLeaveDateRange,
    formatLeaveDurationDays,
    getLeavePeriodLabel,
    getLeaveTypeLabel,
} from "@/lib/services/leave/notification-format";
import { escapeHtml, textToHtml } from "./html";

export function generateLeaveActionEmailHTML(
    data: LeaveActionPayload,
    dashboardLink: string
): string {
    const typeLabel = getLeaveTypeLabel(data.leaveType);
    const employeeName = escapeHtml(data.employee.name);
    const reason = textToHtml(data.reason);
    const dashboardHref = escapeHtml(dashboardLink);
    const dateRange = escapeHtml(formatLeaveDateRange(data.startDate, data.endDate));
    const durationDays = escapeHtml(formatLeaveDurationDays(data.durationDays));
    const periodLabel = escapeHtml(getLeavePeriodLabel(data.period));
    const emergencyReason = data.emergencyReason
        ? textToHtml(data.emergencyReason)
        : "";
    const specialReason = data.specialReason ? textToHtml(data.specialReason) : "";

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>แจ้งเตือนคำขอลารออนุมัติ</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
        <h2 style="color: #2c3e50; margin-top: 0; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
            มีคำขอลาใหม่รออนุมัติ
        </h2>
        
        <p>เรียน ผู้อนุมัติ,</p>
        <p>พนักงาน <strong>${employeeName}</strong> ได้ส่งคำขอ${typeLabel} โดยมีรายละเอียดดังนี้:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; width: 30%; color: #6c757d;">ประเภทการลา:</td>
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
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">เหตุผล:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${reason}</td>
            </tr>
            ${data.emergencyReason ? `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">เหตุผลในการลาย้อนหลัง:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${emergencyReason}</td>
            </tr>
            ` : ""}
            ${data.specialReason || data.overQuotaDays > 0 ? `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">เกินโควต้า:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">
                    ${escapeHtml(formatLeaveDurationDays(data.overQuotaDays))} วัน
                    ${specialReason ? `<br>${specialReason}` : ""}
                </td>
            </tr>
            ` : ""}
        </table>

        <p style="margin-top: 30px; text-align: center;">
            <a href="${dashboardHref}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                ดูรายละเอียดและพิจารณาคำขอลา
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
