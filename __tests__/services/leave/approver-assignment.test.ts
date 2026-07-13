import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    ApproverAssignmentError,
    assignLeaveApprovers,
} from "@/lib/services/leave/approver-assignment";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
        employee: { findMany: vi.fn(), update: vi.fn() },
        leaveRequest: { findMany: vi.fn(), updateMany: vi.fn() },
        notification: { updateMany: vi.fn() },
        notificationOutbox: {
            findMany: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
        },
        auditLog: { create: vi.fn() },
    },
}));

const ACTOR = { userId: 1, email: "admin@thainhf.org" };
const ACTIVE_APPROVER = {
    id: 20,
    firstName: "New",
    lastName: "Manager",
    email: "stale@temp.local",
    status: "ACTIVE",
    deletedAt: null,
    user: {
        id: 200,
        email: "manager@thainhf.org",
        isActive: true,
        deletedAt: null,
    },
};

type ApproverFixture = Omit<typeof ACTIVE_APPROVER, "deletedAt" | "user"> & {
    deletedAt: Date | null;
    user: (typeof ACTIVE_APPROVER)["user"] | null;
};

function pendingRequest(id: string) {
    return {
        id,
        employeeId: 10,
        leaveType: "VACATION",
        startDate: new Date("2031-05-05T00:00:00.000Z"),
        endDate: new Date("2031-05-05T00:00:00.000Z"),
        period: "FULL_DAY",
        durationDays: 1,
        reason: "พักร้อน",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
        status: "PENDING",
        employee: {
            id: 10,
            firstName: "Employee",
            lastName: "User",
            email: "employee@thainhf.org",
            user: { id: 100 },
        },
    };
}

function mockLookup(
    approver: ApproverFixture | null = ACTIVE_APPROVER,
    requests: ReturnType<typeof pendingRequest>[] = [],
): void {
    vi.mocked(prisma.employee.findMany)
        .mockResolvedValueOnce([{ id: 10, managerId: 15 }] as never)
        .mockResolvedValueOnce(approver ? [approver] as never : []);
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue(requests as never);
    vi.mocked(prisma.notificationOutbox.findMany).mockResolvedValue([]);
}

describe("assignLeaveApprovers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
            if (typeof callback === "function") return callback(prisma);
            return callback;
        });
        vi.mocked(prisma.employee.update).mockResolvedValue({ id: 10 } as never);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.notificationOutbox.update).mockResolvedValue({ id: 1 } as never);
        vi.mocked(prisma.notificationOutbox.create).mockResolvedValue({ id: 2 } as never);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 1 } as never);
    });

    it.each([
        ["inactive", { status: "INACTIVE" as const, deletedAt: null }],
        ["deleted", { status: "ACTIVE" as const, deletedAt: new Date() }],
    ])("rejects an %s employee as approver", async (_label, state) => {
        mockLookup({ ...ACTIVE_APPROVER, ...state });

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        )).rejects.toBeInstanceOf(ApproverAssignmentError);
        expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it("rejects an approver without an active usable account", async () => {
        mockLookup({
            ...ACTIVE_APPROVER,
            user: { ...ACTIVE_APPROVER.user, isActive: false },
        });

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        )).rejects.toMatchObject({ statusCode: 400 });
    });

    it.each([
        ["missing", null],
        ["temporary", { ...ACTIVE_APPROVER.user, email: "manager@temp.local" }],
    ])("rejects an approver with a %s account", async (_label, user) => {
        mockLookup({ ...ACTIVE_APPROVER, user });

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        )).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects self-assignment", async () => {
        vi.mocked(prisma.employee.findMany)
            .mockResolvedValueOnce([{ id: 10, managerId: 15 }] as never)
            .mockResolvedValueOnce([ACTIVE_APPROVER] as never);
        vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([]);
        vi.mocked(prisma.notificationOutbox.findMany).mockResolvedValue([]);

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 10 }],
            ACTOR,
        )).rejects.toMatchObject({ statusCode: 400 });
        expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it("atomically transfers every pending request and targets the account email", async () => {
        mockLookup(ACTIVE_APPROVER, [pendingRequest("leave-1"), pendingRequest("leave-2")]);

        const result = await assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        );

        expect(result.transferredLeaveRequestCount).toBe(2);
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["leave-1", "leave-2"] }, status: "PENDING" },
            data: { approverId: 20 },
        });
        expect(prisma.notification.updateMany).toHaveBeenCalledTimes(2);
        expect(prisma.notificationOutbox.create).toHaveBeenCalledTimes(2);
        const payload = JSON.parse(
            vi.mocked(prisma.notificationOutbox.create).mock.calls[0][0].data.payload,
        ) as { approver: { userId: number; email: string } };
        expect(payload.approver).toEqual(expect.objectContaining({
            userId: 200,
            email: "manager@thainhf.org",
        }));
        expect(payload.approver.email).not.toContain("@temp.local");
        const auditDetails = JSON.parse(
            vi.mocked(prisma.auditLog.create).mock.calls[0][0].data.details ?? "{}",
        ) as {
            before?: { managerId?: number | null };
            after?: { managerId?: number | null };
            metadata?: { transferredLeaveRequestIds?: string[] };
        };
        expect(auditDetails).toEqual({
            before: { managerId: 15 },
            after: { managerId: 20 },
            metadata: { transferredLeaveRequestIds: ["leave-1", "leave-2"] },
        });
    });

    it("rewrites an unsent outbox instead of notifying both approvers", async () => {
        const request = pendingRequest("leave-1");
        mockLookup(ACTIVE_APPROVER, [request]);
        vi.mocked(prisma.notificationOutbox.findMany).mockResolvedValue([{
            id: 9,
            payload: JSON.stringify({ leaveId: "leave-1" }),
        }] as never);

        await assignLeaveApprovers([{ employeeId: 10, managerId: 20 }], ACTOR);

        expect(prisma.notificationOutbox.update).toHaveBeenCalledWith({
            where: { id: 9 },
            data: { payload: expect.stringContaining("manager@thainhf.org") },
        });
        expect(prisma.notificationOutbox.create).not.toHaveBeenCalled();
        expect(prisma.notification.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({ userId: { not: 200 }, isRead: false }),
            data: { isRead: true },
        });
    });

    it("propagates a transaction failure so the database rolls back all writes", async () => {
        mockLookup(ACTIVE_APPROVER, [pendingRequest("leave-1")]);
        vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("audit failed"));

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        )).rejects.toThrow("audit failed");
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
});
