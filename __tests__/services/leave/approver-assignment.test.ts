import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { assignLeaveApprovers } from "@/lib/services/leave/approver-assignment";
import { ACTIVE_LEAVE_EMPLOYEE_QUERY_WHERE } from "@/lib/services/leave/approver-eligibility";
import { formatAuditLogDisplay } from "@/lib/audit-log/display";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
        $queryRaw: vi.fn(),
        employee: { findMany: vi.fn(), update: vi.fn() },
        leaveRequest: { findMany: vi.fn() },
        auditLog: { create: vi.fn() },
    },
}));

const ACTOR = { userId: 1, email: "admin@thainhf.org" };
const ACTIVE_APPROVER = {
    id: 20,
    firstName: "Manager",
    lastName: "User",
    nickname: null,
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
        .mockResolvedValueOnce([buildEmployee(10)] as never)
        .mockResolvedValueOnce([ACTIVE_APPROVER] as never);
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue(
        hasPendingRequest ? [{ employeeId: 10 }] as never : [],
    );
}

function buildEmployee(id: number, managerId: number | null = 15) {
    return {
        id,
        firstName: `Employee ${id}`,
        lastName: "Test",
        nickname: null,
        managerId,
    };
}

function buildApprover(overrides: {
    status?: string;
    deletedAt?: Date | null;
    user?: {
        id: number;
        email: string;
        isActive: boolean;
        deletedAt: Date | null;
    } | null;
} = {}) {
    return {
        ...ACTIVE_APPROVER,
        ...overrides,
        user: overrides.user === undefined ? ACTIVE_APPROVER.user : overrides.user,
    };
}

function mockAssignmentLookup(options: {
    employees?: unknown[];
    approvers?: unknown[];
    pending?: unknown[];
    existingEmployees?: unknown[];
} = {}): void {
    vi.mocked(prisma.employee.findMany)
        .mockResolvedValueOnce((options.employees ?? [buildEmployee(10)]) as never)
        .mockResolvedValueOnce((options.approvers ?? [ACTIVE_APPROVER]) as never);
    if (options.existingEmployees !== undefined || options.employees?.length === 0) {
        vi.mocked(prisma.employee.findMany)
            .mockResolvedValueOnce((options.existingEmployees ?? []) as never);
    }
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue(
        (options.pending ?? []) as never,
    );
}

describe("assignLeaveApprovers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
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
        expect(prisma.employee.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: {
                id: { in: [10] },
                ...ACTIVE_LEAVE_EMPLOYEE_QUERY_WHERE,
            },
        }));
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

    it("rejects duplicate employee IDs before opening a transaction", async () => {
        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }, { employeeId: 10, managerId: null }],
            ACTOR,
        )).rejects.toMatchObject({ statusCode: 400 });

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("returns 404 when an assigned employee does not exist", async () => {
        mockAssignmentLookup({ employees: [], approvers: [] });

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        )).rejects.toMatchObject({ statusCode: 404 });
        expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it.each([
        "inactive employee",
        "soft-deleted employee",
        "employee without a user",
        "inactive user",
        "soft-deleted user",
    ])("rejects assignment to an unavailable %s", async () => {
        mockAssignmentLookup({
            employees: [],
            approvers: [],
            existingEmployees: [{ id: 10 }],
        });

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        )).rejects.toMatchObject({
            statusCode: 400,
            message: "พนักงานต้องเป็นพนักงานที่ใช้งานอยู่และมีบัญชีผู้ใช้ที่เปิดใช้งาน",
        });
        expect(prisma.employee.update).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("rejects self-assignment with status 400", async () => {
        mockAssignmentLookup({ approvers: [] });

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 10 }],
            ACTOR,
        )).rejects.toMatchObject({ statusCode: 400 });
        expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it.each([
        ["inactive employee", buildApprover({ status: "INACTIVE" })],
        ["suspended employee", buildApprover({ status: "SUSPENDED" })],
        ["soft-deleted employee", buildApprover({ deletedAt: new Date() })],
        ["missing user", buildApprover({ user: null })],
        ["inactive user", buildApprover({ user: { ...ACTIVE_APPROVER.user, isActive: false } })],
        ["soft-deleted user", buildApprover({ user: { ...ACTIVE_APPROVER.user, deletedAt: new Date() } })],
        ["empty email", buildApprover({ user: { ...ACTIVE_APPROVER.user, email: "" } })],
        ["invalid email", buildApprover({ user: { ...ACTIVE_APPROVER.user, email: "not-an-email" } })],
        ["temporary email", buildApprover({ user: { ...ACTIVE_APPROVER.user, email: "manager@temp.local" } })],
    ])("rejects an unavailable %s", async (_label, approver) => {
        mockAssignmentLookup({ approvers: [approver] });

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        )).rejects.toMatchObject({ statusCode: 400 });
        expect(prisma.employee.update).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("persists an assignment for a valid approver", async () => {
        mockAssignmentLookup({ approvers: [buildApprover()] });

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        )).resolves.toBeUndefined();

        expect(prisma.employee.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: { managerId: 20 },
        });
        expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it("stores immutable employee and approver names for display", async () => {
        const employee = {
            id: 10,
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: "ชาย",
            managerId: 15,
        };
        const previousApprover = {
            ...buildApprover(),
            id: 15,
            firstName: "วิชัย",
            lastName: "ใจดี",
            nickname: "ชัย",
        };
        const newApprover = {
            ...buildApprover(),
            id: 20,
            firstName: "สุชาติ",
            lastName: "ใจดี",
            nickname: "ชาติ",
        };
        mockAssignmentLookup({
            employees: [employee],
            approvers: [previousApprover, newApprover],
        });

        await assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        );

        const auditCall = vi.mocked(prisma.auditLog.create).mock.calls[0]?.[0];
        const details = JSON.parse(String(auditCall?.data.details)) as Record<string, unknown>;
        expect(formatAuditLogDisplay({
            action: "EMPLOYEE_UPDATE",
            entityType: "EmployeeApprover",
            entityId: 10,
            details,
        }).summary).toBe(
            "เปลี่ยนผู้อนุมัติการลาของ สมชาย ใจดี (ชาย): วิชัย ใจดี (ชัย) → สุชาติ ใจดี (ชาติ)",
        );
    });

    it("does not block a no-op assignment when a pending request exists", async () => {
        mockAssignmentLookup({
            employees: [buildEmployee(10, 20)],
            pending: [{ employeeId: 10, employee: { firstName: "Employee", lastName: "Test" } }],
        });

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }],
            ACTOR,
        )).resolves.toBeUndefined();

        expect(prisma.employee.update).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("includes every pending employee and the all-or-nothing message", async () => {
        mockAssignmentLookup({
            employees: [buildEmployee(10), buildEmployee(11)],
            pending: [
                { employeeId: 11, employee: { firstName: "Pending", lastName: "Employee" } },
            ],
        });

        const error = await assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }, { employeeId: 11, managerId: 20 }],
            ACTOR,
        ).catch((caught: unknown) => caught);
        expect(error).toMatchObject({
            statusCode: 409,
            message: expect.stringContaining("11 (Pending Employee)"),
        });
        expect(error).toHaveProperty("message", expect.stringContaining("รายการทั้งหมดไม่ได้บันทึก"));
        expect(prisma.employee.update).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("does not persist earlier writes when a later write fails", async () => {
        const persistedManagers = new Map<number, number | null>([[10, 15], [11, 16]]);
        const persistedAudits: unknown[] = [];
        vi.mocked(prisma.employee.findMany)
            .mockResolvedValueOnce([buildEmployee(10), buildEmployee(11)] as never)
            .mockResolvedValueOnce([
                buildApprover({}),
                { ...buildApprover(), id: 21 },
            ] as never);
        vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([]);
        vi.mocked(prisma.employee.update).mockImplementation((async ({ where, data }: Prisma.EmployeeUpdateArgs) => {
            const employeeId = where.id;
            if (typeof employeeId !== "number") throw new Error("invalid employee");
            const managerId = data.managerId;
            if (typeof managerId !== "number" && managerId !== null) {
                throw new Error("invalid manager");
            }
            persistedManagers.set(employeeId, managerId);
            if (employeeId === 11) throw new Error("write failed");
            return { id: employeeId } as never;
        }) as never);
        vi.mocked(prisma.auditLog.create).mockImplementation((async ({ data }: Prisma.AuditLogCreateArgs) => {
            persistedAudits.push(data);
            return { id: persistedAudits.length } as never;
        }) as never);
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
            const managersBefore = new Map(persistedManagers);
            const auditsBefore = [...persistedAudits];
            try {
                return await callback(prisma);
            } catch (error) {
                persistedManagers.clear();
                for (const [id, managerId] of managersBefore) persistedManagers.set(id, managerId);
                persistedAudits.splice(0, persistedAudits.length, ...auditsBefore);
                throw error;
            }
        });

        await expect(assignLeaveApprovers(
            [{ employeeId: 10, managerId: 20 }, { employeeId: 11, managerId: 21 }],
            ACTOR,
        )).rejects.toThrow("write failed");

        expect([...persistedManagers]).toEqual([[10, 15], [11, 16]]);
        expect(persistedAudits).toHaveLength(0);
    });
});
