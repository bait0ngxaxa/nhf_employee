import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireApiSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import {
    isActiveEmployeeInTransaction,
    requireActiveEmployeeSession,
} from "@/lib/services/leave/active-employee-session";

vi.mock("@/lib/auth/api", () => ({
    requireApiSession: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        user: { findUnique: vi.fn() },
    },
}));

const ACTIVE_AUTH = {
    ok: true as const,
    session: {
        user: {
            id: "10",
            email: "employee@example.com",
            name: "Employee",
            role: "USER",
        },
    },
    user: {
        id: 10,
        email: "employee@example.com",
        name: "Employee",
        role: "USER",
    },
};

describe("requireActiveEmployeeSession", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireApiSession).mockResolvedValue(ACTIVE_AUTH);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 10, status: "ACTIVE", deletedAt: null },
        } as never);
    });

    it("returns the active employee session", async () => {
        const result = await requireActiveEmployeeSession();

        expect(result).toMatchObject({
            ok: true,
            employeeId: 10,
            user: ACTIVE_AUTH.user,
            session: ACTIVE_AUTH.session,
        });
    });

    it("preserves the 401 response when no session exists", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });

        const result = await requireActiveEmployeeSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(401);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("uses the route contract when the employee profile is missing", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: null,
        } as never);

        const result = await requireActiveEmployeeSession({
            employeeProfileNotFoundResponse: () =>
                NextResponse.json({ error: "ไม่พบโปรไฟล์พนักงาน" }, { status: 404 }),
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.response.status).toBe(404);
            await expect(result.response.json()).resolves.toEqual({
                error: "ไม่พบโปรไฟล์พนักงาน",
            });
        }
    });

    it.each([
        ["inactive", { status: "INACTIVE" as const, deletedAt: null }],
        ["suspended", { status: "SUSPENDED" as const, deletedAt: null }],
        ["soft deleted", { status: "ACTIVE" as const, deletedAt: new Date() }],
    ])("rejects an %s employee with 403", async (_label, employeeState) => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            employee: { id: 10, ...employeeState },
        } as never);

        const result = await requireActiveEmployeeSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(403);
    });

    it("rejects immediately when the valid session user was deactivated in DB", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: false,
            employee: { id: 10, status: "ACTIVE", deletedAt: null },
        } as never);

        const result = await requireActiveEmployeeSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(403);
    });

    it("rejects a soft-deleted user with 403", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: new Date(),
            employee: { id: 10, status: "ACTIVE", deletedAt: null },
        } as never);

        const result = await requireActiveEmployeeSession();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(403);
    });

    it("locks and checks the employee inside the transaction", async () => {
        const tx = {
            $queryRaw: vi.fn().mockResolvedValue([{ id: 10 }]),
            user: {
                findFirst: vi.fn().mockResolvedValue({ id: 10 }),
            },
        } as unknown as {
            $queryRaw: ReturnType<typeof vi.fn>;
            user: { findFirst: ReturnType<typeof vi.fn> };
        };

        await expect(isActiveEmployeeInTransaction(tx as never, 10, 10)).resolves.toBe(true);
        expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
        expect(tx.user.findFirst).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["inactive user"],
        ["soft-deleted user"],
        ["inactive employee"],
        ["soft-deleted employee"],
    ])("fails closed when the transaction snapshot contains an %s", async () => {
        const tx = {
            $queryRaw: vi.fn().mockResolvedValue([]),
            user: {
                findFirst: vi.fn().mockResolvedValue(null),
            },
            employee: {
                findUnique: vi.fn().mockResolvedValue({ id: 10, status: "ACTIVE", deletedAt: null }),
            },
        } as unknown as {
            $queryRaw: ReturnType<typeof vi.fn>;
            user: { findFirst: ReturnType<typeof vi.fn> };
            employee: { findUnique: ReturnType<typeof vi.fn> };
        };

        await expect(isActiveEmployeeInTransaction(tx as never, 10, 10)).resolves.toBe(false);
        expect(tx.employee.findUnique).not.toHaveBeenCalled();
    });

    it("does not fall back when the transaction user delegate is missing", async () => {
        const tx = {
            $queryRaw: vi.fn().mockResolvedValue([]),
            employee: {
                findUnique: vi.fn().mockResolvedValue({ id: 10 }),
            },
        } as never;

        await expect(isActiveEmployeeInTransaction(tx, 10, 10)).rejects.toThrow();
    });
});
