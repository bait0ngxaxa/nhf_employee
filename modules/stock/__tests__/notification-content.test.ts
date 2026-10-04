import { describe, expect, it } from "vitest";
import { generateStockRequestFlexMessage } from "../infrastructure/notifications/line-messages/stock";
import { generateStockRequestResultFlexMessage } from "../infrastructure/notifications/line-messages/stock-request-result";
import { generateStockLowFlexMessage } from "../infrastructure/notifications/line-messages/stock-low";

describe("Stock LINE presentation", () => {
    it("keeps operational request destination and review intent", () => {
        const message = generateStockRequestFlexMessage({ requestId: 123, requesterName: "ผู้ขอ", projectCode: "PRJ",
            requestedAt: "2026-07-01T03:00:00Z", note: null, itemCount: 1, totalQuantity: 2,
            items: [{ name: "กระดาษ", quantity: 2, unit: "รีม" }] }, "https://app.example.com");
        expect(message.altText).toBe("Stock: มีคำขอเบิกวัสดุใหม่ #123");
        expect(message.contents.body?.contents[0]).toMatchObject({ text: "มีคำขอเบิกวัสดุใหม่" });
        expect(message.contents.footer?.contents[0]).toMatchObject({ action: { label: "ตรวจสอบคำขอ", uri: "https://app.example.com/dashboard/stock?stockTab=admin-requests" } });
    });

    it.each(["ISSUED", "CANCELLED"] as const)("shows factual %s status and preserves personal result destination", (status) => {
        const message = generateStockRequestResultFlexMessage({ schemaVersion: 1, requestId: 123, status,
            projectCode: "PRJ", recipient: { userId: 3, name: "ผู้ขอ", email: "private@example.com" },
            items: [{ name: "กระดาษ", quantity: 2, unit: "รีม" }], cancelReason: status === "CANCELLED" ? "มีวัสดุทดแทน" : null,
            actedAt: "2026-07-01T03:00:00Z", retryKey: "retry" }, "https://liff.line.me/app/stock?requestId=123");
        expect(message.altText).toBe(`Stock: คำขอเบิกวัสดุ #123 ${status === "ISSUED" ? "ถูกจ่ายแล้ว" : "ถูกยกเลิก"}`);
        expect(message.contents.header?.contents[0]).toMatchObject({ text: "NHFapp | Stock · คำขอเบิกวัสดุ" });
        expect(message.contents.footer?.contents[0]).toMatchObject({ action: { label: "เปิดรายละเอียด", uri: "https://liff.line.me/app/stock?requestId=123" } });
        expect(JSON.stringify(message)).not.toContain("private@example.com");
        expect(JSON.stringify(message)).not.toContain("retry");
    });

    it("describes the low-stock threshold consistently without adding an audience", () => {
        const message = generateStockLowFlexMessage({ alertedAt: "2026-07-01T03:00:00Z", itemCount: 1,
            items: [{ itemId: 1, name: "กระดาษ", sku: "PAPER", quantity: 2, minStock: 3, unit: "รีม" }] }, "https://app.example.com");
        expect(message.altText).toBe("Stock: วัสดุถึงจุดแจ้งเตือนสต็อกต่ำ 1 รายการ");
        expect(message.contents.body?.contents[0]).toMatchObject({ text: "วัสดุถึงจุดแจ้งเตือนสต็อกต่ำ" });
        expect(message.contents.footer?.contents[0]).toMatchObject({ action: { label: "เปิดคลังวัสดุ", uri: "https://app.example.com/dashboard/stock?stockTab=inventory" } });
    });
});
