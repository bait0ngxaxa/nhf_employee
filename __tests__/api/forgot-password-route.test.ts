// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type NextRequest } from "next/server";
import type * as NextServerModule from "next/server";

import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";
import { reserveAuthAttempt, resetAuthRateLimit } from "@/lib/auth/rate-limit";
import type * as AuthRateLimitModule from "@/lib/auth/rate-limit";
import {
    REQUEST_BODY_INVALID_JSON_MESSAGE,
    AUTH_CREDENTIALS_MAX_REQUEST_BYTES,
    REQUEST_BODY_TOO_LARGE_MESSAGE,
} from "@/lib/ssot/request-limits";
import {
    buildJsonBodyRequest,
    CONTENT_LENGTH_MODES,
    jsonBodyOfExactBytes,
} from "@/__tests__/helpers/request-body-limit";
import { trustedNextRequest } from "@/__tests__/helpers/trusted-mutation";

const { requestPasswordResetMock, sendEmailMock, afterCallbacks } = vi.hoisted(() => ({
    requestPasswordResetMock: vi.fn(),
    sendEmailMock: vi.fn(),
    afterCallbacks: [] as Array<() => unknown>,
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        // Capture deferred work instead of running it, so tests can prove that
        // nothing is sent on the request path.
        after: vi.fn((callback: () => unknown) => {
            afterCallbacks.push(callback);
        }),
    };
});

async function flushAfterCallbacks(): Promise<void> {
    const pending = afterCallbacks.splice(0);
    for (const callback of pending) {
        await callback();
    }
}

vi.mock("@/modules/auth", () => ({
    requestPasswordReset: requestPasswordResetMock,
}));

vi.mock("@/lib/email", () => ({
    sendEmail: sendEmailMock,
}));

vi.mock("@/lib/auth/rate-limit", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthRateLimitModule>();
    return { ...actual, reserveAuthAttempt: vi.fn(actual.reserveAuthAttempt) };
});

function buildRequest(body: unknown, ipAddress = "203.0.113.50"): NextRequest {
    return trustedNextRequest("http://localhost/api/auth/forgot-password", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "cf-connecting-ip": ipAddress,
            "user-agent": "forgot-password-test-agent",
        },
        body: JSON.stringify(body) ?? "",
    });
}

async function readResponse(response: Response): Promise<unknown> {
    return response.json();
}

const acceptedBody = {
    success: true,
    message: "หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล",
};

describe("forgot-password route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetAuthRateLimit();
        requestPasswordResetMock.mockReset();
        sendEmailMock.mockReset();
        sendEmailMock.mockResolvedValue(true);
        afterCallbacks.splice(0);
        vi.unstubAllEnvs();
    });

    it("returns the accepted anti-enumeration response for invalid input", async () => {
        const response = await forgotPasswordRoute(buildRequest({ email: "not-an-email" }));

        expect(response.status).toBe(200);
        await expect(readResponse(response)).resolves.toEqual(acceptedBody);
        expect(requestPasswordResetMock).not.toHaveBeenCalled();
        expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("keeps unknown and known account responses identical", async () => {
        requestPasswordResetMock
            .mockResolvedValueOnce({ rateLimited: false })
            .mockResolvedValueOnce({
                rateLimited: false,
                rawToken: "raw-token",
                user: { email: "known@thainhf.org", name: "Known User" },
            });

        const unknownResponse = await forgotPasswordRoute(
            buildRequest({ email: "unknown@thainhf.org" }, "203.0.113.51"),
        );
        const knownResponse = await forgotPasswordRoute(
            buildRequest({ email: "known@thainhf.org" }, "203.0.113.52"),
        );

        expect(unknownResponse.status).toBe(200);
        expect(knownResponse.status).toBe(200);
        await expect(readResponse(unknownResponse)).resolves.toEqual(acceptedBody);
        await expect(readResponse(knownResponse)).resolves.toEqual(acceptedBody);
        // Neither response awaited delivery: the send is deferred until after().
        expect(sendEmailMock).not.toHaveBeenCalled();
        expect(afterCallbacks).toHaveLength(1);

        await flushAfterCallbacks();
        expect(sendEmailMock).toHaveBeenCalledTimes(1);
        expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
            subject: "[NHFapp][Account] คำขอรีเซ็ตรหัสผ่าน",
            fromName: "NHFapp | บัญชีผู้ใช้",
            html: expect.stringContaining("ตั้งรหัสผ่านใหม่"),
            text: expect.stringContaining("ลิงก์จะหมดอายุภายใน 1 ชั่วโมง"),
        }));
    });

    it("keeps database-limited requests in the accepted response path", async () => {
        requestPasswordResetMock.mockResolvedValue({ rateLimited: true });

        const response = await forgotPasswordRoute(
            buildRequest({ email: "user@thainhf.org" }),
        );

        expect(response.status).toBe(200);
        await expect(readResponse(response)).resolves.toEqual(acceptedBody);
        expect(sendEmailMock).not.toHaveBeenCalled();

        requestPasswordResetMock.mockResolvedValue({ rateLimited: false });
        const retryResponse = await forgotPasswordRoute(
            buildRequest({ email: "user@thainhf.org" }),
        );
        expect(retryResponse.status).toBe(200);
        expect(requestPasswordResetMock).toHaveBeenCalledTimes(2);
    });

    it("keeps application rate limiting anti-enumerating", async () => {
        requestPasswordResetMock.mockResolvedValue({ rateLimited: false });

        const responses: Response[] = [];
        for (let attempt = 0; attempt < 4; attempt += 1) {
            responses.push(
                await forgotPasswordRoute(
                    buildRequest({ email: "user@thainhf.org" }),
                ),
            );
        }

        expect(responses.every((response) => response.status === 200)).toBe(true);
        for (const response of responses) {
            await expect(readResponse(response)).resolves.toEqual(acceptedBody);
        }
        expect(requestPasswordResetMock).toHaveBeenCalledTimes(3);
    });

    const KNOWN_USER_RESET = {
        rateLimited: false,
        rawToken: "raw-secret-token",
        user: { email: "known@thainhf.org", name: "Known User" },
    };

    function buildSpoofedRequest(): NextRequest {
        return trustedNextRequest("http://localhost/api/auth/forgot-password", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "cf-connecting-ip": "203.0.113.60",
                host: "attacker.example",
                "x-forwarded-host": "evil.example",
                "x-forwarded-proto": "https",
            },
            body: JSON.stringify({ email: "known@thainhf.org" }),
        });
    }

    it("does not wait for a slow email provider before responding", async () => {
        requestPasswordResetMock.mockResolvedValue(KNOWN_USER_RESET);
        sendEmailMock.mockReturnValue(new Promise<boolean>(() => undefined));

        const response = await forgotPasswordRoute(
            buildRequest({ email: "known@thainhf.org" }),
        );

        expect(response.status).toBe(200);
        await expect(readResponse(response)).resolves.toEqual(acceptedBody);
        expect(sendEmailMock).not.toHaveBeenCalled();
        expect(afterCallbacks).toHaveLength(1);
    });

    it.each([
        ["missing", undefined],
        ["unparseable", "not a url"],
        ["localhost", "http://localhost:3000"],
    ])("fails closed in production when PUBLIC_APPROVE_URL is %s", async (_label, value) => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("PUBLIC_APPROVE_URL", value);
        requestPasswordResetMock.mockResolvedValue(KNOWN_USER_RESET);
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

        try {
            const response = await forgotPasswordRoute(buildSpoofedRequest());
            await flushAfterCallbacks();

            expect(response.status).toBe(200);
            await expect(readResponse(response)).resolves.toEqual(acceptedBody);
            // No token work happens, so the user's existing unused reset link
            // survives and no quota is consumed for a link that is never sent.
            expect(requestPasswordResetMock).not.toHaveBeenCalled();
            expect(sendEmailMock).not.toHaveBeenCalled();
            expect(errorLog).toHaveBeenCalledWith(
                expect.stringContaining("public origin is not configured"),
                expect.objectContaining({ code: "PUBLIC_ORIGIN_UNCONFIGURED" }),
            );
            const logged = JSON.stringify(errorLog.mock.calls);
            expect(logged).not.toContain("raw-secret-token");
            expect(logged).not.toContain("known@thainhf.org");
        } finally {
            errorLog.mockRestore();
        }
    });

    it("does not consume the application rate limit while the origin is misconfigured", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("PUBLIC_APPROVE_URL", "");
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            for (let attempt = 0; attempt < 5; attempt += 1) {
                const response = await forgotPasswordRoute(
                    buildRequest({ email: "user@thainhf.org" }, "203.0.113.80"),
                );
                expect(response.status).toBe(200);
            }
        } finally {
            errorLog.mockRestore();
        }

        vi.stubEnv("PUBLIC_APPROVE_URL", "https://nhfapp.example");
        requestPasswordResetMock.mockResolvedValue(KNOWN_USER_RESET);
        await forgotPasswordRoute(
            buildRequest({ email: "user@thainhf.org" }, "203.0.113.80"),
        );

        expect(requestPasswordResetMock).toHaveBeenCalledTimes(1);
    });

    it("never uses a spoofed Host or X-Forwarded-Host in the production reset URL", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://nhfapp.example");
        requestPasswordResetMock.mockResolvedValue(KNOWN_USER_RESET);

        const response = await forgotPasswordRoute(buildSpoofedRequest());
        await flushAfterCallbacks();

        expect(response.status).toBe(200);
        expect(sendEmailMock).toHaveBeenCalledTimes(1);
        const sent = JSON.stringify(sendEmailMock.mock.calls[0]);
        expect(sent).toContain("https://nhfapp.example/reset-password?token=raw-secret-token");
        expect(sent).not.toContain("attacker.example");
        expect(sent).not.toContain("evil.example");
    });

    it.each([
        ["the provider reports failure", () => sendEmailMock.mockResolvedValue(false)],
        [
            "the provider throws",
            () => sendEmailMock.mockRejectedValue(
                new Error("SMTP rejected known@thainhf.org raw-secret-token"),
            ),
        ],
    ])("logs delivery failure safely when %s", async (_label, arrange) => {
        requestPasswordResetMock.mockResolvedValue(KNOWN_USER_RESET);
        arrange();
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

        try {
            const response = await forgotPasswordRoute(
                buildRequest({ email: "known@thainhf.org" }, "203.0.113.70"),
            );
            await expect(flushAfterCallbacks()).resolves.toBeUndefined();

            expect(response.status).toBe(200);
            await expect(readResponse(response)).resolves.toEqual(acceptedBody);
            expect(errorLog).toHaveBeenCalledWith(
                "Password reset email delivery failed",
                expect.objectContaining({ code: expect.any(String) }),
            );
            const logged = JSON.stringify(errorLog.mock.calls);
            expect(logged).not.toContain("raw-secret-token");
            expect(logged).not.toContain("reset-password");
            expect(logged).not.toContain("known@thainhf.org");
        } finally {
            errorLog.mockRestore();
        }
    });
});

const FORGOT_URL = "http://localhost/api/auth/forgot-password";
const FORGOT_HEADERS = { "cf-connecting-ip": "203.0.113.90" };

describe("forgot-password route body limit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetAuthRateLimit();
        requestPasswordResetMock.mockReset();
        sendEmailMock.mockReset();
        sendEmailMock.mockResolvedValue(true);
        afterCallbacks.splice(0);
        vi.unstubAllEnvs();
    });

    it.each(CONTENT_LENGTH_MODES)(
        "rejects an oversized body with 413 before token work or the rate-limit reservation (Content-Length %s)",
        async (contentLength) => {
            const body = jsonBodyOfExactBytes(
                { email: "user@thainhf.org" },
                AUTH_CREDENTIALS_MAX_REQUEST_BYTES + 1,
            );

            const response = await forgotPasswordRoute(
                buildJsonBodyRequest(FORGOT_URL, body, { headers: FORGOT_HEADERS, contentLength }),
            );

            expect(response.status).toBe(413);
            await expect(response.json()).resolves.toEqual({ error: REQUEST_BODY_TOO_LARGE_MESSAGE });
            expect(reserveAuthAttempt).not.toHaveBeenCalled();
            expect(requestPasswordResetMock).not.toHaveBeenCalled();
            expect(afterCallbacks).toHaveLength(0);
        },
    );

    it("returns canonical 400 for malformed JSON", async () => {
        const response = await forgotPasswordRoute(
            buildJsonBodyRequest(FORGOT_URL, "{not json", { headers: FORGOT_HEADERS }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: REQUEST_BODY_INVALID_JSON_MESSAGE,
        });
        expect(reserveAuthAttempt).not.toHaveBeenCalled();
        expect(requestPasswordResetMock).not.toHaveBeenCalled();
    });

    it("accepts a valid body of exactly the limit", async () => {
        requestPasswordResetMock.mockResolvedValue({ rateLimited: false });
        const body = jsonBodyOfExactBytes(
            { email: "user@thainhf.org" },
            AUTH_CREDENTIALS_MAX_REQUEST_BYTES,
        );

        const response = await forgotPasswordRoute(
            buildJsonBodyRequest(FORGOT_URL, body, { headers: FORGOT_HEADERS }),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(acceptedBody);
        expect(requestPasswordResetMock).toHaveBeenCalledWith("user@thainhf.org");
    });
});
