// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST as refreshRoute } from "@/app/api/auth/refresh/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { POST as logoutAllRoute } from "@/app/api/auth/logout-all/route";

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        authRefreshToken: {
            findUnique: vi.fn(),
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
        prismaMock.$transaction.mockResolvedValue(undefined);
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
            headers: { cookie: "nhf_rt=old-refresh-token" },
        });
        const response = await refreshRoute(request);

        expect(response.status).toBe(200);
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(response.headers.get("set-cookie")).toContain("nhf_at=");
    });

    it("refresh revokes family on reused token", async () => {
        prismaMock.authRefreshToken.findUnique.mockResolvedValue({
            id: "rt1",
            userId: 1,
            familyId: "family-1",
            revokedAt: new Date("2025-01-01T00:00:00.000Z"),
            expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            user: { id: 1, email: "u@test.com", role: "ADMIN", isActive: true },
        });

        const request = new NextRequest("http://localhost/api/auth/refresh", {
            method: "POST",
            headers: { cookie: "nhf_rt=old-refresh-token" },
        });
        const response = await refreshRoute(request);

        expect(response.status).toBe(401);
        expect(prismaMock.authRefreshToken.updateMany).toHaveBeenCalledWith({
            where: { familyId: "family-1", revokedAt: null },
            data: { revokedAt: expect.any(Date) },
        });
    });

    it("logout revokes current refresh token", async () => {
        prismaMock.authRefreshToken.findUnique.mockResolvedValue({
            id: "rt1",
            revokedAt: null,
            user: { id: 1, email: "u@test.com" },
        });

        const request = new NextRequest("http://localhost/api/auth/logout", {
            method: "POST",
            headers: { cookie: "nhf_rt=old-refresh-token" },
        });
        const response = await logoutRoute(request);

        expect(response.status).toBe(200);
        expect(prismaMock.authRefreshToken.update).toHaveBeenCalledTimes(1);
        expect(response.headers.get("set-cookie")).toContain("nhf_rt=");
    });

    it("logout-all revokes all active refresh tokens for authenticated user", async () => {
        prismaMock.user.findUnique.mockResolvedValue({ email: "u@test.com" });
        prismaMock.authRefreshToken.updateMany.mockResolvedValue({ count: 3 });

        const request = new NextRequest("http://localhost/api/auth/logout-all", {
            method: "POST",
            headers: { cookie: "nhf_at=access-token" },
        });
        const response = await logoutAllRoute(request);

        expect(response.status).toBe(200);
        expect(prismaMock.authRefreshToken.updateMany).toHaveBeenCalledWith({
            where: { userId: 1, revokedAt: null },
            data: { revokedAt: expect.any(Date) },
        });
    });
});
