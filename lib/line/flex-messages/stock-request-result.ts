import type { LineFlexMessage } from "@/types/api";

import type { StockRequestResultLinePayload } from "@/modules/stock";
import { formatDate } from "../helpers";

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

    return {
        type: "flex",
        altText: `คำขอเบิก #${payload.requestId}${statusLabel}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: isIssued
                            ? "คำขอเบิกวัสดุถูกจ่ายแล้ว"
                            : "คำขอเบิกวัสดุถูกยกเลิก",
                        weight: "bold",
                        color: "#FFFFFF",
                        size: "lg",
                        wrap: true,
                    },
                    {
                        type: "text",
                        text: `เลขที่คำขอ #${payload.requestId}`,
                        color: "#FFFFFF",
                        size: "sm",
                        margin: "sm",
                    },
                ],
                backgroundColor: statusColor,
                paddingAll: "20px",
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "text",
                        text: payload.recipient.name,
                        weight: "bold",
                        size: "lg",
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
                            label: "เปิดรายละเอียด",
                            uri: actionUrl,
                        },
                        color: statusColor,
                    },
                ],
            },
        },
    };
}
