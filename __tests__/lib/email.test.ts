import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendEmail } from "@/lib/email";
import { SMTP_MAX_SEND_ATTEMPTS } from "@/lib/email/smtp";
import {
    OUTBOUND_HTTP_TIMEOUT_MS,
    OUTBOUND_SMTP_TIMEOUTS,
} from "@/lib/network/outbound-http";

const sendMailMock = vi.fn();
const verifyMock = vi.fn();
const closeMock = vi.fn();
const createTransportMock = vi.fn().mockReturnValue({
    sendMail: sendMailMock,
    verify: verifyMock,
    close: closeMock,
});

vi.mock("nodemailer", () => ({
    default: {
        createTransport: (...args: unknown[]) => createTransportMock(...args),
    },
}));

describe("Email transport", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.EMAIL_PROVIDER = "smtp";
        process.env.SMTP_USER = "user@example.test";
        process.env.SMTP_PASS = "smtp-test-password";
        process.env.SMTP_HOST = "smtp.test";
        process.env.SMTP_PORT = "587";
        process.env.MICROSOFT_CLIENT_SECRET = "graph-test-secret";
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
            from: '"NHFapp" <user@example.test>',
            messageId: undefined,
        }));
    });

    it("preserves the supplied Message-ID on a successful SMTP send", async () => {
        const messageId = "<nhf-stable@example.test>";

        const result = await sendEmail({
            to: "t",
            subject: "s",
            html: "h",
            text: "t",
            messageId,
        });

        expect(result).toBe(true);
        expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
            messageId,
        }));
    });

    it("reconnects after a transient failure and retries successfully", { timeout: 15000 }, async () => {
        vi.useFakeTimers();
        sendMailMock
            .mockRejectedValueOnce(
                Object.assign(new Error("connection reset"), {
                    code: "ECONNRESET",
                }),
            )
            .mockResolvedValueOnce({ messageId: "OK" } as never);

        const promise = sendEmail({
            to: "t",
            subject: "s",
            html: "h",
            text: "t",
            messageId: "<nhf-retry@example.test>",
        });

        await vi.advanceTimersByTimeAsync(3000);

        expect(await promise).toBe(true);
        expect(sendMailMock).toHaveBeenCalledTimes(2);
        expect(sendMailMock.mock.calls[0]?.[0].messageId).toBe(
            sendMailMock.mock.calls[1]?.[0].messageId,
        );
        expect(verifyMock).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it("keeps the same Message-ID across an ambiguous timeout retry", { timeout: 15000 }, async () => {
        vi.useFakeTimers();
        sendMailMock
            .mockRejectedValueOnce(
                Object.assign(new Error("timeout after acceptance"), {
                    code: "ETIMEDOUT",
                }),
            )
            .mockResolvedValueOnce({ messageId: "OK" } as never);

        const promise = sendEmail({
            to: "t",
            subject: "s",
            html: "h",
            text: "t",
            messageId: "<nhf-ambiguous@example.test>",
        });

        await vi.advanceTimersByTimeAsync(3000);

        expect(await promise).toBe(true);
        expect(sendMailMock).toHaveBeenCalledTimes(2);
        expect(sendMailMock.mock.calls[0]?.[0].messageId).toBe(
            sendMailMock.mock.calls[1]?.[0].messageId,
        );
        vi.useRealTimers();
    });

    it("returns false after repeated transient failures", { timeout: 15000 }, async () => {
        vi.useFakeTimers();
        sendMailMock.mockRejectedValue(
            Object.assign(new Error("temporary SMTP outage"), {
                code: "ECONNRESET",
            }),
        );

        const promise = sendEmail({
            to: "t",
            subject: "s",
            html: "h",
            text: "t",
            messageId: "<nhf-transient@example.test>",
        });

        await vi.advanceTimersByTimeAsync(20000);

        expect(await promise).toBe(false);
        expect(sendMailMock).toHaveBeenCalledTimes(3);
        vi.useRealTimers();
    });

    it("returns false after repeated non-transient failures", { timeout: 15000 }, async () => {
        vi.useFakeTimers();
        sendMailMock.mockRejectedValue(
            Object.assign(new Error("authentication rejected"), {
                code: "EAUTH",
            }),
        );

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

    it("bounds SMTP connection, greeting and socket idle time with the shared outbound timeout", async () => {
        // Fresh module: the SMTP transporter is cached at module level.
        vi.resetModules();
        const { sendEmail: sendWithFreshTransporter } = await import("@/lib/email");

        await sendWithFreshTransporter({
            to: "t",
            subject: "s",
            html: "h",
            text: "t",
        });

        expect(createTransportMock).toHaveBeenCalledWith(
            expect.objectContaining({
                connectionTimeout: OUTBOUND_HTTP_TIMEOUT_MS,
                greetingTimeout: OUTBOUND_HTTP_TIMEOUT_MS,
                socketTimeout: OUTBOUND_HTTP_TIMEOUT_MS,
                pool: true,
                maxConnections: 5,
                maxMessages: 100,
                rateDelta: 1000,
                rateLimit: 5,
                tls: { rejectUnauthorized: true },
            }),
        );
        expect(OUTBOUND_SMTP_TIMEOUTS).toEqual({
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 10_000,
        });
    });

    it("reports an SMTP timeout as a failed send with redacted logs", { timeout: 15000 }, async () => {
        vi.useFakeTimers();
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        const smtpTimeout = (): Error =>
            Object.assign(new Error("Timeout smtp-test-password"), {
                code: "ETIMEDOUT",
                timeoutType: "SOCKET_TIMEOUT",
            });
        verifyMock
            .mockResolvedValueOnce(true)
            .mockRejectedValue(smtpTimeout());
        sendMailMock.mockRejectedValue(smtpTimeout());

        try {
            const promise = sendEmail({
                to: "t",
                subject: "s",
                html: "h",
                text: "t",
                messageId: "<nhf-smtp-timeout@example.test>",
            });

            await vi.advanceTimersByTimeAsync(20000);

            expect(await promise).toBe(false);
            expect(sendMailMock).toHaveBeenCalledTimes(SMTP_MAX_SEND_ATTEMPTS);
            const loggedValues = consoleErrorSpy.mock.calls
                .flat()
                .map(String)
                .join(" ");
            expect(loggedValues).toContain("Timeout [REDACTED]");
            expect(loggedValues).not.toContain("smtp-test-password");
        } finally {
            consoleErrorSpy.mockRestore();
            vi.useRealTimers();
        }
    });

    it("does not expose the SMTP password in error logs", async () => {
        vi.useFakeTimers();
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        sendMailMock.mockRejectedValue(
            new Error("SMTP auth smtp-test-password graph-test-secret"),
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
            expect(loggedValues).not.toContain("smtp-test-password");
            expect(loggedValues).not.toContain("graph-test-secret");
        } finally {
            consoleErrorSpy.mockRestore();
            vi.useRealTimers();
        }
    });

    it("closes the previous pooled transporter once before replacing it after a transient error", { timeout: 15000 }, async () => {
        // Fresh module: the SMTP transporter is cached at module level.
        vi.resetModules();
        const { sendEmail: sendWithFreshTransporter } = await import("@/lib/email");
        vi.useFakeTimers();
        const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
        const firstClose = vi.fn();
        const secondClose = vi.fn();
        createTransportMock
            .mockReturnValueOnce({ sendMail: sendMailMock, verify: verifyMock, close: firstClose })
            .mockReturnValueOnce({ sendMail: sendMailMock, verify: verifyMock, close: secondClose });
        sendMailMock
            .mockRejectedValueOnce(
                Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }),
            )
            .mockResolvedValueOnce({ messageId: "OK" } as never);

        try {
            const promise = sendWithFreshTransporter({
                to: "t",
                subject: "s",
                html: "h",
                text: "t",
                messageId: "<nhf-close@example.test>",
            });

            await vi.advanceTimersByTimeAsync(3000);

            expect(await promise).toBe(true);
            expect(createTransportMock).toHaveBeenCalledTimes(2);
            expect(firstClose).toHaveBeenCalledTimes(1);
            expect(secondClose).not.toHaveBeenCalled();
            expect(sendMailMock).toHaveBeenCalledTimes(2);
            // PR #8 backoff unchanged: 2^attempt seconds after attempt 1.
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
        } finally {
            setTimeoutSpy.mockRestore();
            vi.useRealTimers();
        }
    });

    it("never lets a failing close() break the retry path", { timeout: 15000 }, async () => {
        vi.resetModules();
        const { sendEmail: sendWithFreshTransporter } = await import("@/lib/email");
        vi.useFakeTimers();
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        const throwingClose = vi.fn(() => {
            throw new Error("close failed smtp-test-password");
        });
        createTransportMock
            .mockReturnValueOnce({ sendMail: sendMailMock, verify: verifyMock, close: throwingClose })
            .mockReturnValueOnce({ sendMail: sendMailMock, verify: verifyMock, close: closeMock });
        sendMailMock
            .mockRejectedValueOnce(
                Object.assign(new Error("reset"), { code: "ECONNRESET" }),
            )
            .mockResolvedValueOnce({ messageId: "OK" } as never);

        try {
            const promise = sendWithFreshTransporter({
                to: "t",
                subject: "s",
                html: "h",
                text: "t",
            });

            await vi.advanceTimersByTimeAsync(3000);

            expect(await promise).toBe(true);
            expect(throwingClose).toHaveBeenCalledTimes(1);
            expect(sendMailMock).toHaveBeenCalledTimes(2);
            const loggedValues = consoleErrorSpy.mock.calls
                .flat()
                .map(String)
                .join(" ");
            expect(loggedValues).not.toContain("smtp-test-password");
        } finally {
            consoleErrorSpy.mockRestore();
            vi.useRealTimers();
        }
    });

    it("does not close the transporter on a non-transient failure", { timeout: 15000 }, async () => {
        vi.resetModules();
        const { sendEmail: sendWithFreshTransporter } = await import("@/lib/email");
        vi.useFakeTimers();
        sendMailMock.mockRejectedValue(
            Object.assign(new Error("authentication rejected"), { code: "EAUTH" }),
        );

        try {
            const promise = sendWithFreshTransporter({
                to: "t",
                subject: "s",
                html: "h",
                text: "t",
            });

            await vi.advanceTimersByTimeAsync(10000);

            expect(await promise).toBe(false);
            expect(sendMailMock).toHaveBeenCalledTimes(SMTP_MAX_SEND_ATTEMPTS);
            expect(closeMock).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });
});
