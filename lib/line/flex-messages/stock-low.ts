import {
    type LineFlexMessage,
    type StockLowLineData,
} from "@/types/api";
import { formatDate } from "../helpers";

function buildItemsPreview(items: StockLowLineData["items"]): string {
    const previewItems = items.slice(0, 3).map((item) => {
        return `${item.name} (${item.sku})\nคงเหลือ ${item.quantity} ${item.unit} | จุดสั่งซื้อ ${item.minStock}`;
    });

    if (items.length > 3) {
        previewItems.push(`และอีก ${items.length - 3} รายการ`);
    }

    return previewItems.join("\n\n");
}

function getAltText(data: StockLowLineData): string {
    if (data.itemCount === 1) {
        return `สต็อกต่ำถึงจุดสั่งซื้อ: ${data.items[0]?.name ?? ""}`;
    }

    return `มี ${data.itemCount} รายการสต็อกต่ำถึงจุดสั่งซื้อ`;
}

function getHeaderText(data: StockLowLineData): string {
    return data.itemCount === 1
        ? "สต็อกถึงจุดสั่งซื้อ"
        : "มีหลายรายการถึงจุดสั่งซื้อ";
}

export function generateStockLowFlexMessage(
    data: StockLowLineData,
    baseUrl: string,
): LineFlexMessage {
    return {
        type: "flex",
        altText: getAltText(data),
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: getHeaderText(data),
                        weight: "bold",
                        color: "#FFFFFF",
                        size: "lg",
                    },
                    {
                        type: "text",
                        text: `แจ้งเตือนเมื่อ ${formatDate(data.alertedAt)}`,
                        color: "#DBEAFE",
                        size: "sm",
                        wrap: true,
                    },
                ],
                backgroundColor: "#B45309",
                paddingAll: "20px",
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: `จำนวนรายการที่ต้องติดตาม ${data.itemCount} รายการ`,
                        weight: "bold",
                        size: "md",
                        wrap: true,
                    },
                    {
                        type: "separator",
                        margin: "md",
                    },
                    {
                        type: "text",
                        text: buildItemsPreview(data.items),
                        size: "sm",
                        color: "#374151",
                        wrap: true,
                        margin: "md",
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
                            label: "เปิดหน้าคลังวัสดุ",
                            uri: `${baseUrl}/dashboard?tab=stock&stockTab=inventory`,
                        },
                        color: "#2563EB",
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
