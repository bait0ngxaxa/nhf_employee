// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, verifyAccessTokenMock, prismaMock } = vi.hoisted(() => ({
    cookiesMock: vi.fn(),
    verifyAccessTokenMock: vi.fn(),
    prismaMock: {
        user: { findUnique: vi.fn() },
        employee: { findFirst: vi.fn() },
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
import { requireAdminSession, requireApiSession } from "@/lib/auth/api";
import { getApiAuthSession } from "@/lib/auth/server";
import { resolveAuthenticatedAccount } from "@/modules/auth";

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
    const employee = input.employee === undefined
        ? { status: "ACTIVE" as const, deletedAt: null }
        : input.employee;
    prismaMock.user.findUnique.mockResolvedValue({
        email: "employee@test.com",
        name: "Account Name",
        role,
        isActive: true,
        deletedAt: null,
        tokenVersion: 1,
        employee,
    });
}

describe("legacy server Auth compatibility boundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cookiesMock.mockResolvedValue({
            get: vi.fn((name: string) =>
                name === HYBRID_ACCESS_COOKIE_NAME ? { value: "access.token" } : undefined,
            ),
        });
        prismaMock.authRefreshToken.findFirst.mockResolvedValue({ id: "session-1" });
        prismaMock.employee.findFirst.mockResolvedValue({ id: 101 });
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

    it("keeps generic account resolution valid without an Employee", async () => {
        mockAccount({ employee: null });

        await expect(resolveAuthenticatedAccount("access.token")).resolves.toMatchObject({
            userId: 1,
            role: "USER",
            email: "employee@test.com",
            name: "Account Name",
        });
        expect(prismaMock.employee.findFirst).not.toHaveBeenCalled();
    });

    it("rejects a missing Employee at the legacy API session boundary", async () => {
        mockAccount({ employee: null });
        prismaMock.employee.findFirst.mockResolvedValue(null);

        await expect(getApiAuthSession()).resolves.toBeNull();
        expect(prismaMock.employee.findFirst).toHaveBeenCalledWith({
            where: {
                user: { id: 1 },
                status: "ACTIVE",
                deletedAt: null,
            },
            select: { id: true },
        });
    });

    it("returns the legacy unauthorized response from requireApiSession", async () => {
        mockAccount({ employee: null });
        prismaMock.employee.findFirst.mockResolvedValue(null);

        const result = await requireApiSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("does not authorize an ADMIN without an eligible Employee", async () => {
        mockAccount({ role: "ADMIN", employee: null });
        prismaMock.employee.findFirst.mockResolvedValue(null);

        const result = await requireAdminSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("rejects an account linked to an inactive Employee", async () => {
        mockAccount({ employee: { status: "INACTIVE", deletedAt: null } });

        await expect(getApiAuthSession()).resolves.toBeNull();
    });

    it.each([
        ["suspended", { status: "SUSPENDED" as const, deletedAt: null }],
        ["deleted", { status: "ACTIVE" as const, deletedAt: new Date() }],
    ])("rejects an account linked to a %s Employee", async (_label, employee) => {
        mockAccount({ employee });

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
