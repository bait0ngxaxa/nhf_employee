import type { RoutineReminderEmailData } from "./notification-types";
import { escapeHtml } from "@/lib/email/templates/html";

function formatThaiDueDate(dueDate: string): string {
    return new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date(`${dueDate}T00:00:00.000+07:00`));
}

function getTimingText(daysBefore: number): string {
    return daysBefore === 0
        ? "ครบกำหนดวันนี้"
        : `เหลือเวลา ${daysBefore} วัน`;
}

export function generateRoutineReminderEmailHTML(
    data: RoutineReminderEmailData,
): string {
    const recipientName = escapeHtml(data.recipientName);
    const taskTitle = escapeHtml(data.taskTitle);
    const unitName = escapeHtml(data.unitName);
    const categoryName = escapeHtml(data.categoryName);
    const dueDate = escapeHtml(formatThaiDueDate(data.dueDate));
    const timingText = escapeHtml(getTimingText(data.daysBefore));
    const actionUrl = escapeHtml(data.actionUrl);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>แจ้งเตือนงาน NHF Routine</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #cbd5e1;">
        <h2 style="color: #0f172a; margin-top: 0;">งานใกล้ถึงกำหนด</h2>
        <p>เรียน ${recipientName},</p>
        <p>มีงาน Routine ที่ควรตรวจสอบตามกำหนดดังนี้</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; width: 30%; color: #475569;">ชื่องาน:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${taskTitle}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #475569;">หน่วยงาน:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${unitName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #475569;">หมวดหมู่:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${categoryName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #475569;">วันครบกำหนด:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${dueDate}</td></tr>
            <tr><td style="padding: 8px; color: #475569;">สถานะกำหนด:</td><td style="padding: 8px; font-weight: bold;">${timingText}</td></tr>
        </table>
        <p style="margin: 28px 0; text-align: center;">
            <a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0284c7; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">ดูรายการ Routine</a>
        </p>
        <p style="font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            ระบบ NHF Routine<br>
            อีเมลฉบับนี้สร้างโดยระบบอัตโนมัติ
        </p>
    </div>
</body>
</html>`;
}

export function generateRoutineReminderEmailText(
    data: RoutineReminderEmailData,
): string {
    return `เรียน ${data.recipientName},

งานใกล้ถึงกำหนด
ชื่องาน: ${data.taskTitle}
หน่วยงาน: ${data.unitName}
หมวดหมู่: ${data.categoryName}
วันครบกำหนด: ${formatThaiDueDate(data.dueDate)}
${getTimingText(data.daysBefore)}

ดูรายการ Routine: ${data.actionUrl}`;
}
