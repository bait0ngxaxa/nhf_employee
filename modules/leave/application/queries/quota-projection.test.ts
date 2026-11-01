import { describe, expect, it, vi } from "vitest";
import type { LeaveQuota } from "@prisma/client";
import { projectLeaveQuotas, getEmployeeLeaveQuotaProjection } from "./quota-projection";
import { prisma } from "@/lib/db/prisma";
import { ensureLeaveQuotaForYear } from "../../domain/quota-entitlement";
import { mockDeep } from "vitest-mock-extended";
import type { Prisma } from "@prisma/client";

vi.mock("@/lib/db/prisma", () => ({ prisma: { leaveQuota: { findMany: vi.fn() } } }));
const row = (year: number, usedHalfDays: number, carryBalanceHalfDays = 0): LeaveQuota => ({
    id: `p-${year}`, employeeId: 1, year, leaveType: "PERSONAL", totalHalfDays: 20,
    usedHalfDays, carryBalanceHalfDays,
});

describe("read-only quota projection", () => {
    it.each([
        [2026, [], 0, 0],
        [2025, [row(2026, 4)], 0, 0],
        [2026, [row(2026, 3)], 0, 1.5],
        [2027, [row(2026, 6)], 7, 0],
        [2027, [row(2026, 25)], -2.5, 0],
        [2029, [row(2026, 25)], 17.5, 0],
        [2027, [row(2026, 6), row(2027, 1, 14)], 7, 0.5],
    ])("projects %s with records %j", async (year, rows, carry, used) => {
        const projected = projectLeaveQuotas(1, year, rows).find((quota) => quota.leaveType === "PERSONAL");
        expect(projected).toMatchObject({ year, totalDays: 10, carryBalanceDays: carry, usedDays: used, remainingDays: 10 + carry - used });
        // Compare against the authoritative mutation initialization using identical persisted inputs.
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.leaveQuota.findFirst.mockResolvedValue(rows.filter((r) => r.year < year).sort((a, b) => b.year - a.year)[0] ?? null);
        await ensureLeaveQuotaForYear(tx, { employeeId: 1, year, leaveType: "PERSONAL" });
        expect(tx.leaveQuota.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({ carryBalanceHalfDays: carry * 2 }),
        }));
    });

    it("does not carry sick leave, leak another employee or mutate records", () => {
        const rows: LeaveQuota[] = [{ ...row(2026, 80, -3), leaveType: "SICK" }, { ...row(2026, 0), employeeId: 2 }];
        const before = structuredClone(rows);
        expect(projectLeaveQuotas(1, 2027, rows).map((quota) => quota.carryBalanceDays)).toEqual([0, 0, 0]);
        expect(rows).toEqual(before);
    });

    it("concurrent reads only require findMany and never create quota rows", async () => {
        vi.mocked(prisma.leaveQuota.findMany).mockResolvedValue([]);
        const results = await Promise.all(Array.from({ length: 5 }, () => getEmployeeLeaveQuotaProjection(1, 2031)));
        expect(results.every((quotas) => quotas.length === 3)).toBe(true);
        expect(prisma.leaveQuota.findMany).toHaveBeenCalledWith({ where: { employeeId: 1, year: { lte: 2031 } } });
    });
});
