import type { LeaveQuota, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
    ensureLeaveQuotaForYear,
    reconcileLeaveQuotaForward,
} from "./quota-entitlement";

function createQuota(overrides: Partial<LeaveQuota> = {}): LeaveQuota {
    return {
        id: "quota-2026",
        employeeId: 10,
        year: 2026,
        leaveType: "PERSONAL",
        totalHalfDays: 20,
        carryBalanceHalfDays: 0,
        usedHalfDays: 12,
        ...overrides,
    };
}

function createQuotaClientMock() {
    const leaveQuota = {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
    };

    return {
        leaveQuota,
        tx: { leaveQuota } as unknown as Prisma.TransactionClient,
    };
}

describe("leave quota entitlement service", () => {
    it("starts the first live quota year with zero carry", async () => {
        const { leaveQuota, tx } = createQuotaClientMock();
        const created = createQuota({
            year: 2027,
            usedHalfDays: 0,
        });
        leaveQuota.findFirst.mockResolvedValue(null);
        leaveQuota.upsert.mockResolvedValue(created);

        await ensureLeaveQuotaForYear(tx, {
            employeeId: 10,
            year: 2027,
            leaveType: "PERSONAL",
        });

        expect(leaveQuota.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: {
                    totalHalfDays: 20,
                    carryBalanceHalfDays: 0,
                },
                create: expect.objectContaining({
                    totalHalfDays: 20,
                    carryBalanceHalfDays: 0,
                    usedHalfDays: 0,
                }),
            }),
        );
    });

    it("always provisions sick leave with zero carry", async () => {
        const { leaveQuota, tx } = createQuotaClientMock();
        leaveQuota.upsert.mockResolvedValue(createQuota({
            id: "sick-2027",
            year: 2027,
            leaveType: "SICK",
            totalHalfDays: 60,
            carryBalanceHalfDays: 0,
            usedHalfDays: 0,
        }));

        await ensureLeaveQuotaForYear(tx, {
            employeeId: 10,
            year: 2027,
            leaveType: "SICK",
        });

        expect(leaveQuota.findFirst).not.toHaveBeenCalled();
        expect(leaveQuota.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: {
                    totalHalfDays: 60,
                    carryBalanceHalfDays: 0,
                },
                create: expect.objectContaining({
                    totalHalfDays: 60,
                    carryBalanceHalfDays: 0,
                }),
            }),
        );
    });

    it("provisions a target year while accounting for a missing intermediate year", async () => {
        const { leaveQuota, tx } = createQuotaClientMock();
        const quota2026 = createQuota();
        const quota2028 = createQuota({
            id: "quota-2028",
            year: 2028,
            carryBalanceHalfDays: 28,
            usedHalfDays: 0,
        });
        leaveQuota.findFirst.mockResolvedValue(quota2026);
        leaveQuota.upsert.mockResolvedValue(quota2028);

        const result = await ensureLeaveQuotaForYear(tx, {
            employeeId: 10,
            year: 2028,
            leaveType: "PERSONAL",
        });

        expect(result).toEqual(quota2028);
        expect(leaveQuota.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: {
                    totalHalfDays: 20,
                    carryBalanceHalfDays: 28,
                },
                create: expect.objectContaining({
                    year: 2028,
                    carryBalanceHalfDays: 28,
                }),
            }),
        );
    });

    it("cascades restored historical usage without rewriting future usage", async () => {
        const { leaveQuota, tx } = createQuotaClientMock();
        const restored2026 = createQuota({ usedHalfDays: 18 });
        const quota2027 = createQuota({
            id: "quota-2027",
            year: 2027,
            carryBalanceHalfDays: -4,
            usedHalfDays: 10,
        });
        const quota2028 = createQuota({
            id: "quota-2028",
            year: 2028,
            carryBalanceHalfDays: 6,
            usedHalfDays: 4,
        });
        leaveQuota.findMany.mockResolvedValue([quota2027, quota2028]);
        leaveQuota.update
            .mockResolvedValueOnce({
                ...quota2027,
                carryBalanceHalfDays: 2,
            })
            .mockResolvedValueOnce({
                ...quota2028,
                carryBalanceHalfDays: 12,
            });

        await reconcileLeaveQuotaForward(tx, restored2026);

        expect(leaveQuota.update).toHaveBeenNthCalledWith(1, {
            where: { id: "quota-2027" },
            data: {
                totalHalfDays: 20,
                carryBalanceHalfDays: 2,
            },
        });
        expect(leaveQuota.update).toHaveBeenNthCalledWith(2, {
            where: { id: "quota-2028" },
            data: {
                totalHalfDays: 20,
                carryBalanceHalfDays: 12,
            },
        });
        for (const call of leaveQuota.update.mock.calls) {
            expect(call[0].data).not.toHaveProperty("usedHalfDays");
        }
        expect(quota2027.usedHalfDays).toBe(10);
        expect(quota2028.usedHalfDays).toBe(4);
    });

    it("does not propagate sick leave balances into future years", async () => {
        const { leaveQuota, tx } = createQuotaClientMock();

        await reconcileLeaveQuotaForward(tx, createQuota({
            leaveType: "SICK",
            totalHalfDays: 60,
            usedHalfDays: 70,
        }));

        expect(leaveQuota.findMany).not.toHaveBeenCalled();
        expect(leaveQuota.update).not.toHaveBeenCalled();
    });

    it("normalizes base entitlement without changing usage", async () => {
        const { leaveQuota, tx } = createQuotaClientMock();
        const changedQuota = createQuota({
            totalHalfDays: 18,
            usedHalfDays: 7,
        });
        leaveQuota.update.mockResolvedValue({
            ...changedQuota,
            totalHalfDays: 20,
        });
        leaveQuota.findMany.mockResolvedValue([]);

        await reconcileLeaveQuotaForward(tx, changedQuota);

        expect(leaveQuota.update).toHaveBeenCalledWith({
            where: { id: changedQuota.id },
            data: {
                totalHalfDays: 20,
                carryBalanceHalfDays: 0,
            },
        });
        expect(leaveQuota.update.mock.calls[0]?.[0].data).not.toHaveProperty(
            "usedHalfDays",
        );
        expect(changedQuota.usedHalfDays).toBe(7);
    });
});
