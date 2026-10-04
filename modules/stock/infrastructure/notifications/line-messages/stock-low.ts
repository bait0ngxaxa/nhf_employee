import { buildNotificationFlex, notificationFlexText } from "@/lib/line/notification-flex";
import { NOTIFICATION_ACTIONS } from "@/shared/notifications/presentation";
import type { LineFlexMessage } from "@/types/api";
import type { StockLowLineData } from "../../../contracts/notifications";
import { formatDate } from "@/lib/line/helpers";
import {
    STOCK_DASHBOARD_TABS,
    toDashboardStockTabPath,
} from "@/lib/ssot/routes";

function buildItemsPreview(items: StockLowLineData["items"]): string {
    const previewItems = items.slice(0, 3).map((item) => {
        const name = "variantId" in item
            ? `${item.itemName} (${item.variantLabel})`
            : item.name;
        const sku = "variantId" in item ? item.variantSku : item.sku;
        return `${name} (${sku})\nคงเหลือ ${item.quantity} ${item.unit} | จุดแจ้งเตือน ${item.minStock}`;
    });

    if (items.length > 3) {
        previewItems.push(`และอีก ${items.length - 3} รายการ`);
    }

    return previewItems.join("\n\n");
}

export function generateStockLowFlexMessage(
    data: StockLowLineData,
    baseUrl: string,
): LineFlexMessage {
    return buildNotificationFlex({
        module: "Stock",
        categoryLabel: "คลังวัสดุ",
        title: "วัสดุถึงจุดแจ้งเตือนสต็อกต่ำ",
        altText: `วัสดุถึงจุดแจ้งเตือนสต็อกต่ำ ${data.itemCount} รายการ`,
        contents: [
            notificationFlexText(`แจ้งเตือนเมื่อ ${formatDate(data.alertedAt)}`),
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
        actionLabel: NOTIFICATION_ACTIONS.inventory,
        actionUrl: `${baseUrl}${toDashboardStockTabPath(STOCK_DASHBOARD_TABS.inventory)}`,
        accentColor: "#C2410C",
    });
}
