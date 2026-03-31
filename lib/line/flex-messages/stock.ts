import {
    type LineFlexMessage,
    type StockRequestLineData,
} from "@/types/api";
import { formatDate } from "../helpers";

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

    return {
        type: "flex",
        altText: `มีคำขอเบิกวัสดุใหม่ #${data.requestId}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "มีคำขอเบิกวัสดุใหม่",
                        weight: "bold",
                        color: "#ffffff",
                        size: "xl",
                    },
                    {
                        type: "text",
                        text: `เลขที่คำขอ #${data.requestId}`,
                        color: "#d1fae5",
                        size: "sm",
                        margin: "sm"
                    },
                ],
                backgroundColor: "#059669",
                paddingAll: "20px",
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: data.requesterName,
                        weight: "bold",
                        size: "lg",
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
                                        color: "#666666",
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
                                        color: "#666666",
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
                                        color: "#666666",
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
                                        color: "#666666",
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
                                        color: "#666666",
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
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: "ดูคำขอเบิก",
                            uri: `${baseUrl}/dashboard?tab=stock&stockTab=admin-requests`,
                        },
                        color: "#059669",
                    },
                    {
                        type: "spacer",
                        size: "sm",
                    },
                ],
            },
        },
    };
}
