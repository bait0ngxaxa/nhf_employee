// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { cleanupAuthRefreshSessionsMock } = vi.hoisted(() => ({
    cleanupAuthRefreshSessionsMock: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
    cleanupAuthRefreshSessions: cleanupAuthRefreshSessionsMock,
}));

import { POST } from "@/app/api/auth/cleanup/route";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

const VALID_SECRET = "auth-cleanup-secret-0123456789abcdef";

function buildRequest(secret?: string): NextRequest {
    return new NextRequest("http://127.0.0.1:3000/api/auth/cleanup", {
        method: "POST",
        headers: secret ? { "x-cleanup-secret": secret } : undefined,
    });
}

describe("Auth refresh-session cleanup route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("AUTH_CLEANUP_SECRET", undefined);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("returns 503 when the cleanup secret is not configured", async () => {
        const response = await POST(buildRequest(VALID_SECRET));

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
            error: COMMON_API_MESSAGES.cleanupNotConfigured,
        });
        expect(cleanupAuthRefreshSessionsMock).not.toHaveBeenCalled();
    });

    it("returns 503 when the configured cleanup secret is shorter than 32 characters", async () => {
        vi.stubEnv("AUTH_CLEANUP_SECRET", "too-short-secret");

        const response = await POST(buildRequest("too-short-secret"));

        expect(response.status).toBe(503);
        expect(cleanupAuthRefreshSessionsMock).not.toHaveBeenCalled();
    });

    it("returns 403 when the cleanup secret header is missing or invalid", async () => {
        vi.stubEnv("AUTH_CLEANUP_SECRET", VALID_SECRET);

        const missing = await POST(buildRequest());
        expect(missing.status).toBe(403);
        await expect(missing.json()).resolves.toEqual({
            error: COMMON_API_MESSAGES.forbidden,
        });

        const wrong = await POST(buildRequest("wrong-secret"));
        expect(wrong.status).toBe(403);
        expect(cleanupAuthRefreshSessionsMock).not.toHaveBeenCalled();
    });

    it("deletes refresh sessions older than seven days when the secret matches", async () => {
        vi.stubEnv("AUTH_CLEANUP_SECRET", VALID_SECRET);
        cleanupAuthRefreshSessionsMock.mockResolvedValue(3);
        const before = Date.now();

        const response = await POST(buildRequest(VALID_SECRET));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true, deletedCount: 3 });
        expect(cleanupAuthRefreshSessionsMock).toHaveBeenCalledTimes(1);
        const cutoff = cleanupAuthRefreshSessionsMock.mock.calls[0]?.[0];
        expect(cutoff).toBeInstanceOf(Date);
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        expect((cutoff as Date).getTime()).toBeGreaterThanOrEqual(before - sevenDaysMs);
        expect((cutoff as Date).getTime()).toBeLessThanOrEqual(Date.now() - sevenDaysMs);
    });

    it("masks service failures", async () => {
        vi.stubEnv("AUTH_CLEANUP_SECRET", VALID_SECRET);
        cleanupAuthRefreshSessionsMock.mockRejectedValue(new Error("db down"));

        const response = await POST(buildRequest(VALID_SECRET));

        expect(response.status).toBe(500);
        expect(await response.text()).not.toContain("db down");
    });
});
