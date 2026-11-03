import {
    buildNotificationFlex,
    notificationFlexStatus,
    notificationFlexText,
} from "@/lib/line/notification-flex";
import { NOTIFICATION_ACTIONS, NOTIFICATION_COLORS } from "@/shared/notifications/presentation";
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
    const status = isIssued ? "success" : "danger";

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
            notificationFlexText(`โครงการ: ${payload.projectCode}`),
            notificationFlexText(`ดำเนินการเมื่อ: ${formatDate(payload.actedAt)}`),
            notificationFlexStatus(`สถานะ: ${statusLabel}`, status),
            ...(!isIssued && payload.cancelReason
                ? [notificationFlexText(`เหตุผล: ${payload.cancelReason}`)]
                : []),
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
                color: NOTIFICATION_COLORS.body,
                size: "sm",
                wrap: true,
            },
        ],
        actionLabel: NOTIFICATION_ACTIONS.details,
        actionUrl,
        status,
    });
}
