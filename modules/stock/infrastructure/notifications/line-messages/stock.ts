import { buildNotificationFlex, notificationFlexText } from "@/lib/line/notification-flex";
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
                    {
                        type: "box",
                        layout: "baseline",
                        contents: [
                            {
                                type: "text",
                                text: "รหัสโครงการ:",
                                color: "#4B5563",
                                size: "sm",
                                flex: 2,
                            },
                            {
                                type: "text",
                                text: data.projectCode,
                                color: "#111827",
                                size: "sm",
                                wrap: true,
                                flex: 3,
                            },
                        ],
                    },
                    {
                        type: "box",
                        layout: "baseline",
                        contents: [
                            {
                                type: "text",
                                text: "จำนวนรายการ:",
                                color: "#4B5563",
                                size: "sm",
                                flex: 2,
                            },
                            {
                                type: "text",
                                text: `${data.itemCount} รายการ`,
                                color: "#111827",
                                size: "sm",
                                flex: 3,
                            },
                        ],
                    },
                    {
                        type: "box",
                        layout: "baseline",
                        contents: [
                            {
                                type: "text",
                                text: "รวมจำนวนเบิก:",
                                color: "#4B5563",
                                size: "sm",
                                flex: 2,
                            },
                            {
                                type: "text",
                                text: `${data.totalQuantity}`,
                                color: "#111827",
                                size: "sm",
                                flex: 3,
                            },
                        ],
                    },
                    {
                        type: "box",
                        layout: "baseline",
                        contents: [
                            {
                                type: "text",
                                text: "วันที่ขอ:",
                                color: "#4B5563",
                                size: "sm",
                                flex: 2,
                            },
                            {
                                type: "text",
                                text: formatDate(data.requestedAt),
                                color: "#111827",
                                size: "sm",
                                wrap: true,
                                flex: 3,
                            },
                        ],
                    },
                    {
                        type: "box",
                        layout: "baseline",
                        contents: [
                            {
                                type: "text",
                                text: "หมายเหตุ:",
                                color: "#4B5563",
                                size: "sm",
                                flex: 2,
                            },
                            {
                                type: "text",
                                text: noteText,
                                color: "#111827",
                                size: "sm",
                                wrap: true,
                                flex: 3,
                            },
                        ],
                    },
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
                color: "#374151",
                wrap: true,
                margin: "sm",
            },
        ],
        actionLabel: NOTIFICATION_ACTIONS.review,
        actionUrl: `${baseUrl}${toDashboardStockTabPath(STOCK_DASHBOARD_TABS.adminRequests)}`,
        accentColor: "#047857",
    });
}
