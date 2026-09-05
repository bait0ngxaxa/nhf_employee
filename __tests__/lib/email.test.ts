import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    sendEmail,
    sendStockRequestResultNotification,
} from "@/lib/email";
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

describe("Email Service", () => {
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

    describe("sendEmail", () => {
        it("requires SMTP TLS certificate verification", async () => {
            await sendEmail({
                to: "t",
                subject: "s",
                html: "h",
                text: "t",
            });

            expect(createTransportMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    tls: { rejectUnauthorized: true },
                }),
            );
        });

        it("should send email successfully", async () => {
            const result = await sendEmail({
                to: "t",
                subject: "s",
                html: "h",
                text: "t",
            });
            expect(result).toBe(true);
            expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
                from: '"NHFapp" <user>',
                messageId: undefined,
            }));
        });

        it("should retry on failure", { timeout: 15000 }, async () => {
            vi.useFakeTimers();

            // Should fail twice then succeed
            sendMailMock
                .mockRejectedValueOnce(new Error("Fail 1"))
                .mockRejectedValueOnce(new Error("Fail 2"))
                .mockResolvedValueOnce({ messageId: "OK" } as never);

            const promise = sendEmail({
                to: "t",
                subject: "s",
                html: "h",
                text: "t",
            });

            // Fast forward time for retries
            // Attempt 1 -> Fail -> Wait 2000ms (2^1 * 1000)
            await vi.advanceTimersByTimeAsync(3000);
            // Attempt 2 -> Fail -> Wait 4000ms (2^2 * 1000)
            await vi.advanceTimersByTimeAsync(5000);
            // Attempt 3 -> Success

            const result = await promise;

            expect(result).toBe(true);
            expect(sendMailMock).toHaveBeenCalledTimes(3);

            vi.useRealTimers();
        });

        it("should fail after max retries", { timeout: 15000 }, async () => {
            vi.useFakeTimers();
            sendMailMock.mockRejectedValue(new Error("Fail always"));

            const promise = sendEmail({
                to: "t",
                subject: "s",
                html: "h",
                text: "t",
            });

            // Advance enough time for 3 retries
            await vi.advanceTimersByTimeAsync(10000);

            const result = await promise;
            expect(result).toBe(false);
            expect(sendMailMock).toHaveBeenCalledTimes(3);

            vi.useRealTimers();
        });

        it("does not expose the SMTP password in error logs", async () => {
            vi.useFakeTimers();
            const smtpPassword = "pass";
            const consoleErrorSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => undefined);
            sendMailMock.mockRejectedValue(
                new Error(`SMTP authentication failed for ${smtpPassword}`),
            );

            try {
                const promise = sendEmail({
                    to: "t",
                    subject: "s",
                    html: "h",
                    text: "t",
                });

                await vi.advanceTimersByTimeAsync(10000);
                expect(await promise).toBe(false);

                const loggedValues = consoleErrorSpy.mock.calls
                    .flat()
                    .map(String)
                    .join(" ");
                expect(loggedValues).not.toContain(smtpPassword);
            } finally {
                consoleErrorSpy.mockRestore();
                vi.useRealTimers();
            }
        });
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
