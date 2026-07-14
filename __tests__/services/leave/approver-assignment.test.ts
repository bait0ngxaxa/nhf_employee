import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { assignLeaveApprovers } from "@/lib/services/leave/approver-assignment";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
        employee: { findMany: vi.fn(), update: vi.fn() },
        leaveRequest: { findMany: vi.fn() },
        auditLog: { create: vi.fn() },
    },
}));

const ACTOR = { userId: 1, email: "admin@thainhf.org" };
const ACTIVE_APPROVER = {
    id: 20,
    email: "manager@thainhf.org",
    status: "ACTIVE",
    deletedAt: null,
    user: {
        id: 200,
        email: "manager@thainhf.org",
        isActive: true,
        deletedAt: null,
    },
};

function mockLookup(hasPendingRequest: boolean): void {
    vi.mocked(prisma.employee.findMany)
        .mockResolvedValueOnce([{ id: 10, managerId: 15 }] as never)
        .mockResolvedValueOnce([ACTIVE_APPROVER] as never);
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue(
        hasPendingRequest ? [{ employeeId: 10 }] as never : [],
    );
}

describe("assignLeaveApprovers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
            if (typeof callback === "function") return callback(prisma);
            return callback;
        });
        vi.mocked(prisma.employee.update).mockResolvedValue({ id: 10 } as never);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 1 } as never);
    });

    it("blocks a manager change while the employee has a pending leave request", async () => {
        mockLookup(true);

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        )).rejects.toMatchObject({
            statusCode: 409,
            message: expect.stringContaining("กรุณาให้พนักงานยกเลิกคำขอก่อนเปลี่ยนผู้อนุมัติ"),
        });
        expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it("allows a manager change after the pending leave request is cancelled", async () => {
        mockLookup(false);

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        )).resolves.toBeUndefined();
        expect(prisma.employee.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: { managerId: 20 },
        });
    });

    it("does not write an audit entry for a no-op assignment", async () => {
        vi.mocked(prisma.employee.findMany)
            .mockResolvedValueOnce([{ id: 10, firstName: "A", lastName: "One", managerId: 20 }] as never)
            .mockResolvedValueOnce([ACTIVE_APPROVER] as never);
        vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([]);

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        )).resolves.toBeUndefined();

        expect(prisma.employee.update).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("blocks self-assignment before any write", async () => {
        vi.mocked(prisma.employee.findMany)
            .mockResolvedValueOnce([{ id: 10, firstName: "A", lastName: "One", managerId: 20 }] as never)
            .mockResolvedValueOnce([] as never);
        vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([]);

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 10 }],
            ACTOR,
        )).rejects.toMatchObject({ statusCode: 400 });

        expect(prisma.employee.update).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
});
