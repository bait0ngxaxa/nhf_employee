// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST as refreshRoute } from "@/app/api/auth/refresh/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { POST as logoutAllRoute } from "@/app/api/auth/logout-all/route";
import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
} from "@/lib/hybrid-auth-constants";

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        authRefreshToken: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            updateMany: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

vi.mock("@/lib/audit", () => ({
    logAuthEvent: vi.fn(),
}));

vi.mock("@/lib/hybrid-auth-tokens", () => ({
    hashRefreshToken: vi.fn((token: string) => `hash:${token}`),
    issueAccessToken: vi.fn(async () => "access.token"),
    buildRefreshTokenRecord: vi.fn(() => ({
        rawToken: "new-refresh-token",
        record: {
            userId: 1,
            tokenHash: "hash:new-refresh-token",
            familyId: "family-1",
            expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            userAgent: "ua",
            ipAddress: "127.0.0.1",
        },
    })),
    verifyAccessToken: vi.fn(async () => ({
        sub: "1",
        role: "ADMIN",
        sessionId: "family-1",
        tokenVersion: 1,
    })),
    getAccessTokenTtlSeconds: vi.fn(() => 900),
    getRefreshTokenTtlSeconds: vi.fn(() => 2592000),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: prismaMock,
}));

describe("Hybrid auth routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.$transaction.mockImplementation(
            async (callback: (client: typeof prismaMock) => Promise<unknown>) =>
                callback(prismaMock),
        );
        prismaMock.authRefreshToken.findFirst.mockResolvedValue({ id: "active-session" });
        prismaMock.authRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    });

    it("refresh rotates token and returns success", async () => {
        prismaMock.authRefreshToken.findUnique.mockResolvedValue({
            id: "rt1",
            userId: 1,
            familyId: "family-1",
            revokedAt: null,
            expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            user: { id: 1, email: "u@test.com", role: "ADMIN", isActive: true },
        });

        const request = new NextRequest("http://localhost/api/auth/refresh", {
            method: "POST",
            headers: { ...csrfHeaders, cookie: `${HYBRID_REFRESH_COOKIE_NAME}=old-refresh-token` },
        });
        const response = await refreshRoute(request);
        const setCookie = response.headers.get("set-cookie") ?? "";

        expect(response.status).toBe(200);
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(prismaMock.authRefreshToken.updateMany).toHaveBeenCalledWith({
            where: { id: "rt1", revokedAt: null },
            data: { revokedAt: expect.any(Date), lastUsedAt: expect.any(Date) },
        });
        expect(prismaMock.authRefreshToken.create).toHaveBeenCalledTimes(1);
        expect(setCookie).toContain(`${HYBRID_ACCESS_COOKIE_NAME}=`);
        expect(setCookie).toContain(`${HYBRID_REFRESH_COOKIE_NAME}=`);
        expect(setCookie).toContain("Path=/");
        expect(setCookie).toContain("Secure");
    });

    it("refresh returns access token when another request already rotated token", async () => {
        prismaMock.authRefreshToken.findUnique.mockResolvedValue({
            id: "rt1",
            userId: 1,
            familyId: "family-1",
            revokedAt: null,
            expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            user: { id: 1, email: "u@test.com", role: "ADMIN", isActive: true, tokenVersion: 1 },
        });
        prismaMock.authRefreshToken.updateMany.mockResolvedValueOnce({ count: 0 });
        prismaMock.authRefreshToken.findFirst.mockResolvedValueOnce({ id: "rt2" });

        const request = new NextRequest("http://localhost/api/auth/refresh", {
            method: "POST",
            headers: { ...csrfHeaders, cookie: `${HYBRID_REFRESH_COOKIE_NAME}=old-refresh-token` },
        });
        const response = await refreshRoute(request);
        const setCookie = response.headers.get("set-cookie") ?? "";

        expect(response.status).toBe(200);
        expect(prismaMock.authRefreshToken.updateMany).toHaveBeenCalledTimes(1);
        expect(prismaMock.authRefreshToken.updateMany).toHaveBeenCalledWith({
            where: { id: "rt1", revokedAt: null },
            data: { revokedAt: expect.any(Date), lastUsedAt: expect.any(Date) },
        });
        expect(prismaMock.authRefreshToken.create).not.toHaveBeenCalled();
        expect(setCookie).toContain(`${HYBRID_ACCESS_COOKIE_NAME}=`);
        expect(setCookie).not.toContain(`${HYBRID_REFRESH_COOKIE_NAME}=`);
    });

    it("refresh treats rotatedFromId unique conflict as an already rotated token", async () => {
        prismaMock.authRefreshToken.findUnique.mockResolvedValue({
            id: "rt1",
            userId: 1,
            familyId: "family-1",
            revokedAt: null,
            expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            user: { id: 1, email: "u@test.com", role: "ADMIN", isActive: true, tokenVersion: 1 },
        });
        prismaMock.authRefreshToken.create.mockRejectedValueOnce({
            code: "P2002",
            meta: { target: ["rotatedFromId"] },
        });

        const request = new NextRequest("http://localhost/api/auth/refresh", {
            method: "POST",
            headers: { ...csrfHeaders, cookie: `${HYBRID_REFRESH_COOKIE_NAME}=old-refresh-token` },
        });
        const response = await refreshRoute(request);
        const setCookie = response.headers.get("set-cookie") ?? "";

        expect(response.status).toBe(200);
        expect(prismaMock.authRefreshToken.create).toHaveBeenCalledTimes(1);
        expect(setCookie).toContain(`${HYBRID_ACCESS_COOKIE_NAME}=`);
        expect(setCookie).not.toContain(`${HYBRID_REFRESH_COOKIE_NAME}=`);
    });

    it("refresh revokes family on reused token", async () => {
        const oldDate = new Date(Date.now() - 60_000);
        prismaMock.authRefreshToken.findUnique.mockResolvedValue({
            id: "rt1",
            userId: 1,
            familyId: "family-1",
            revokedAt: oldDate,
            lastUsedAt: oldDate,
            expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            user: { id: 1, email: "u@test.com", role: "ADMIN", isActive: true },
        });

        const request = new NextRequest("http://localhost/api/auth/refresh", {
            method: "POST",
            headers: { ...csrfHeaders, cookie: `${HYBRID_REFRESH_COOKIE_NAME}=old-refresh-token` },
        });
        const response = await refreshRoute(request);

        expect(response.status).toBe(401);
        expect(prismaMock.authRefreshToken.updateMany).toHaveBeenCalledWith({
            where: { familyId: "family-1", revokedAt: null },
            data: { revokedAt: expect.any(Date) },
        });
    });

    it("refresh allows recently rotated token for multi-tab race", async () => {
        const now = new Date();
        prismaMock.authRefreshToken.findUnique.mockResolvedValue({
            id: "rt1",
            userId: 1,
            familyId: "family-1",
            revokedAt: now,
            lastUsedAt: now,
            expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            user: { id: 1, email: "u@test.com", role: "ADMIN", isActive: true, tokenVersion: 1 },
        });
        prismaMock.authRefreshToken.findFirst.mockResolvedValue({ id: "rt2" });

        const request = new NextRequest("http://localhost/api/auth/refresh", {
            method: "POST",
            headers: { ...csrfHeaders, cookie: `${HYBRID_REFRESH_COOKIE_NAME}=old-refresh-token` },
        });
        const response = await refreshRoute(request);

        expect(response.status).toBe(200);
        expect(prismaMock.authRefreshToken.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.authRefreshToken.create).not.toHaveBeenCalled();
        expect(response.headers.get("set-cookie")).toContain(`${HYBRID_ACCESS_COOKIE_NAME}=`);
    });

    it("logout revokes current refresh token", async () => {
        prismaMock.authRefreshToken.findUnique.mockResolvedValue({
            id: "rt1",
            revokedAt: null,
            user: { id: 1, email: "u@test.com" },
        });

        const request = new NextRequest("http://localhost/api/auth/logout", {
            method: "POST",
            headers: { ...csrfHeaders, cookie: `${HYBRID_REFRESH_COOKIE_NAME}=old-refresh-token` },
        });
        const response = await logoutRoute(request);

        expect(response.status).toBe(200);
        expect(prismaMock.authRefreshToken.update).toHaveBeenCalledTimes(1);
        expect(response.headers.get("set-cookie")).toContain(`${HYBRID_REFRESH_COOKIE_NAME}=`);
    });

    it("logout-all revokes all active refresh tokens for authenticated user", async () => {
        prismaMock.user.findUnique.mockResolvedValue({ email: "u@test.com" });
        prismaMock.authRefreshToken.updateMany.mockResolvedValue({ count: 3 });

        const request = new NextRequest("http://localhost/api/auth/logout-all", {
            method: "POST",
            headers: { ...csrfHeaders, cookie: `${HYBRID_ACCESS_COOKIE_NAME}=access-token` },
        });
        const response = await logoutAllRoute(request);

        expect(response.status).toBe(200);
        expect(prismaMock.authRefreshToken.updateMany).toHaveBeenCalledWith({
            where: { userId: 1, revokedAt: null },
            data: { revokedAt: expect.any(Date) },
        });
    });

    it("logout-all rejects an access JWT from a revoked session family", async () => {
        prismaMock.authRefreshToken.findFirst.mockResolvedValue(null);

        const request = new NextRequest("http://localhost/api/auth/logout-all", {
            method: "POST",
            headers: { ...csrfHeaders, cookie: `${HYBRID_ACCESS_COOKIE_NAME}=access-token` },
        });
        const response = await logoutAllRoute(request);

        expect(response.status).toBe(401);
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.authRefreshToken.updateMany).not.toHaveBeenCalled();
    });
});
    const csrfHeaders = {
        origin: "http://localhost",
        "x-requested-with": "XMLHttpRequest",
    };
