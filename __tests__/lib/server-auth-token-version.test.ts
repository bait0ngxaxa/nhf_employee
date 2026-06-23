// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, verifyAccessTokenMock, prismaMock } = vi.hoisted(() => ({
    cookiesMock: vi.fn(),
    verifyAccessTokenMock: vi.fn(),
    prismaMock: {
        user: {
            findUnique: vi.fn(),
        },
        authRefreshToken: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("next/headers", () => ({
    cookies: cookiesMock,
}));

vi.mock("@/lib/hybrid-auth-tokens", () => ({
    hashRefreshToken: (token: string): string => `hashed:${token}`,
    verifyAccessToken: verifyAccessTokenMock,
}));

vi.mock("@/lib/prisma", () => ({
    prisma: prismaMock,
}));

import { getApiAuthSession } from "@/lib/server-auth";
import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
} from "@/lib/hybrid-auth-constants";

describe("server auth tokenVersion validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cookiesMock.mockResolvedValue({
            get: vi.fn((name: string) =>
                name === HYBRID_ACCESS_COOKIE_NAME ? { value: "access.token" } : undefined,
            ),
        });
        prismaMock.authRefreshToken.findFirst.mockResolvedValue({ id: "session-1" });
        prismaMock.authRefreshToken.findUnique.mockResolvedValue(null);
    });

    it("returns null when access token version mismatches current user tokenVersion", async () => {
        verifyAccessTokenMock.mockResolvedValue({
            sub: "1",
            role: "ADMIN",
            sessionId: "session-1",
            tokenVersion: 1,
        });

        prismaMock.user.findUnique.mockResolvedValue({
            id: 1,
            role: "ADMIN",
            email: "admin@test.com",
            name: "Admin",
            isActive: true,
            tokenVersion: 2,
            employee: null,
        });

        const session = await getApiAuthSession();
        expect(session).toBeNull();
    });

    it("returns session from valid refresh token when access token is missing", async () => {
        cookiesMock.mockResolvedValue({
            get: vi.fn((name: string) =>
                name === HYBRID_REFRESH_COOKIE_NAME ? { value: "refresh.token" } : undefined,
            ),
        });
        prismaMock.authRefreshToken.findUnique.mockResolvedValue({
            userId: 1,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
        });
        prismaMock.user.findUnique.mockResolvedValue({
            id: 1,
            role: "ADMIN",
            email: "admin@test.com",
            name: "Admin",
            isActive: true,
            tokenVersion: 2,
            employee: null,
        });

        const session = await getApiAuthSession();

        expect(session?.user.email).toBe("admin@test.com");
        expect(prismaMock.authRefreshToken.findUnique).toHaveBeenCalledWith({
            where: { tokenHash: "hashed:refresh.token" },
            select: {
                expiresAt: true,
                revokedAt: true,
                userId: true,
            },
        });
    });

    it("returns null when access JWT belongs to a revoked session family", async () => {
        verifyAccessTokenMock.mockResolvedValue({
            sub: "1",
            role: "ADMIN",
            sessionId: "revoked-family",
            tokenVersion: 1,
        });
        prismaMock.authRefreshToken.findFirst.mockResolvedValue(null);
        prismaMock.user.findUnique.mockResolvedValue({
            id: 1,
            role: "ADMIN",
            email: "admin@test.com",
            name: "Admin",
            isActive: true,
            tokenVersion: 1,
            employee: null,
        });

        const session = await getApiAuthSession();

        expect(session).toBeNull();
        expect(prismaMock.authRefreshToken.findFirst).toHaveBeenCalledWith({
            where: {
                userId: 1,
                familyId: "revoked-family",
                revokedAt: null,
                expiresAt: { gt: expect.any(Date) },
            },
            select: { id: true },
        });
    });
});

