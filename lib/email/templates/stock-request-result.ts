import type { StockRequestResultEmailPayload } from "@/lib/services/stock/notification-payloads";
import { formatThaiDateTime } from "@/lib/helpers/date-helpers";
import { escapeHtml } from "./html";

function getStatusText(status: StockRequestResultEmailPayload["status"]): string {
    return status === "ISSUED"
        ? "จ่ายสินค้าเรียบร้อยแล้ว"
        : "คำขอถูกยกเลิกโดยผู้ดูแลระบบ";
}

function getStatusColor(status: StockRequestResultEmailPayload["status"]): string {
    return status === "ISSUED" ? "#10b981" : "#ef4444";
}

function getCancelReason(data: StockRequestResultEmailPayload): string {
    return data.cancelReason?.trim() || "ไม่ได้ระบุเหตุผล";
}

function getVariantLabel(item: StockRequestResultEmailPayload["items"][number]): string {
    return item.variantLabel ? ` (${item.variantLabel})` : "";
}

export function generateStockRequestResultEmailHTML(
    data: StockRequestResultEmailPayload,
    dashboardUrl: string,
): string {
    const statusText = escapeHtml(getStatusText(data.status));
    const statusColor = getStatusColor(data.status);
    const recipientName = escapeHtml(data.recipient.name);
    const requestId = escapeHtml(String(data.requestId));
    const projectCode = escapeHtml(data.projectCode);
    const actedAt = escapeHtml(formatThaiDateTime(data.actedAt));
    const dashboardHref = escapeHtml(dashboardUrl);
    const items = data.items.map((item) => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${escapeHtml(item.name)}${escapeHtml(getVariantLabel(item))}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; text-align: right;">${escapeHtml(String(item.quantity))}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${escapeHtml(item.unit)}</td>
            </tr>`).join("");
    const cancelReason = data.status === "CANCELLED"
        ? `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">เหตุผลยกเลิก:</td>
                <td colspan="2" style="padding: 8px; border-bottom: 1px solid #e9ecef;">${escapeHtml(getCancelReason(data))}</td>
            </tr>`
        : "";

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ผลคำขอเบิกวัสดุ</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
        <h2 style="color: #2c3e50; margin-top: 0; border-bottom: 2px solid ${statusColor}; padding-bottom: 10px;">
            ผลคำขอเบิกวัสดุ: <span style="color: ${statusColor};">${statusText}</span>
        </h2>

        <p>เรียน ${recipientName},</p>
        <p>คำขอเบิกวัสดุของคุณดำเนินการแล้ว โดยมีผลคือ <strong>${statusText}</strong></p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; width: 30%; color: #6c757d;">เลขที่คำขอ:</td>
                <td colspan="2" style="padding: 8px; border-bottom: 1px solid #e9ecef;">#${requestId}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">รหัสโครงการ:</td>
                <td colspan="2" style="padding: 8px; border-bottom: 1px solid #e9ecef;">${projectCode}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">วันที่ดำเนินการ:</td>
                <td colspan="2" style="padding: 8px; border-bottom: 1px solid #e9ecef;">${actedAt}</td>
            </tr>
            ${cancelReason}
        </table>

        <h3 style="color: #2c3e50;">รายการวัสดุ</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
                <tr>
                    <th style="padding: 8px; border-bottom: 2px solid #e9ecef; text-align: left;">รายการ</th>
                    <th style="padding: 8px; border-bottom: 2px solid #e9ecef; text-align: right;">จำนวน</th>
                    <th style="padding: 8px; border-bottom: 2px solid #e9ecef; text-align: left;">หน่วย</th>
                </tr>
            </thead>
            <tbody>${items}</tbody>
        </table>

        <p style="margin-top: 30px; text-align: center;">
            <a href="${dashboardHref}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                ดูรายการเบิกของฉัน
            </a>
        </p>

        <p style="font-size: 12px; color: #6c757d; margin-top: 40px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            ระบบเบิกวัสดุ NHFapp<br>
            อีเมลฉบับนี้สร้างโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ
        </p>
    </div>
</body>
</html>`;
}

export function generateStockRequestResultEmailText(
    data: StockRequestResultEmailPayload,
    dashboardUrl: string,
): string {
    const statusText = getStatusText(data.status);
    const itemLines = data.items
        .map((item) => `- ${item.name}${getVariantLabel(item)}: ${item.quantity} ${item.unit}`)
        .join("\n");
    const cancelReason = data.status === "CANCELLED"
        ? `\nเหตุผลยกเลิก: ${getCancelReason(data)}`
        : "";

    return `เรียน ${data.recipient.name},

${statusText}
เลขที่คำขอ: #${data.requestId}
รหัสโครงการ: ${data.projectCode}
วันที่ดำเนินการ: ${formatThaiDateTime(data.actedAt)}${cancelReason}

รายการวัสดุ:
${itemLines}

ดูรายการเบิกของฉัน: ${dashboardUrl}`;
}
