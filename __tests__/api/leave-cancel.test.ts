import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, PUT } from "@/app/api/leave/cancel/route";
import { POST as requestNotTaken } from "@/app/api/leave/not-taken/route";
import { requireApiSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { logLeaveEvent } from "@/lib/server/audit";
import { processOutbox } from "@/lib/services/outbox/processor";
import type * as NextServerModule from "next/server";

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return { ...actual, after: vi.fn((callback) => callback()) };
});

vi.mock("@/lib/auth/api", () => ({ requireApiSession: vi.fn() }));
vi.mock("@/lib/services/leave/get-employee-id", () => ({ getEmployeeIdFromUserId: vi.fn() }));
vi.mock("@/lib/services/outbox/processor", () => ({ processOutbox: vi.fn() }));
vi.mock("@/lib/server/audit", () => ({ logLeaveEvent: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
        $queryRaw: vi.fn(),
        user: { findUnique: vi.fn(), findFirst: vi.fn() },
        leaveRequest: {
            findUnique: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
            findUniqueOrThrow: vi.fn(),
        },
        employee: { findUnique: vi.fn(), findMany: vi.fn() },
        notification: { updateMany: vi.fn(), create: vi.fn() },
        notificationOutbox: { create: vi.fn() },
        leaveQuota: { findFirst: vi.fn(), update: vi.fn() },
        auditLog: { create: vi.fn() },
    },
}));

function buildCancellationRequest(
    overrides: Record<string, unknown> = {},
): Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>> {
    return {
        id: "leave-cancellation",
        employeeId: 10,
        leaveType: "VACATION",
        startDate: new Date("2099-01-10T00:00:00.000Z"),
        endDate: new Date("2099-01-10T00:00:00.000Z"),
        period: "FULL_DAY",
        durationHalfDays: 2,
        reason: "พักร้อน",
        emergencyReason: null,
        specialReason: null,
        overQuotaHalfDays: 0,
        status: "CANCELLATION_REQUESTED",
        approverId: 20,
        exceptionApproverId: null,
        exceptionApproverAssignedAt: null,
        approvedAt: new Date("2098-12-20T00:00:00.000Z"),
        rejectReason: null,
        notTakenReason: null,
        notTakenRequestedAt: null,
        notTakenConfirmedAt: null,
        notTakenConfirmedById: null,
        cancellationReason: "กำหนดการเปลี่ยนแปลง",
        cancellationRequestedAt: new Date("2098-12-21T00:00:00.000Z"),
        cancellationConfirmedAt: null,
        cancellationConfirmedById: null,
        attachmentUrl: null,
        createdAt: new Date("2098-12-20T00:00:00.000Z"),
        updatedAt: new Date("2098-12-21T00:00:00.000Z"),
        employee: {
            id: 10,
            firstName: "Employee",
            lastName: "User",
            email: "employee@example.com",
            user: { id: 10 },
        },
        approver: {
            id: 20,
            firstName: "Manager",
            lastName: "User",
            email: "manager@example.com",
            status: "ACTIVE",
            deletedAt: null,
            user: {
                id: 20,
                email: "manager@example.com",
                isActive: true,
                deletedAt: null,
            },
        },
        ...overrides,
    } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>;
}

describe("POST /api/leave/cancel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "10", email: "employee@example.com", name: "Employee", role: "USER" } },
            user: { id: 10, email: "employee@example.com", name: "Employee", role: "USER" },
        });
        vi.mocked(getEmployeeIdFromUserId).mockResolvedValue(10);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            employee: { id: 10, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 10 } as never);
        vi.mocked(prisma.employee.findUnique).mockResolvedValue({ manager: null } as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 1 } as never);
        vi.mocked(logLeaveEvent).mockResolvedValue(undefined);
        vi.mocked(processOutbox).mockResolvedValue({ processed: 0, failed: 0 });
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
            if (typeof callback === "function") return callback(prisma);
            return callback;
        });
    });

    it("cancels a pending request even when its former approver has no account", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-1", employeeId: 10, leaveType: "SICK", startDate: new Date(), endDate: new Date(),
            period: "FULL_DAY", durationHalfDays: 2, reason: "ลาป่วย", emergencyReason: null, specialReason: null,
            overQuotaHalfDays: 0, status: "PENDING", approverId: 20, exceptionApproverId: null, exceptionApproverAssignedAt: null, approvedAt: null, rejectReason: null,
            notTakenReason: null, notTakenRequestedAt: null, notTakenConfirmedAt: null, notTakenConfirmedById: null,
            cancellationReason: null, cancellationRequestedAt: null, cancellationConfirmedAt: null, cancellationConfirmedById: null,
            attachmentUrl: null, createdAt: new Date(), updatedAt: new Date(),
            employee: { id: 10, firstName: "Employee", lastName: "User", email: "employee@example.com", user: { id: 10 } },
            approver: null,
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            id: "leave-1",
            durationHalfDays: 2,
            overQuotaHalfDays: 0,
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);

        const response = await POST(new NextRequest("http://localhost/api/leave/cancel", {
            method: "POST", body: JSON.stringify({ leaveId: "leave-1" }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: { id: "leave-1", status: "PENDING" }, data: { status: "CANCELLED" },
        });
        expect(prisma.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 10,
                type: "LEAVE_CANCELLED",
                referenceId: "leave-1",
            }),
        });
        expect(prisma.notificationOutbox.create).not.toHaveBeenCalled();
    });

    it("rolls back the leave status when creating the outbox fails", async () => {
        let persistedStatus = "PENDING";
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
            if (typeof callback !== "function") return callback;
            let transactionStatus = persistedStatus;
            vi.mocked(prisma.leaveRequest.updateMany).mockImplementation(
                (() => {
                    transactionStatus = "CANCELLED";
                    return Promise.resolve({ count: 1 });
                }) as never,
            );
            const result = await callback(prisma);
            persistedStatus = transactionStatus;
            return result;
        });
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-2", employeeId: 10, leaveType: "SICK", startDate: new Date(), endDate: new Date(),
            period: "FULL_DAY", durationHalfDays: 2, reason: "ลาป่วย", emergencyReason: null, specialReason: null,
            overQuotaHalfDays: 0, status: "PENDING", approverId: 20, exceptionApproverId: null, exceptionApproverAssignedAt: null, approvedAt: null, rejectReason: null,
            notTakenReason: null, notTakenRequestedAt: null, notTakenConfirmedAt: null, notTakenConfirmedById: null,
            cancellationReason: null, cancellationRequestedAt: null, cancellationConfirmedAt: null, cancellationConfirmedById: null,
            attachmentUrl: null, createdAt: new Date(), updatedAt: new Date(),
            employee: { id: 10, firstName: "Employee", lastName: "User", email: "employee@example.com", user: { id: 10 } },
             approver: { id: 20, firstName: "Manager", lastName: "User", email: "manager@example.com", status: "ACTIVE", deletedAt: null, user: { id: 20, email: "manager@example.com", isActive: true, deletedAt: null } },
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>);
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue(
            {
                id: "leave-2",
                status: "CANCELLED",
                durationHalfDays: 2,
                overQuotaHalfDays: 0,
            } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>,
        );
        vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.notificationOutbox.create).mockRejectedValue(new Error("outbox unavailable"));

        const response = await POST(new NextRequest("http://localhost/api/leave/cancel", {
            method: "POST", body: JSON.stringify({ leaveId: "leave-2" }),
        }));

        expect(response.status).toBe(500);
        expect(persistedStatus).toBe("PENDING");
        expect(prisma.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_CANCELLED",
                userId: 10,
                referenceId: "leave-2",
            }),
        });
        expect(processOutbox).not.toHaveBeenCalled();
    });

    it("requests cancellation for an approved future leave and stores the reason", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-approved",
            employeeId: 10,
            leaveType: "VACATION",
            startDate: new Date("2099-01-10T00:00:00.000Z"),
            endDate: new Date("2099-01-10T00:00:00.000Z"),
            period: "FULL_DAY",
            durationHalfDays: 2,
            reason: "พักร้อน",
            emergencyReason: null,
            specialReason: null,
            overQuotaHalfDays: 0,
            status: "APPROVED",
            approverId: 20,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            approvedAt: new Date("2098-12-20T00:00:00.000Z"),
            rejectReason: null,
            notTakenReason: null,
            notTakenRequestedAt: null,
            notTakenConfirmedAt: null,
            notTakenConfirmedById: null,
            cancellationReason: null,
            cancellationRequestedAt: null,
            cancellationConfirmedAt: null,
            cancellationConfirmedById: null,
            attachmentUrl: null,
            createdAt: new Date("2098-12-20T00:00:00.000Z"),
            updatedAt: new Date("2098-12-20T00:00:00.000Z"),
            employee: {
                id: 10,
                firstName: "Employee",
                lastName: "User",
                email: "employee@example.com",
                user: { id: 10 },
            },
            approver: {
                id: 20,
                firstName: "Manager",
                lastName: "User",
                email: "manager@example.com",
                status: "ACTIVE",
                deletedAt: null,
                user: { id: 20, email: "manager@example.com", isActive: true, deletedAt: null },
            },
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            id: "leave-approved",
            status: "CANCELLATION_REQUESTED",
            durationHalfDays: 2,
            overQuotaHalfDays: 0,
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);
        vi.mocked(prisma.notificationOutbox.create).mockResolvedValue({} as never);

        const response = await POST(new NextRequest("http://localhost/api/leave/cancel", {
            method: "POST",
            body: JSON.stringify({ leaveId: "leave-approved", reason: "กำหนดการเปลี่ยนแปลง" }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                id: "leave-approved",
                status: "APPROVED",
                cancellationRequestedAt: null,
            }),
            data: expect.objectContaining({
                status: "CANCELLATION_REQUESTED",
                cancellationReason: "กำหนดการเปลี่ยนแปลง",
            }),
        });
        expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ type: "LEAVE_CANCELLATION_REQUESTED" }),
        });
    });

    it("routes cancellation to the current manager when the original approver is inactive", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(buildCancellationRequest({
            status: "APPROVED",
            cancellationReason: null,
            cancellationRequestedAt: null,
            approver: {
                id: 20,
                firstName: "Former",
                lastName: "Manager",
                email: "former@example.com",
                status: "INACTIVE",
                deletedAt: null,
                user: null,
            },
        }));
        vi.mocked(prisma.employee.findUnique).mockResolvedValue({
            manager: {
                id: 30,
                firstName: "Current",
                lastName: "Manager",
                email: "current@example.com",
                status: "ACTIVE",
                deletedAt: null,
                user: {
                    id: 30,
                    email: "current@example.com",
                    isActive: true,
                    deletedAt: null,
                },
            },
        } as never);
        vi.mocked(prisma.leaveRequest.update).mockResolvedValue({ id: "leave-cancellation" } as never);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            ...buildCancellationRequest({
                status: "CANCELLATION_REQUESTED",
                cancellationRequestedAt: new Date("2098-12-21T00:00:00.000Z"),
            }),
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);
        vi.mocked(prisma.notificationOutbox.create).mockResolvedValue({} as never);

        const response = await POST(new NextRequest("http://localhost/api/leave/cancel", {
            method: "POST",
            body: JSON.stringify({ leaveId: "leave-cancellation", reason: "ย้ายกำหนดการ" }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveRequest.update).toHaveBeenCalledWith({
            where: { id: "leave-cancellation" },
            data: {
                exceptionApproverId: 30,
                exceptionApproverAssignedAt: expect.any(Date),
            },
        });
        expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_CANCELLATION_REQUESTED",
                payload: expect.stringContaining('"employeeId":30'),
            }),
        });
    });

    it("confirms approved leave cancellation and returns quota in one transaction", async () => {
        vi.mocked(prisma.notificationOutbox.create).mockResolvedValue({} as never);
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "20", email: "manager@example.com", name: "Manager", role: "USER" } },
            user: { id: 20, email: "manager@example.com", name: "Manager", role: "USER" },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 20, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 20 } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-confirm",
            employeeId: 10,
            leaveType: "VACATION",
            startDate: new Date("2099-01-10T00:00:00.000Z"),
            endDate: new Date("2099-01-10T00:00:00.000Z"),
            period: "FULL_DAY",
            durationHalfDays: 2,
            reason: "พักร้อน",
            emergencyReason: null,
            specialReason: null,
            overQuotaHalfDays: 0,
            status: "CANCELLATION_REQUESTED",
            approverId: 20,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            approvedAt: new Date("2098-12-20T00:00:00.000Z"),
            rejectReason: null,
            notTakenReason: null,
            notTakenRequestedAt: null,
            notTakenConfirmedAt: null,
            notTakenConfirmedById: null,
            cancellationReason: "กำหนดการเปลี่ยนแปลง",
            cancellationRequestedAt: new Date("2098-12-21T00:00:00.000Z"),
            cancellationConfirmedAt: null,
            cancellationConfirmedById: null,
            attachmentUrl: null,
            createdAt: new Date("2098-12-20T00:00:00.000Z"),
            updatedAt: new Date("2098-12-21T00:00:00.000Z"),
            employee: {
                id: 10,
                firstName: "Employee",
                lastName: "User",
                email: "employee@example.com",
                user: { id: 10 },
            },
            approver: {
                id: 20,
                firstName: "Manager",
                lastName: "User",
                email: "manager@example.com",
                status: "ACTIVE",
                deletedAt: null,
                user: { id: 20, email: "manager@example.com", isActive: true, deletedAt: null },
            },
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue({
            id: "quota-1",
            employeeId: 10,
            year: 2099,
            leaveType: "VACATION",
            totalHalfDays: 12,
            usedHalfDays: 4,
        });
        vi.mocked(prisma.leaveQuota.update).mockResolvedValue({
            id: "quota-1",
            employeeId: 10,
            year: 2099,
            leaveType: "VACATION",
            totalHalfDays: 12,
            usedHalfDays: 2,
        });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            id: "leave-confirm",
            status: "CANCELLED_AFTER_APPROVAL",
            durationHalfDays: 2,
            overQuotaHalfDays: 0,
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);

        const response = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-confirm" }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveQuota.update).toHaveBeenCalledWith({
            where: { id: "quota-1" },
            data: { usedHalfDays: { decrement: 2 } },
        });
        expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ type: "LEAVE_CANCELLED_AFTER_APPROVAL" }),
        });
    });

    it("allows the assigned current manager to confirm a reassigned cancellation", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "30", email: "current@example.com", name: "Current", role: "USER" } },
            user: { id: 30, email: "current@example.com", name: "Current", role: "USER" },
        });
        vi.mocked(getEmployeeIdFromUserId).mockResolvedValue(30);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 30, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 30 } as never);
        vi.mocked(prisma.employee.findUnique).mockResolvedValue({
            manager: {
                id: 30,
                firstName: "Current",
                lastName: "Manager",
                email: "current@example.com",
                status: "ACTIVE",
                deletedAt: null,
                user: {
                    id: 30,
                    email: "current@example.com",
                    isActive: true,
                    deletedAt: null,
                },
            },
        } as never);
        const initialRequest = buildCancellationRequest({
            approver: {
                id: 20,
                firstName: "Former",
                lastName: "Manager",
                email: "former@example.com",
                status: "INACTIVE",
                deletedAt: null,
                user: null,
            },
            exceptionApprover: null,
            exceptionApproverId: null,
        });
        const assignedRequest = buildCancellationRequest({
            approver: {
                id: 20,
                firstName: "Former",
                lastName: "Manager",
                email: "former@example.com",
                status: "INACTIVE",
                deletedAt: null,
                user: null,
            },
            exceptionApproverId: 30,
            exceptionApproverAssignedAt: new Date("2098-12-21T00:00:00.000Z"),
            exceptionApprover: {
                id: 30,
                firstName: "Current",
                lastName: "Manager",
                email: "current@example.com",
                status: "ACTIVE",
                deletedAt: null,
                user: {
                    id: 30,
                    email: "current@example.com",
                    isActive: true,
                    deletedAt: null,
                },
            },
        });
        vi.mocked(prisma.leaveRequest.findUnique)
            .mockResolvedValueOnce(initialRequest)
            .mockResolvedValueOnce(assignedRequest);
        vi.mocked(prisma.leaveRequest.update).mockResolvedValue({ id: "leave-cancellation" } as never);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue({
            id: "quota-fallback",
            employeeId: 10,
            year: 2099,
            leaveType: "VACATION",
            totalHalfDays: 12,
            usedHalfDays: 4,
        });
        vi.mocked(prisma.leaveQuota.update).mockResolvedValue({
            id: "quota-fallback",
            usedHalfDays: 2,
        } as never);
        vi.mocked(prisma.notificationOutbox.create).mockResolvedValue({} as never);
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            ...assignedRequest,
            status: "CANCELLED_AFTER_APPROVAL",
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);

        const response = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-cancellation" }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({ exceptionApproverId: 30 }),
            data: expect.objectContaining({ status: "CANCELLED_AFTER_APPROVAL" }),
        });
    });

    it("rejects confirmation after the leave has started without returning quota", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "20", email: "manager@example.com", name: "Manager", role: "USER" } },
            user: { id: 20, email: "manager@example.com", name: "Manager", role: "USER" },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 20, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-expired-confirm",
            employeeId: 10,
            startDate: new Date("2000-01-10T00:00:00.000Z"),
            status: "CANCELLATION_REQUESTED",
            approverId: 20,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            cancellationRequestedAt: new Date("1999-12-20T00:00:00.000Z"),
            cancellationConfirmedAt: null,
            approver: {
                status: "ACTIVE",
                deletedAt: null,
                user: {
                    id: 20,
                    email: "manager@example.com",
                    isActive: true,
                    deletedAt: null,
                },
            },
        } as never);

        const response = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-expired-confirm" }),
        }));

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "ไม่สามารถยืนยันการยกเลิกได้ เนื่องจากวันลาเริ่มแล้ว",
        });
        expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(prisma.leaveQuota.findFirst).not.toHaveBeenCalled();
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
        expect(prisma.notificationOutbox.create).not.toHaveBeenCalled();
    });

    it("rejects a cancellation request before the leave starts without returning quota", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "20", email: "manager@example.com", name: "Manager", role: "USER" } },
            user: { id: 20, email: "manager@example.com", name: "Manager", role: "USER" },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 20, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(buildCancellationRequest());
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            ...buildCancellationRequest(),
            status: "APPROVED",
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);

        const response = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-cancellation", action: "REJECT" }),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                status: "APPROVED",
                cancellationReason: "กำหนดการเปลี่ยนแปลง",
                cancellationRequestedAt: expect.any(String),
                cancellationConfirmedAt: null,
                cancellationConfirmedById: null,
            }),
        }));
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: {
                id: "leave-cancellation",
                status: "CANCELLATION_REQUESTED",
                approverId: 20,
                cancellationRequestedAt: { not: null },
                cancellationConfirmedAt: null,
            },
            data: { status: "APPROVED" },
        });
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
        expect(prisma.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 10,
                type: "SYSTEM_ALERT",
                title: "คำขอยกเลิกวันลาไม่ได้รับการอนุมัติ",
                referenceId: "leave-cancellation",
            }),
        });
        expect(prisma.notificationOutbox.create).not.toHaveBeenCalled();
        expect(logLeaveEvent).toHaveBeenCalledWith(
            "LEAVE_REQUEST_CANCELLATION_CONFIRM",
            "leave-cancellation",
            20,
            "manager@example.com",
            expect.objectContaining({
                before: { status: "CANCELLATION_REQUESTED" },
                after: { status: "APPROVED" },
                metadata: {
                    leaveId: "leave-cancellation",
                    decision: "REJECT",
                },
            }),
        );
    });

    it("rejects a cancellation request after the leave has started", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "20", email: "manager@example.com", name: "Manager", role: "USER" } },
            user: { id: 20, email: "manager@example.com", name: "Manager", role: "USER" },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 20, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(buildCancellationRequest({
            startDate: new Date("2000-01-10T00:00:00.000Z"),
        }));
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            ...buildCancellationRequest({
                startDate: new Date("2000-01-10T00:00:00.000Z"),
                status: "APPROVED",
            }),
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);

        const response = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-cancellation", action: "REJECT" }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
    });

    it("allows the not-taken flow after rejecting a cancellation request", async () => {
        vi.mocked(requireApiSession).mockResolvedValueOnce({
            ok: true,
            session: { user: { id: "20", email: "manager@example.com", name: "Manager", role: "USER" } },
            user: { id: 20, email: "manager@example.com", name: "Manager", role: "USER" },
        }).mockResolvedValueOnce({
            ok: true,
            session: { user: { id: "10", email: "employee@example.com", name: "Employee", role: "USER" } },
            user: { id: 10, email: "employee@example.com", name: "Employee", role: "USER" },
        });
        vi.mocked(prisma.user.findUnique)
            .mockResolvedValueOnce({
                isActive: true,
                deletedAt: null,
                employee: { id: 20, status: "ACTIVE", deletedAt: null },
            } as never)
            .mockResolvedValueOnce({
                isActive: true,
                deletedAt: null,
                employee: { id: 10, status: "ACTIVE", deletedAt: null },
            } as never);
        vi.mocked(prisma.user.findFirst)
            .mockResolvedValueOnce({ id: 20 } as never)
            .mockResolvedValueOnce({ id: 10 } as never);
        vi.mocked(prisma.leaveRequest.findUnique)
            .mockResolvedValueOnce(buildCancellationRequest({
                startDate: new Date("2000-01-10T00:00:00.000Z"),
                endDate: new Date("2000-01-10T00:00:00.000Z"),
            }))
            .mockResolvedValueOnce(buildCancellationRequest({
                status: "APPROVED",
                startDate: new Date("2000-01-10T00:00:00.000Z"),
                endDate: new Date("2000-01-10T00:00:00.000Z"),
            }));
        vi.mocked(prisma.leaveRequest.updateMany)
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            ...buildCancellationRequest({
                status: "APPROVED",
                startDate: new Date("2000-01-10T00:00:00.000Z"),
                endDate: new Date("2000-01-10T00:00:00.000Z"),
            }),
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);

        const rejectResponse = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-cancellation", action: "REJECT" }),
        }));
        const notTakenResponse = await requestNotTaken(new NextRequest(
            "http://localhost/api/leave/not-taken",
            {
                method: "POST",
                body: JSON.stringify({
                    leaveId: "leave-cancellation",
                    note: "ไม่ได้ใช้วันลาเพราะมีงานด่วน",
                }),
            },
        ));

        expect(rejectResponse.status).toBe(200);
        expect(notTakenResponse.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).toHaveBeenLastCalledWith({
            where: expect.objectContaining({
                id: "leave-cancellation",
                status: "APPROVED",
                notTakenRequestedAt: null,
            }),
            data: expect.objectContaining({
                notTakenReason: "ไม่ได้ใช้วันลาเพราะมีงานด่วน",
                notTakenRequestedAt: expect.any(Date),
            }),
        });
    });

    it("rejects a cancellation request only for its original approver", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "30", email: "other@example.com", name: "Other", role: "USER" } },
            user: { id: 30, email: "other@example.com", name: "Other", role: "USER" },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 30, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 30 } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(buildCancellationRequest());

        const response = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-cancellation", action: "REJECT" }),
        }));

        expect(response.status).toBe(403);
        expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("does not allow the leave owner to reject their own cancellation request", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
            buildCancellationRequest({ approverId: 10 }),
        );

        const response = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-cancellation", action: "REJECT" }),
        }));

        expect(response.status).toBe(403);
        expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("allows an admin to reject a cancellation request as a recovery override", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "99", email: "admin@example.com", name: "Admin", role: "ADMIN" } },
            user: { id: 99, email: "admin@example.com", name: "Admin", role: "ADMIN" },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 99, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 99 } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
            buildCancellationRequest({
                approver: {
                    id: 20,
                    firstName: "Former",
                    lastName: "Manager",
                    email: "former@example.com",
                    status: "INACTIVE",
                    deletedAt: null,
                    user: null,
                },
            }),
        );
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue(
            buildCancellationRequest({ status: "APPROVED" }) as Awaited<
                ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>
            >,
        );

        const response = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-cancellation", action: "REJECT" }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                id: "leave-cancellation",
                status: "CANCELLATION_REQUESTED",
            }),
            data: { status: "APPROVED" },
        });
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "LEAVE_REQUEST_CANCELLATION_CONFIRM",
                userId: 99,
                userEmail: "admin@example.com",
                details: expect.stringContaining('"adminOverride":true'),
            }),
        });
    });

    it("returns conflict and does not notify twice when rejection is duplicated", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "20", email: "manager@example.com", name: "Manager", role: "USER" } },
            user: { id: 20, email: "manager@example.com", name: "Manager", role: "USER" },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 20, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(buildCancellationRequest());
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            ...buildCancellationRequest(),
            status: "APPROVED",
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);
        vi.mocked(prisma.leaveRequest.updateMany)
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 0 });

        const firstResponse = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-cancellation", action: "REJECT" }),
        }));
        const secondResponse = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-cancellation", action: "REJECT" }),
        }));

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(409);
        expect(prisma.notification.create).toHaveBeenCalledTimes(1);
        expect(logLeaveEvent).toHaveBeenCalledTimes(1);
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
    });

    it("allows an admin to confirm approved leave cancellation as a recovery override", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "99", email: "admin@example.com", name: "Admin", role: "ADMIN" } },
            user: { id: 99, email: "admin@example.com", name: "Admin", role: "ADMIN" },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 99, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 99 } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
            buildCancellationRequest({
                id: "leave-confirm",
                approver: {
                    id: 20,
                    firstName: "Former",
                    lastName: "Manager",
                    email: "former@example.com",
                    status: "INACTIVE",
                    deletedAt: null,
                    user: null,
                },
            }),
        );
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue({
            id: "quota-1",
            employeeId: 10,
            year: 2099,
            leaveType: "VACATION",
            totalHalfDays: 12,
            usedHalfDays: 4,
        });
        vi.mocked(prisma.leaveQuota.update).mockResolvedValue({
            id: "quota-1",
            usedHalfDays: 2,
        } as never);
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue(
            buildCancellationRequest({
                id: "leave-confirm",
                status: "CANCELLED_AFTER_APPROVAL",
            }) as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>,
        );
        vi.mocked(prisma.notificationOutbox.create).mockResolvedValue({} as never);

        const response = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-confirm" }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveQuota.update).toHaveBeenCalledWith({
            where: { id: "quota-1" },
            data: { usedHalfDays: { decrement: 2 } },
        });
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "LEAVE_REQUEST_CANCELLATION_CONFIRM",
                userId: 99,
                userEmail: "admin@example.com",
                details: expect.stringContaining('"adminOverride":true'),
            }),
        });
    });
});
