import {
    buildNotificationFlex,
    notificationFlexDetail,
    notificationFlexText,
} from "@/lib/line/notification-flex";
import { NOTIFICATION_ACTIONS, NOTIFICATION_COLORS } from "@/shared/notifications/presentation";
import type { LineFlexMessage } from "@/types/api";
import type { StockRequestLineData } from "../../../contracts/notifications";
import { formatDate } from "@/lib/line/helpers";
import {
    STOCK_DASHBOARD_TABS,
    toDashboardStockTabPath,
} from "@/lib/ssot/routes";

function buildItemsPreview(items: StockRequestLineData["items"]): string {
    const previewItems = items.slice(0, 3).map((item) => {
        const variant = item.variantLabel ? ` (${item.variantLabel})` : "";
        return `- ${item.name}${variant} x${item.quantity} ${item.unit}`;
    });

    if (items.length > 3) {
        previewItems.push(`และอีก ${items.length - 3} รายการ`);
    }

    return previewItems.join("\n");
}

export function generateStockRequestFlexMessage(
    data: StockRequestLineData,
    baseUrl: string
): LineFlexMessage {
    const noteText = data.note?.trim() ? data.note : "-";

    return buildNotificationFlex({
        module: "Stock",
        categoryLabel: "คำขอเบิกวัสดุ",
        title: "มีคำขอเบิกวัสดุใหม่",
        altText: `มีคำขอเบิกวัสดุใหม่ #${data.requestId}`,
        contents: [
            notificationFlexText(`เลขที่คำขอ #${data.requestId}`),
            {
                type: "text",
                text: data.requesterName,
                weight: "bold",
                size: "md",
                wrap: true,
            },
            {
                type: "separator",
                margin: "md",
            },
            {
                type: "box",
                layout: "vertical",
                margin: "md",
                spacing: "sm",
                contents: [
                    notificationFlexDetail("รหัสโครงการ", data.projectCode),
                    notificationFlexDetail("จำนวนรายการ", `${data.itemCount} รายการ`),
                    notificationFlexDetail("รวมจำนวนเบิก", `${data.totalQuantity}`),
                    notificationFlexDetail("วันที่ขอ", formatDate(data.requestedAt)),
                    notificationFlexDetail("หมายเหตุ", noteText),
                ],
            },
            {
                type: "separator",
                margin: "lg",
            },
            {
                type: "text",
                text: "รายการที่ขอเบิก",
                weight: "bold",
                size: "sm",
                margin: "lg",
            },
            {
                type: "text",
                text: buildItemsPreview(data.items),
                size: "sm",
                color: NOTIFICATION_COLORS.body,
                wrap: true,
                margin: "sm",
            },
        ],
        actionLabel: NOTIFICATION_ACTIONS.review,
        actionUrl: `${baseUrl}${toDashboardStockTabPath(STOCK_DASHBOARD_TABS.adminRequests)}`,
        status: "warning",
    });
}
