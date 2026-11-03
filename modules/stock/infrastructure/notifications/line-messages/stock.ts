import {
    buildNotificationFlex,
    notificationFlexDetail,
    notificationFlexText,
} from "@/lib/line/notification-flex";
import { NOTIFICATION_ACTIONS } from "@/shared/notifications/presentation";
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
            notificationFlexDetail("เลขที่คำขอ", `#${data.requestId}`),
            notificationFlexText(data.requesterName, { weight: "bold", size: "md" }),
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
                    notificationFlexDetail("หมายเหตุ", noteText, "stacked"),
                ],
            },
            {
                type: "separator",
                margin: "lg",
            },
            notificationFlexText("รายการที่ขอเบิก", { weight: "bold", margin: "lg" }),
            notificationFlexText(buildItemsPreview(data.items), { margin: "sm" }),
        ],
        actionLabel: NOTIFICATION_ACTIONS.review,
        actionUrl: `${baseUrl}${toDashboardStockTabPath(STOCK_DASHBOARD_TABS.adminRequests)}`,
        status: "warning",
    });
}
