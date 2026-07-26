import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, PUT } from "@/app/api/leave/cancel/route";
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
        leaveRequest: { findUnique: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
        notification: { updateMany: vi.fn(), create: vi.fn() },
        notificationOutbox: { create: vi.fn() },
        leaveQuota: { findFirst: vi.fn(), update: vi.fn() },
    },
}));

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
        vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
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
            overQuotaHalfDays: 0, status: "PENDING", approverId: 20, approvedAt: null, rejectReason: null,
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
            overQuotaHalfDays: 0, status: "PENDING", approverId: 20, approvedAt: null, rejectReason: null,
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

    it("does not allow an admin to confirm approved leave cancellation", async () => {
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

        const response = await PUT(new NextRequest("http://localhost/api/leave/cancel", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-confirm" }),
        }));

        expect(response.status).toBe(403);
        expect(prisma.leaveRequest.findUnique).not.toHaveBeenCalled();
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
    });
});
