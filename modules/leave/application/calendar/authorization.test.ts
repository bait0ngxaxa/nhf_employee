import { describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";
import { assertCalendarAdmin, getCalendarAdminEmployeeIdHint } from "./authorization";

vi.mock("@/lib/db/row-locks", () => ({ lockEmployeeRows: vi.fn(), lockUserRows: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

describe("calendar control-plane authorization", () => {
    it("requires current persisted active ADMIN and active workforce", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.user.findFirst.mockResolvedValue(null);
        await expect(assertCalendarAdmin(tx, { userId: 1, channel: "DASHBOARD" }, null)).rejects.toMatchObject({ statusCode: 403 });
        expect(tx.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ role: "ADMIN", isActive: true, deletedAt: null, employee: { is: { status: "ACTIVE", deletedAt: null } } }) }));
    });
    it("accepts the persisted ADMIN without trusting a client role", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.user.findFirst.mockResolvedValue({ id: 1, email: "admin@test" } as never);
        await expect(assertCalendarAdmin(tx, { userId: 1, channel: "DASHBOARD" }, 7)).resolves.toMatchObject({ id: 1 });
        expect(tx.user.findUnique).not.toHaveBeenCalled();
        expect(lockEmployeeRows).toHaveBeenLastCalledWith(tx, [7]);
        expect(lockUserRows).toHaveBeenLastCalledWith(tx, [1]);
        expect(tx.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ employeeId: 7 }) }));
    });
    it("fails closed for a forged LIFF channel", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        await expect(assertCalendarAdmin(tx, { userId: 1, channel: "LIFF_SELF_SERVICE" } as never, 7)).rejects.toMatchObject({ statusCode: 403 });
        expect(tx.user.findFirst).not.toHaveBeenCalled();
    });
    it("reads only an Employee lock hint before the transaction, without treating it as authorization", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ employeeId: 7 } as never);
        await expect(getCalendarAdminEmployeeIdHint({ userId: 1, channel: "DASHBOARD" })).resolves.toBe(7);
        expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 }, select: { employeeId: true } });
    });
});
