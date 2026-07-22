import { describe, expect, it } from "vitest";

import { generateStockLowFlexMessage } from "@/lib/line/flex-messages/stock-low";

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

        expect(message.altText).toBe("สต็อกต่ำถึงจุดสั่งซื้อ: หมึกพิมพ์");
        expect(serializedMessage).toContain("หมึกพิมพ์ (สี: ดำ) (INK-BLACK)");
        expect(serializedMessage).toContain("คงเหลือ 1 ตลับ | จุดสั่งซื้อ 5");
    });
});
