import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { sendEmail, sendNewTicketNotification } from "@/lib/email";

// Mock nodemailer with factory
const sendMailMock = vi.fn();
const verifyMock = vi.fn();
const createTransportMock = vi.fn().mockReturnValue({
    sendMail: sendMailMock,
    verify: verifyMock,
});

vi.mock("nodemailer", () => ({
    default: {
        createTransport: (...args: any[]) => createTransportMock(...args),
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
        it("should send email successfully", async () => {
            const result = await sendEmail({
                to: "t",
                subject: "s",
                html: "h",
                text: "t",
            });
            expect(result).toBe(true);
            expect(sendMailMock).toHaveBeenCalled();
        });

        it("should retry on failure", { timeout: 15000 }, async () => {
            vi.useFakeTimers();

            // Should fail twice then succeed
            sendMailMock
                .mockRejectedValueOnce(new Error("Fail 1") as any)
                .mockRejectedValueOnce(new Error("Fail 2") as any)
                .mockResolvedValueOnce({ messageId: "OK" } as any);

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
    });

    describe("sendNewTicketNotification", () => {
        it("should send notification", async () => {
            const ticketData = {
                ticketId: 1,
                title: "Issue",
                description: "Desc",
                status: "OPEN",
                priority: "HIGH",
                reportedBy: { email: "u@t.c", name: "User" },
                createdAt: new Date().toISOString(),
            };
            await sendNewTicketNotification(ticketData as any);
            expect(sendMailMock).toHaveBeenCalledWith(
                expect.objectContaining({ to: "u@t.c" }),
            );
        });
    });
});
