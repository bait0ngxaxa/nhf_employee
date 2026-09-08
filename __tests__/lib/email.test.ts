import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendEmail } from "@/lib/email";

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

describe("Email transport", () => {
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

    it("sends email successfully", async () => {
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

    it("retries transient failures", { timeout: 15000 }, async () => {
        vi.useFakeTimers();
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

        await vi.advanceTimersByTimeAsync(3000);
        await vi.advanceTimersByTimeAsync(5000);

        expect(await promise).toBe(true);
        expect(sendMailMock).toHaveBeenCalledTimes(3);
        vi.useRealTimers();
    });

    it("fails after the maximum retries", { timeout: 15000 }, async () => {
        vi.useFakeTimers();
        sendMailMock.mockRejectedValue(new Error("Fail always"));

        const promise = sendEmail({
            to: "t",
            subject: "s",
            html: "h",
            text: "t",
        });

        await vi.advanceTimersByTimeAsync(10000);

        expect(await promise).toBe(false);
        expect(sendMailMock).toHaveBeenCalledTimes(3);
        vi.useRealTimers();
    });

    it("does not expose the SMTP password in error logs", async () => {
        vi.useFakeTimers();
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        sendMailMock.mockRejectedValue(
            new Error("SMTP authentication failed for pass"),
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
            expect(loggedValues).not.toContain("pass");
        } finally {
            consoleErrorSpy.mockRestore();
            vi.useRealTimers();
        }
    });
});
