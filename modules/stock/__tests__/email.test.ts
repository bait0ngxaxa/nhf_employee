import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendStockRequestResultNotification } from "@/modules/stock";
import type { StockRequestResultEmailPayload } from "@/modules/stock";

// Mock nodemailer with factory
const sendMailMock = vi.fn();
const verifyMock = vi.fn();
const createTransportMock = vi.fn().mockReturnValue({
    sendMail: sendMailMock,
    verify: verifyMock,
});

function buildStockRequestResultPayload(
    status: StockRequestResultEmailPayload["status"],
): StockRequestResultEmailPayload {
    return {
        schemaVersion: 1,
        requestId: 123,
        status,
        projectCode: "PRJ-2569/01",
        recipient: {
            userId: 3,
            name: "สมชาย",
            email: "somchai@example.com",
        },
        items: [{
            name: "กระดาษ",
            quantity: 2,
            unit: "รีม",
            variantLabel: "ขนาด: A4",
        }],
        cancelReason: status === "CANCELLED" ? "มีวัสดุทดแทนแล้ว" : null,
        actedAt: "2026-07-01T03:00:00.000Z",
    };
}

vi.mock("nodemailer", () => ({
    default: {
        createTransport: (...args: unknown[]) => createTransportMock(...args),
    },
}));

describe("Stock email notifications", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SMTP_USER = "user";
        process.env.SMTP_PASS = "pass";
        process.env.SMTP_HOST = "smtp.test";
        process.env.SMTP_PORT = "587";

        verifyMock.mockResolvedValue(true);
        sendMailMock.mockResolvedValue({ messageId: "123" });
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe("sendStockRequestResultNotification", () => {
        it("sends an issued result with a deterministic Message-ID and dashboard URL", async () => {
            await sendStockRequestResultNotification(
                buildStockRequestResultPayload("ISSUED"),
            );

            expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
                from: '"ระบบเบิกวัสดุ NHFapp" <user>',
                to: "somchai@example.com",
                subject: "[NHF Stock] คำขอเบิก #123 ถูกจ่ายเรียบร้อยแล้ว",
                messageId: "<nhf-stock-request-123-issued@notifications.thainhf.org>",
                text: expect.stringContaining(
                    "ดูรายการเบิกของฉัน: http://localhost:3000/dashboard/stock?stockTab=my-requests",
                ),
                html: expect.stringContaining(
                    "ขนาด: A4",
                ),
            }));
        });

        it("sends a cancelled result with the cancellation reason", async () => {
            await sendStockRequestResultNotification(
                buildStockRequestResultPayload("CANCELLED"),
            );

            expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
                subject: "[NHF Stock] คำขอเบิก #123 ถูกยกเลิก",
                messageId: "<nhf-stock-request-123-cancelled@notifications.thainhf.org>",
                text: expect.stringContaining("เหตุผลยกเลิก: มีวัสดุทดแทนแล้ว"),
                html: expect.stringContaining("มีวัสดุทดแทนแล้ว"),
            }));
        });

        it("uses a safe fallback when a cancelled result has no reason", async () => {
            await sendStockRequestResultNotification({
                ...buildStockRequestResultPayload("CANCELLED"),
                cancelReason: null,
            });

            expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
                text: expect.stringContaining("เหตุผลยกเลิก: ไม่ได้ระบุเหตุผล"),
                html: expect.stringContaining("เหตุผลยกเลิก:</td>"),
            }));
            expect(sendMailMock.mock.calls.at(-1)?.[0].html).toContain(
                "ไม่ได้ระบุเหตุผล",
            );
        });
    });

});
