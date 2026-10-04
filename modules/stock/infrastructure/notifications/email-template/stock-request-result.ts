import type { StockRequestResultEmailPayload } from "../notification-payloads";
import { formatThaiDateTime } from "@/lib/helpers/date-helpers";
import { generateNotificationEmailHTML, type NotificationEmailDetail } from "@/lib/email/templates/notification";
import { NOTIFICATION_ACTIONS, NOTIFICATION_FOOTER } from "@/shared/notifications/presentation";

function getStatusText(status: StockRequestResultEmailPayload["status"]): string {
    return status === "ISSUED"
        ? "คำขอเบิกวัสดุถูกจ่ายแล้ว"
        : "คำขอเบิกวัสดุถูกยกเลิก";
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
    const details: NotificationEmailDetail[] = [
        { label: "เลขที่คำขอ", value: `#${data.requestId}` },
        { label: "รหัสโครงการ", value: data.projectCode },
        { label: "วันที่ดำเนินการ", value: formatThaiDateTime(data.actedAt) },
    ];
    if (data.status === "CANCELLED") details.push({ label: "เหตุผลยกเลิก", value: getCancelReason(data) });
    details.push({ label: "รายการวัสดุ", value: data.items.map((item) => `${item.name}${getVariantLabel(item)}: ${item.quantity} ${item.unit}`).join("\n") });
    return generateNotificationEmailHTML({ module: "Stock", categoryLabel: "คำขอเบิกวัสดุ",
        title: getStatusText(data.status), intro: `เรียน ${data.recipient.name}\nตรวจสอบผลการดำเนินการคำขอเบิกวัสดุของคุณได้ด้านล่าง`,
        details, actionLabel: NOTIFICATION_ACTIONS.details, actionUrl: dashboardUrl });
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

${NOTIFICATION_ACTIONS.details}: ${dashboardUrl}\n\n${NOTIFICATION_FOOTER}`;
}
