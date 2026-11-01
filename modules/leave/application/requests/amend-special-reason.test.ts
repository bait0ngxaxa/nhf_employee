import type * as AuthorizationModule from "../authorization";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { LeaveRequest, Prisma } from "@prisma/client";
import { amendPendingLeaveSpecialReason } from "./amend-special-reason";
import { assertLeaveCapabilityScope, buildLeaveAuthorizationContext, resolveLeaveCapabilityInTransaction } from "../authorization";
import { createLeaveAuditInTransaction, lockLeaveRequestRow } from "../../infrastructure/persistence/transaction";
import { runSerializableTransaction } from "@/lib/db/transaction";

vi.mock("@/lib/db/transaction", () => ({ runSerializableTransaction: vi.fn() }));
vi.mock("../authorization", async (original) => ({ ...await original<typeof AuthorizationModule>(), resolveLeaveCapabilityInTransaction: vi.fn(), assertLeaveCapabilityScope: vi.fn() }));
vi.mock("../../infrastructure/persistence/transaction", () => ({ createLeaveAuditInTransaction: vi.fn(), lockLeaveRequestRow: vi.fn() }));

const tx = mockDeep<Prisma.TransactionClient>();
const request = { id: "leave-1", employeeId: 1, status: "PENDING", specialReason: null, leaveType: "PERSONAL", startDate: new Date("2031-01-06"), endDate: new Date("2031-01-06"), period: "FULL_DAY", durationHalfDays: 2 } as LeaveRequest;
const input = { leaveId: request.id, specialReason: "ต้องดูแลครอบครัวเป็นกรณีพิเศษ", expectedSpecialReason: null };

describe.each(["DASHBOARD", "LIFF_SELF_SERVICE"] as const)("%s pending amendment", (channel) => {
    const actor = { authorization: buildLeaveAuthorizationContext({ id: 10, role: "USER" }, 1, channel), userEmail: "employee@example.test" };
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(runSerializableTransaction).mockImplementation((callback) => callback(tx));
        vi.mocked(assertLeaveCapabilityScope).mockReturnValue({ actor: actor.authorization.authorizationActor } as never);
        vi.mocked(resolveLeaveCapabilityInTransaction).mockResolvedValue({ actor: actor.authorization.authorizationActor } as never);
        tx.leaveRequest.findUnique.mockResolvedValue(request);
        tx.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
    });

    it("only writes the special reason and audits the requester", async () => {
        await expect(amendPendingLeaveSpecialReason(actor, input)).resolves.toMatchObject({ changed: true });
        expect(resolveLeaveCapabilityInTransaction).toHaveBeenCalledWith(tx, actor.authorization, "leave.request.create");
        expect(assertLeaveCapabilityScope).toHaveBeenCalledWith(expect.anything(), "OWN");
        expect(lockLeaveRequestRow).toHaveBeenCalledWith(tx, request.id);
        expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith({ where: { id: request.id, employeeId: 1, status: "PENDING", specialReason: null }, data: { specialReason: input.specialReason } });
        expect(createLeaveAuditInTransaction).toHaveBeenCalledWith(tx, "LEAVE_REQUEST_SPECIAL_REASON_UPDATE", request.id, 10, actor.userEmail, expect.objectContaining({ before: { status: "PENDING", specialReason: null }, after: { status: "PENDING", specialReason: input.specialReason } }));
        expect(tx.leaveQuota.update).not.toHaveBeenCalled();
    });

    it("rejects another owner", async () => {
        tx.leaveRequest.findUnique.mockResolvedValue({ ...request, employeeId: 2 });
        await expect(amendPendingLeaveSpecialReason(actor, input)).rejects.toMatchObject({ statusCode: 404 });
        expect(tx.leaveRequest.updateMany).not.toHaveBeenCalled();
    });

    it.each(["APPROVED", "REJECTED", "CANCELLED", "CANCELLATION_REQUESTED", "NOT_TAKEN", "CANCELLED_AFTER_APPROVAL"] as const)("rejects %s", async (status) => {
        tx.leaveRequest.findUnique.mockResolvedValue({ ...request, status });
        await expect(amendPendingLeaveSpecialReason(actor, input)).rejects.toMatchObject({ statusCode: 409 });
        expect(tx.leaveRequest.updateMany).not.toHaveBeenCalled();
    });

    it("identical retry is a no-op", async () => {
        tx.leaveRequest.findUnique.mockResolvedValue({ ...request, specialReason: input.specialReason });
        await expect(amendPendingLeaveSpecialReason(actor, input)).resolves.toMatchObject({ changed: false });
        expect(tx.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(createLeaveAuditInTransaction).not.toHaveBeenCalled();
    });

    it("conflicts on stale edits and failed conditional updates", async () => {
        tx.leaveRequest.findUnique.mockResolvedValueOnce({ ...request, specialReason: "เหตุผลที่แก้ไขไปก่อนแล้ว" });
        await expect(amendPendingLeaveSpecialReason(actor, input)).rejects.toMatchObject({ statusCode: 409 });
        tx.leaveRequest.findUnique.mockResolvedValueOnce(request);
        tx.leaveRequest.updateMany.mockResolvedValueOnce({ count: 0 });
        await expect(amendPendingLeaveSpecialReason(actor, input)).rejects.toMatchObject({ statusCode: 409 });
        expect(createLeaveAuditInTransaction).not.toHaveBeenCalled();
    });

    it("fails closed when capability resolution fails", async () => {
        vi.mocked(resolveLeaveCapabilityInTransaction).mockRejectedValueOnce(new Error("denied"));
        await expect(amendPendingLeaveSpecialReason(actor, input)).rejects.toThrow("denied");
        expect(tx.leaveRequest.updateMany).not.toHaveBeenCalled();
    });

    it.each(["abcd", "x".repeat(1001), ""])("rejects invalid explanation", async (specialReason) => {
        await expect(amendPendingLeaveSpecialReason(actor, { ...input, specialReason })).rejects.toMatchObject({ statusCode: 400 });
        expect(tx.leaveRequest.updateMany).not.toHaveBeenCalled();
    });
});
