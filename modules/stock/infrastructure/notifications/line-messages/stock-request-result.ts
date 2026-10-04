import { buildNotificationFlex, notificationFlexText } from "@/lib/line/notification-flex";
import { NOTIFICATION_ACTIONS } from "@/shared/notifications/presentation";
import type { LineFlexMessage } from "@/types/api";

import type { StockRequestResultLinePayload } from "../notification-payloads";
import { formatDate } from "@/lib/line/helpers";

function buildItemsPreview(
    items: StockRequestResultLinePayload["items"],
): string {
    const preview = items.slice(0, 3).map((item) => {
        const variant = item.variantLabel ? ` (${item.variantLabel})` : "";
        return `${item.name}${variant} x${item.quantity} ${item.unit}`;
    });
    if (items.length > 3) {
        preview.push(`และอีก ${items.length - 3} รายการ`);
    }
    return preview.join("\n");
}

export function generateStockRequestResultFlexMessage(
    payload: StockRequestResultLinePayload,
    actionUrl: string,
): LineFlexMessage {
    const isIssued = payload.status === "ISSUED";
    const statusLabel = isIssued ? "จ่ายแล้ว" : "ยกเลิกแล้ว";
    const statusColor = isIssued ? "#047857" : "#B91C1C";
    const detailLines = [
        `โครงการ: ${payload.projectCode}`,
        `ดำเนินการเมื่อ: ${formatDate(payload.actedAt)}`,
        `สถานะ: ${statusLabel}`,
    ];
    if (!isIssued && payload.cancelReason) {
        detailLines.push(`เหตุผล: ${payload.cancelReason}`);
    }

    return buildNotificationFlex({
        module: "Stock",
        categoryLabel: "คำขอเบิกวัสดุ",
        title: isIssued ? "คำขอเบิกวัสดุถูกจ่ายแล้ว" : "คำขอเบิกวัสดุถูกยกเลิก",
        altText: `คำขอเบิกวัสดุ #${payload.requestId} ${isIssued ? "ถูกจ่ายแล้ว" : "ถูกยกเลิก"}`,
        contents: [
            notificationFlexText(`เลขที่คำขอ #${payload.requestId}`),
            {
                type: "text",
                text: payload.recipient.name,
                weight: "bold",
                size: "md",
                wrap: true,
            },
            ...detailLines.map((text) => ({
                type: "text" as const,
                text,
                color: text.startsWith("สถานะ") ? statusColor : "#374151",
                size: "sm" as const,
                wrap: true,
            })),
            {
                type: "separator",
                margin: "md",
            },
            {
                type: "text",
                text: "รายการ",
                weight: "bold",
                size: "sm",
                margin: "md",
            },
            {
                type: "text",
                text: buildItemsPreview(payload.items),
                color: "#374151",
                size: "sm",
                wrap: true,
            },
        ],
        actionLabel: NOTIFICATION_ACTIONS.details,
        actionUrl,
        accentColor: statusColor,
    });
}
