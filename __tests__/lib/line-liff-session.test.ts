import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
    clearLiffSessionCookie,
    issueLiffSession,
    LIFF_SESSION_COOKIE_NAME,
    LIFF_SESSION_PURPOSE,
    setLiffSessionCookie,
    verifyLiffSession,
} from "@/lib/line/liff-session";
import { getLineLiffSessionConfig } from "@/lib/line/config";

const SESSION_SECRET = "line-liff-test-secret-0123456789abcdef";

describe("LINE LIFF session", () => {
    beforeEach(() => {
        vi.stubEnv("LINE_LIFF_SESSION_SECRET", SESSION_SECRET);
        vi.stubEnv("LINE_LIFF_SESSION_TTL_SECONDS", "3600");
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    it("issues and verifies a session with the minimum identity claims", async () => {
        const token = await issueLiffSession({ userId: 10, employeeId: 20 });

        await expect(verifyLiffSession(token)).resolves.toEqual({
            userId: 10,
            employeeId: 20,
        });
    });

    it("rejects a tampered token", async () => {
        const token = await issueLiffSession({ userId: 10, employeeId: 20 });
        const tamperedToken = `${token.split(".").slice(0, 2).join(".")}.invalid-signature`;

        await expect(verifyLiffSession(tamperedToken)).rejects.toThrow(
            "Invalid LIFF session",
        );
    });

    it("rejects an expired session", async () => {
        vi.stubEnv("LINE_LIFF_SESSION_TTL_SECONDS", "1");
        const token = await issueLiffSession({ userId: 10, employeeId: 20 });
        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + 2_000);

        await expect(verifyLiffSession(token)).rejects.toThrow(
            "Invalid LIFF session",
        );
    });

    it("rejects a token with the wrong session purpose", async () => {
        const token = await issueLiffSession({ userId: 10, employeeId: 20 });
        const [header, _payload, signature] = token.split(".");
        const wrongPayload = Buffer.from(
            JSON.stringify({
                sub: "10",
                employeeId: 20,
                purpose: "other-purpose",
                iss: "nhf_employee",
                aud: LIFF_SESSION_PURPOSE,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
            }),
        ).toString("base64url");

        await expect(
            verifyLiffSession(`${header}.${wrongPayload}.${signature}`),
        ).rejects.toThrow("Invalid LIFF session");
    });

    it("sets a HttpOnly, bounded cookie and Secure in production", () => {
        vi.stubEnv("NODE_ENV", "production");
        const response = NextResponse.json({ linked: true });

        setLiffSessionCookie(response, "session-token");

        const setCookie = response.headers.get("set-cookie") ?? "";
        expect(setCookie).toContain(`${LIFF_SESSION_COOKIE_NAME}=session-token`);
        expect(setCookie).toContain("HttpOnly");
        expect(setCookie).toContain("Secure");
        expect(setCookie).toContain("SameSite=lax");
        expect(setCookie).toContain("Path=/");
        expect(setCookie).toContain("Max-Age=3600");
    });

    it("does not require the session secret to clear an old cookie", () => {
        vi.stubEnv("LINE_LIFF_SESSION_SECRET", "");
        const response = NextResponse.json({ linked: false });

        clearLiffSessionCookie(response);

        const setCookie = response.headers.get("set-cookie") ?? "";
        expect(setCookie).toContain(`${LIFF_SESSION_COOKIE_NAME}=;`);
        expect(setCookie).toContain("Max-Age=0");
    });

    it("rejects a missing or weak session secret", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("LINE_LIFF_SESSION_SECRET", "short");

        expect(() => getLineLiffSessionConfig()).toThrowError(
            expect.objectContaining({
                code: "MISCONFIGURED",
                statusCode: 500,
            }),
        );
    });
});
