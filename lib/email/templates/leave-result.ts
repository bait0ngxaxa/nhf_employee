import { type LeaveResultPayload } from "../types";
import {
    formatLeaveDateRange,
    formatLeaveDurationDays,
    getLeavePeriodLabel,
    getLeaveTypeLabel,
} from "@/lib/services/leave/notification-format";
import { escapeHtml, textToHtml } from "./html";

export function generateLeaveResultEmailHTML(
    data: LeaveResultPayload,
    dashboardUrl: string,
): string {
    const statusText = data.status === "APPROVED" ? "อนุมัติ" : "ไม่อนุมัติ";
    const statusColor = data.status === "APPROVED" ? "#10b981" : "#ef4444";
    const reason = data.reason ? textToHtml(data.reason) : "";
    const approverName = escapeHtml(data.approverName ?? "ผู้อนุมัติ");
    const dashboardHref = escapeHtml(dashboardUrl);
    const typeLabel = escapeHtml(getLeaveTypeLabel(data.leaveType));
    const dateRange = escapeHtml(formatLeaveDateRange(data.startDate, data.endDate));
    const durationDays = escapeHtml(formatLeaveDurationDays(data.durationDays));
    const periodLabel = escapeHtml(getLeavePeriodLabel(data.period));

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ผลการพิจารณาคำขอลา</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
        <h2 style="color: #2c3e50; margin-top: 0; border-bottom: 2px solid ${statusColor}; padding-bottom: 10px;">
            ผลการพิจารณาคำขอลา: <span style="color: ${statusColor};">${statusText}</span>
        </h2>
        
        <p>เรียนพนักงาน,</p>
        <p>คำขอลาของคุณได้รับการพิจารณาแล้ว โดยมีผลคือ <strong>${statusText}</strong></p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; width: 30%; color: #6c757d;">ผู้อนุมัติ:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${approverName}</td>
            </tr>
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
        
        ${data.reason ? `
        <div style="background-color: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #ffeeba;">
            <strong>เหตุผลจากหัวหน้างาน:</strong><br>
            ${reason}
        </div>
        ` : ''}

        <p style="margin-top: 30px;">
            คุณสามารถตรวจสอบข้อมูลและประวัติการลาทั้งหมดได้ที่:<br>
            <a href="${dashboardHref}" style="color: #3b82f6; text-decoration: none; font-weight: bold;">หน้าแดชบอร์ดการลาของคุณ</a>
        </p>

        <p style="font-size: 12px; color: #6c757d; margin-top: 40px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            ระบบจัดการวันลา NHF<br>
            อีเมลฉบับนี้สร้างโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ
        </p>
    </div>
</body>
</html>`;
}
