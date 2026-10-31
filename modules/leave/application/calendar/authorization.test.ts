import { describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { Prisma } from "@prisma/client";
import { assertCalendarAdmin } from "./authorization";

vi.mock("@/lib/db/row-locks", () => ({ lockEmployeeRows: vi.fn(), lockUserRows: vi.fn() }));

describe("calendar control-plane authorization", () => {
    it("requires current persisted active ADMIN and active workforce", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.user.findUnique.mockResolvedValue(null);
        tx.user.findFirst.mockResolvedValue(null);
        await expect(assertCalendarAdmin(tx, { userId: 1, channel: "DASHBOARD" })).rejects.toMatchObject({ statusCode: 403 });
        expect(tx.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ role: "ADMIN", isActive: true, deletedAt: null, employee: { is: { status: "ACTIVE", deletedAt: null } } }) }));
    });
    it("accepts the persisted ADMIN without trusting a client role", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.user.findFirst.mockResolvedValue({ id: 1, email: "admin@test" } as never);
        await expect(assertCalendarAdmin(tx, { userId: 1, channel: "DASHBOARD" })).resolves.toMatchObject({ id: 1 });
    });
    it("fails closed for a forged LIFF channel", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        await expect(assertCalendarAdmin(tx, { userId: 1, channel: "LIFF_SELF_SERVICE" } as never)).rejects.toMatchObject({ statusCode: 403 });
        expect(tx.user.findFirst).not.toHaveBeenCalled();
    });
});
