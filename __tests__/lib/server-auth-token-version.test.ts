// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getServerSessionMock, verifyAccessTokenMock, prismaMock } = vi.hoisted(() => ({
    cookiesMock: vi.fn(),
    getServerSessionMock: vi.fn(),
    verifyAccessTokenMock: vi.fn(),
    prismaMock: {
        user: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("next/headers", () => ({
    cookies: cookiesMock,
}));

vi.mock("next-auth", () => ({
    getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/hybrid-auth-tokens", () => ({
    verifyAccessToken: verifyAccessTokenMock,
}));

vi.mock("@/lib/prisma", () => ({
    prisma: prismaMock,
}));

import { getApiAuthSession } from "@/lib/server-auth";

describe("server auth tokenVersion validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getServerSessionMock.mockResolvedValue(null);
        cookiesMock.mockResolvedValue({
            get: vi.fn(() => ({ value: "access.token" })),
        });
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
});

