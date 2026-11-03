import { describe, expect, it } from "vitest";

import { generateStockLowFlexMessage } from "../infrastructure/notifications/line-messages/stock-low";
import { validateNotificationFlexMessage } from "@/__tests__/lib/notification-flex-contract";

describe("Stock low LINE Flex message", () => {
    it("should render variant label and SKU", () => {
        const message = generateStockLowFlexMessage({
            alertedAt: "2026-07-22T03:00:00.000Z",
            itemCount: 1,
            items: [{
                itemId: 10,
                variantId: 101,
                itemName: "หมึกพิมพ์",
                variantSku: "INK-BLACK",
                variantLabel: "สี: ดำ",
                quantity: 1,
                minStock: 5,
                unit: "ตลับ",
            }],
        }, "https://example.com");
        const serializedMessage = JSON.stringify(message);

        expect(validateNotificationFlexMessage(message)).toEqual([]);
        expect(message.altText).toBe("Stock: วัสดุถึงจุดแจ้งเตือนสต็อกต่ำ 1 รายการ");
        expect(serializedMessage).toContain("หมึกพิมพ์ (สี: ดำ) (INK-BLACK)");
        expect(serializedMessage).toContain("คงเหลือ 1 ตลับ | จุดแจ้งเตือน 5");
    });

    it("wraps long Thai item names and preserves the compact overflow summary", () => {
        const name = "วัสดุสำนักงานสำหรับงานประจำเดือน".repeat(5);
        const items = Array.from({ length: 4 }, (_, index) => ({
            itemId: index + 1,
            name: `${name} ${index + 1}`,
            sku: `STOCK-${index + 1}`,
            quantity: index + 1,
            minStock: index + 2,
            unit: "ชิ้น",
        }));
        const message = generateStockLowFlexMessage({
            alertedAt: "2026-11-03T03:00:00.000Z",
            itemCount: items.length,
            items,
        }, "https://example.com");
        const preview = message.contents.body?.contents[4];

        expect(validateNotificationFlexMessage(message)).toEqual([]);
        expect(Array.from(name).length).toBeLessThanOrEqual(200);
        expect(preview).toMatchObject({ type: "text", scaling: true, wrap: true });
        expect(JSON.stringify(preview)).toContain(name);
        expect(JSON.stringify(preview)).toContain("และอีก 1 รายการ");
        expect(message.contents.footer?.contents[0]).toMatchObject({
            action: {
                label: "เปิดคลังวัสดุ",
                uri: "https://example.com/dashboard/stock?stockTab=inventory",
            },
        });
    });
});
