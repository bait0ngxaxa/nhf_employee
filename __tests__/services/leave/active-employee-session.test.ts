import { describe, expect, it, vi } from "vitest";

import { isActiveEmployeeInTransaction } from "@/lib/services/leave/active-employee-session";

describe("active employee transaction guards", () => {
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
