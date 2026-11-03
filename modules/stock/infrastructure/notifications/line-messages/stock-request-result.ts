import {
    buildNotificationFlex,
    notificationFlexDetail,
    notificationFlexStatus,
    notificationFlexText,
} from "@/lib/line/notification-flex";
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
    const status = isIssued ? "success" : "danger";

    return buildNotificationFlex({
        module: "Stock",
        categoryLabel: "คำขอเบิกวัสดุ",
        title: isIssued ? "คำขอเบิกวัสดุถูกจ่ายแล้ว" : "คำขอเบิกวัสดุถูกยกเลิก",
        altText: `คำขอเบิกวัสดุ #${payload.requestId} ${isIssued ? "ถูกจ่ายแล้ว" : "ถูกยกเลิก"}`,
        contents: [
            notificationFlexDetail("เลขที่คำขอ", `#${payload.requestId}`),
            notificationFlexText(payload.recipient.name, { weight: "bold", size: "md" }),
            notificationFlexDetail("โครงการ", payload.projectCode),
            notificationFlexDetail("ดำเนินการเมื่อ", formatDate(payload.actedAt)),
            notificationFlexStatus(`สถานะ: ${statusLabel}`, status),
            ...(!isIssued && payload.cancelReason
                ? [notificationFlexDetail("เหตุผล", payload.cancelReason, "stacked")]
                : []),
            {
                type: "separator",
                margin: "md",
            },
            notificationFlexText("รายการ", { weight: "bold", margin: "md" }),
            notificationFlexText(buildItemsPreview(payload.items)),
        ],
        actionLabel: NOTIFICATION_ACTIONS.details,
        actionUrl,
        status,
    });
}
