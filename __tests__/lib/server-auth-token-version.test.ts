// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, verifyAccessTokenMock, prismaMock } = vi.hoisted(() => ({
    cookiesMock: vi.fn(),
    verifyAccessTokenMock: vi.fn(),
    prismaMock: {
        user: { findUnique: vi.fn() },
        authRefreshToken: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/lib/auth/hybrid/tokens", () => ({
    verifyAccessToken: verifyAccessTokenMock,
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import { HYBRID_ACCESS_COOKIE_NAME, HYBRID_REFRESH_COOKIE_NAME } from "@/lib/auth/hybrid/constants";
import { getApiAuthSession } from "@/lib/auth/server";

function mockAccount(input: {
    role?: "USER" | "ADMIN";
    employee?: { status: "ACTIVE" | "INACTIVE" | "SUSPENDED"; deletedAt: Date | null } | null;
} = {}): void {
    const role = input.role ?? "USER";
    verifyAccessTokenMock.mockResolvedValue({
        sub: "1",
        role,
        sessionId: "session-1",
        tokenVersion: 1,
    });
    prismaMock.user.findUnique.mockResolvedValue({
        email: "employee@test.com",
        name: "Account Name",
        role,
        isActive: true,
        deletedAt: null,
        tokenVersion: 1,
        employee: input.employee ?? null,
    });
}

describe("generic server Auth account boundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cookiesMock.mockResolvedValue({
            get: vi.fn((name: string) =>
                name === HYBRID_ACCESS_COOKIE_NAME ? { value: "access.token" } : undefined,
            ),
        });
        prismaMock.authRefreshToken.findFirst.mockResolvedValue({ id: "session-1" });
    });

    it("uses the current database role and account identity", async () => {
        mockAccount({ role: "ADMIN" });

        await expect(getApiAuthSession()).resolves.toEqual({
            user: {
                id: "1",
                role: "ADMIN",
                email: "employee@test.com",
                name: "Account Name",
            },
        });
    });

    it("accepts an otherwise valid account without an Employee", async () => {
        mockAccount();

        await expect(getApiAuthSession()).resolves.toEqual({
            user: expect.objectContaining({ id: "1", role: "USER" }),
        });
    });

    it("rejects an account linked to an inactive Employee", async () => {
        mockAccount({ employee: { status: "INACTIVE", deletedAt: null } });

        await expect(getApiAuthSession()).resolves.toBeNull();
    });

    it("rejects a token when the current account tokenVersion differs", async () => {
        mockAccount();
        prismaMock.user.findUnique.mockResolvedValue({
            email: "employee@test.com",
            name: "Account Name",
            role: "ADMIN",
            isActive: true,
            deletedAt: null,
            tokenVersion: 2,
            employee: null,
        });

        await expect(getApiAuthSession()).resolves.toBeNull();
    });

    it("does not use a refresh cookie as an access session", async () => {
        cookiesMock.mockResolvedValue({
            get: vi.fn((name: string) =>
                name === HYBRID_REFRESH_COOKIE_NAME ? { value: "refresh.token" } : undefined,
            ),
        });

        await expect(getApiAuthSession()).resolves.toBeNull();
        expect(verifyAccessTokenMock).not.toHaveBeenCalled();
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it("rejects a revoked session family", async () => {
        mockAccount();
        prismaMock.authRefreshToken.findFirst.mockResolvedValue(null);

        await expect(getApiAuthSession()).resolves.toBeNull();
    });
});
