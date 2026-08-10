import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, verifyLiffSessionMock, userFindUniqueMock } = vi.hoisted(() => ({
    cookiesMock: vi.fn(),
    verifyLiffSessionMock: vi.fn(),
    userFindUniqueMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
    cookies: cookiesMock,
}));

vi.mock("@/lib/line/liff-session", () => ({
    LIFF_SESSION_COOKIE_NAME: "nhf_liff_session",
    verifyLiffSession: verifyLiffSessionMock,
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        user: {
            findUnique: userFindUniqueMock,
        },
    },
}));

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { LineIdentityVerificationError } from "@/lib/line/errors";

const ACTIVE_USER = {
    id: 10,
    role: "USER",
    email: "employee@example.com",
    name: "Employee",
    isActive: true,
    deletedAt: null,
    employeeId: 20,
    employee: {
        id: 20,
        status: "ACTIVE",
        deletedAt: null,
    },
};

function setCookieValue(value: string | undefined): void {
    cookiesMock.mockResolvedValue({
        get: vi.fn().mockReturnValue(value ? { value } : undefined),
    });
}

describe("requireLiffWorkforceSession", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setCookieValue("liff-session");
        verifyLiffSessionMock.mockResolvedValue({
            userId: 10,
            employeeId: 20,
        });
        userFindUniqueMock.mockResolvedValue(ACTIVE_USER);
    });

    it("returns the current trusted user and employee identity", async () => {
        await expect(requireLiffWorkforceSession()).resolves.toEqual({
            ok: true,
            user: {
                id: 10,
                role: "USER",
                email: "employee@example.com",
                name: "Employee",
            },
            employeeId: 20,
        });
    });

    it("rejects a missing cookie with 401", async () => {
        setCookieValue(undefined);

        const result = await requireLiffWorkforceSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(401);
        expect(verifyLiffSessionMock).not.toHaveBeenCalled();
    });

    it.each([
        ["malformed token", new Error("Invalid LIFF session")],
        ["invalid signature", new Error("signature failed")],
        ["expired token", new Error("expired")],
        ["wrong session purpose", new Error("purpose mismatch")],
    ])("rejects an %s with 401", async (_label, error) => {
        verifyLiffSessionMock.mockRejectedValueOnce(error);

        const result = await requireLiffWorkforceSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("maps session configuration failure to 500", async () => {
        verifyLiffSessionMock.mockRejectedValueOnce(
            new LineIdentityVerificationError(
                "MISCONFIGURED",
                "internal configuration",
            ),
        );

        const result = await requireLiffWorkforceSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(500);
    });

    it.each([
        ["inactive user", { ...ACTIVE_USER, isActive: false }],
        ["deleted user", { ...ACTIVE_USER, deletedAt: new Date() }],
        [
            "inactive employee",
            { ...ACTIVE_USER, employee: { ...ACTIVE_USER.employee, status: "INACTIVE" } },
        ],
        [
            "deleted employee",
            { ...ACTIVE_USER, employee: { ...ACTIVE_USER.employee, deletedAt: new Date() } },
        ],
        ["changed employee relationship", { ...ACTIVE_USER, employeeId: 99 }],
    ])("rejects an %s with 403", async (_label, user) => {
        userFindUniqueMock.mockResolvedValueOnce(user);

        const result = await requireLiffWorkforceSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(403);
    });

    it("does not trust an employee ID that differs from the current employee", async () => {
        verifyLiffSessionMock.mockResolvedValueOnce({
            userId: 10,
            employeeId: 99,
        });

        const result = await requireLiffWorkforceSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(403);
    });
});
