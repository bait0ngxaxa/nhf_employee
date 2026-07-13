import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    sendEmail,
    sendLeaveActionNotification,
    sendNewTicketNotification,
} from "@/lib/email";
import type { TicketEmailData } from "@/types/api";

// Mock nodemailer with factory
const sendMailMock = vi.fn();
const verifyMock = vi.fn();
const createTransportMock = vi.fn().mockReturnValue({
    sendMail: sendMailMock,
    verify: verifyMock,
});

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
        it("should send email successfully", async () => {
            const result = await sendEmail({
                to: "t",
                subject: "s",
                html: "h",
                text: "t",
            });
            expect(result).toBe(true);
            expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
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
    });

    describe("sendNewTicketNotification", () => {
        it("should send notification", async () => {
            const ticketData: TicketEmailData = {
                ticketId: 1,
                title: "Issue",
                description: "Desc",
                category: "HARDWARE",
                status: "OPEN",
                priority: "HIGH",
                reportedBy: { email: "u@t.c", name: "User" },
                createdAt: new Date().toISOString(),
            };
            await sendNewTicketNotification(ticketData);
            expect(sendMailMock).toHaveBeenCalledWith(
                expect.objectContaining({ to: "u@t.c" }),
            );
        });
    });

    describe("sendLeaveActionNotification", () => {
        const payload = {
            leaveId: "leave-1",
            deliveryIdentity: "leave-1:20",
            employee: {
                employeeId: 10,
                userId: 100,
                email: "employee@thainhf.org",
                name: "พนักงาน ทดสอบ",
            },
            approver: {
                employeeId: 20,
                userId: 200,
                email: "approver@thainhf.org",
                name: "ผู้อนุมัติ เดิม",
            },
            leaveType: "VACATION" as const,
            startDate: "2031-05-05T00:00:00.000Z",
            endDate: "2031-05-05T00:00:00.000Z",
            period: "FULL_DAY" as const,
            durationDays: 1,
            reason: "พักร้อน",
            emergencyReason: null,
            specialReason: null,
            overQuotaDays: 0,
        };

        it("reuses Message-ID when retrying the same approver", async () => {
            await sendLeaveActionNotification(payload, "https://example.test");
            await sendLeaveActionNotification(payload, "https://example.test");

            const firstMessageId = sendMailMock.mock.calls[0][0].messageId;
            const retryMessageId = sendMailMock.mock.calls[1][0].messageId;
            expect(retryMessageId).toBe(firstMessageId);
            expect(firstMessageId).toContain("-200@");
        });

        it("changes Message-ID when the approver changes", async () => {
            await sendLeaveActionNotification(payload, "https://example.test");
            await sendLeaveActionNotification({
                ...payload,
                deliveryIdentity: "leave-1:30",
                approver: {
                    ...payload.approver,
                    employeeId: 30,
                    userId: 300,
                    email: "new-approver@thainhf.org",
                },
            }, "https://example.test");

            const previousMessageId = sendMailMock.mock.calls[0][0].messageId;
            const nextMessageId = sendMailMock.mock.calls[1][0].messageId;
            expect(nextMessageId).not.toBe(previousMessageId);
            expect(nextMessageId).toContain("-300@");
        });
    });
});
