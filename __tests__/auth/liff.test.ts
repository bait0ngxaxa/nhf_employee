// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    cookiesMock,
    findAccountIdentityByIdMock,
    findLiffEmployeeByUserIdMock,
    lineAccountLinkFindManyMock,
    lineAccountLinkFindUniqueMock,
} = vi.hoisted(() => ({
    cookiesMock: vi.fn(),
    findAccountIdentityByIdMock: vi.fn(),
    findLiffEmployeeByUserIdMock: vi.fn(),
    lineAccountLinkFindManyMock: vi.fn(),
    lineAccountLinkFindUniqueMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
    cookies: cookiesMock,
}));

vi.mock("@/modules/auth", () => ({
    findAccountIdentityById: findAccountIdentityByIdMock,
}));

vi.mock("@/modules/employee", () => ({
    findLiffEmployeeByUserId: findLiffEmployeeByUserIdMock,
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        lineAccountLink: {
            findMany: lineAccountLinkFindManyMock,
            findUnique: lineAccountLinkFindUniqueMock,
        },
    },
}));

import {
    issueLiffSession,
    requireLiffWorkforceSession,
} from "@/modules/line";

const ACTIVE_ACCOUNT = {
    id: 10,
    role: "USER",
    email: "employee@example.com",
    name: "บัญชีทดสอบ",
    isActive: true,
    deletedAt: null,
};

const ACTIVE_EMPLOYEE = {
    id: 20,
    firstName: "พนักงาน",
    lastName: "ทดสอบ",
    nickname: null,
};

function setCookieValue(value: string | undefined): void {
    cookiesMock.mockResolvedValue({
        get: vi.fn().mockReturnValue(value ? { value } : undefined),
    });
}

describe("requireLiffWorkforceSession", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubEnv("LINE_LIFF_SESSION_SECRET", "test-liff-session-secret");
        vi.stubEnv("LINE_LIFF_SESSION_TTL_SECONDS", "3600");
        findAccountIdentityByIdMock.mockResolvedValue(ACTIVE_ACCOUNT);
        findLiffEmployeeByUserIdMock.mockResolvedValue(ACTIVE_EMPLOYEE);
        setCookieValue(await issueLiffSession({ userId: 10, employeeId: 20 }));
    });

    it("returns the current trusted user and employee identity", async () => {
        await expect(requireLiffWorkforceSession()).resolves.toEqual({
            ok: true,
            user: {
                id: 10,
                role: "USER",
                email: "employee@example.com",
                name: "พนักงาน ทดสอบ",
            },
            employeeId: 20,
        });
        expect(findAccountIdentityByIdMock).toHaveBeenCalledWith(10);
        expect(findLiffEmployeeByUserIdMock).toHaveBeenCalledWith(10, 20);
    });

    it("rejects a missing cookie with 401", async () => {
        setCookieValue(undefined);

        const result = await requireLiffWorkforceSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(401);
        expect(findAccountIdentityByIdMock).not.toHaveBeenCalled();
    });

    it.each([
        "malformed token",
        "invalid signature",
        "wrong session purpose",
    ])("rejects an %s with 401", async () => {
        setCookieValue("not-a-valid-liff-session");

        const result = await requireLiffWorkforceSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("rejects an expired token with 401", async () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date("2026-09-08T00:00:00.000Z"));
            vi.stubEnv("LINE_LIFF_SESSION_TTL_SECONDS", "1");
            const token = await issueLiffSession({ userId: 10, employeeId: 20 });
            vi.setSystemTime(new Date("2026-09-08T00:00:02.000Z"));
            setCookieValue(token);

            const result = await requireLiffWorkforceSession();

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.response.status).toBe(401);
        } finally {
            vi.useRealTimers();
        }
    });

    it("maps session configuration failure to 500", async () => {
        vi.stubEnv("LINE_LIFF_SESSION_SECRET", "");

        const result = await requireLiffWorkforceSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(500);
    });

    it.each([
        ["inactive user", { ...ACTIVE_ACCOUNT, isActive: false }, ACTIVE_EMPLOYEE],
        ["deleted user", { ...ACTIVE_ACCOUNT, deletedAt: new Date() }, ACTIVE_EMPLOYEE],
        ["inactive employee", ACTIVE_ACCOUNT, null],
        ["deleted employee", ACTIVE_ACCOUNT, null],
        ["changed employee relationship", ACTIVE_ACCOUNT, null],
    ])("rejects an %s with 403", async (_label, account, employee) => {
        findAccountIdentityByIdMock.mockReset();
        findAccountIdentityByIdMock.mockResolvedValue(account);
        findLiffEmployeeByUserIdMock.mockReset();
        findLiffEmployeeByUserIdMock.mockResolvedValue(employee);

        const result = await requireLiffWorkforceSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(403);
    });

    it("does not trust an employee ID that differs from the current employee", async () => {
        setCookieValue(await issueLiffSession({ userId: 10, employeeId: 99 }));
        findLiffEmployeeByUserIdMock.mockResolvedValueOnce(null);

        const result = await requireLiffWorkforceSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(403);
        expect(findLiffEmployeeByUserIdMock).toHaveBeenCalledWith(10, 99);
    });

    it("does not reread LineAccountLink during normal post-issuance authorization", async () => {
        await expect(requireLiffWorkforceSession()).resolves.toMatchObject({
            ok: true,
            employeeId: 20,
        });

        expect(lineAccountLinkFindUniqueMock).not.toHaveBeenCalled();
        expect(lineAccountLinkFindManyMock).not.toHaveBeenCalled();
    });
});
