import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, PUT } from "@/app/api/leave/not-taken/route";
import { getApiAuthSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { processOutbox } from "@/lib/services/outbox/processor";
import type * as NextServerModule from "next/server";

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: vi.fn((callback) => {
            callback();
        }),
    };
});

vi.mock("@/lib/auth/server", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/lib/services/leave/get-employee-id", () => ({
    getEmployeeIdFromUserId: vi.fn(),
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
        $queryRaw: vi.fn(),
        user: { findUnique: vi.fn(), findFirst: vi.fn() },
        notification: {
            create: vi.fn(),
            updateMany: vi.fn(),
        },
        notificationOutbox: {
            create: vi.fn(),
        },
        leaveRequest: {
            findUnique: vi.fn(),
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        leaveQuota: {
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    },
}));

describe("/api/leave/not-taken", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: {
                id: "1",
                email: "employee@example.com",
                name: "Employee",
                role: "USER",
            },
        });
        vi.mocked(getEmployeeIdFromUserId).mockResolvedValue(10);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 10, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 1 } as never);
        vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
        vi.mocked(processOutbox).mockResolvedValue({ processed: 0, failed: 0 });
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
            if (typeof callback === "function") {
                return callback(prisma);
            }
            return callback;
        });
    });

    it("records employee not-taken request for an approved past leave", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-1",
            employeeId: 10,
            leaveType: "SICK",
            startDate: new Date("2000-01-01T00:00:00.000Z"),
            endDate: new Date("2000-01-01T00:00:00.000Z"),
            period: "FULL_DAY",
            durationDays: 1,
            reason: "ลาป่วย",
            emergencyReason: null,
            specialReason: null,
            overQuotaDays: 0,
            status: "APPROVED",
            approverId: 20,
            approvedAt: new Date("2000-01-01T00:00:00.000Z"),
            rejectReason: null,
            notTakenReason: null,
            notTakenRequestedAt: null,
            notTakenConfirmedAt: null,
            notTakenConfirmedById: null,
            attachmentUrl: null,
            createdAt: new Date("2000-01-01T00:00:00.000Z"),
            updatedAt: new Date("2000-01-01T00:00:00.000Z"),
            employee: {
                id: 10,
                firstName: "Employee",
                lastName: "User",
                email: "employee@example.com",
                user: { id: 1 },
            },
            approver: {
                id: 20,
                firstName: "Manager",
                lastName: "User",
                email: "manager@example.com",
                status: "ACTIVE",
                deletedAt: null,
                user: {
                    id: 2,
                    email: "manager-account@thainhf.org",
                    isActive: true,
                    deletedAt: null,
                },
            },
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });

        const req = new NextRequest("http://localhost/api/leave/not-taken", {
            method: "POST",
            body: JSON.stringify({
                leaveId: "leave-1",
                note: "ไม่ได้ลาเพราะมีงานด่วน",
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                id: "leave-1",
                employeeId: 10,
                status: "APPROVED",
                notTakenRequestedAt: null,
            }),
            data: expect.objectContaining({
                notTakenReason: "ไม่ได้ลาเพราะมีงานด่วน",
                notTakenRequestedAt: expect.any(Date),
            }),
        });
        expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_NOT_TAKEN_REQUESTED",
            }),
        });
        expect(prisma.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_NOT_TAKEN_REQUESTED",
                userId: 1,
            }),
        });
    });

    it("does not create notifications when another request already claimed the leave", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-duplicate",
            employeeId: 10,
            leaveType: "SICK",
            startDate: new Date("2000-01-01T00:00:00.000Z"),
            endDate: new Date("2000-01-01T00:00:00.000Z"),
            period: "FULL_DAY",
            durationDays: 1,
            reason: "Not taken",
            emergencyReason: null,
            specialReason: null,
            overQuotaDays: 0,
            status: "APPROVED",
            approverId: 20,
            approvedAt: new Date("2000-01-01T00:00:00.000Z"),
            rejectReason: null,
            notTakenReason: null,
            notTakenRequestedAt: null,
            notTakenConfirmedAt: null,
            notTakenConfirmedById: null,
            attachmentUrl: null,
            createdAt: new Date("2000-01-01T00:00:00.000Z"),
            updatedAt: new Date("2000-01-01T00:00:00.000Z"),
            employee: {
                id: 10,
                firstName: "Employee",
                lastName: "User",
                email: "employee@example.com",
                user: { id: 1 },
            },
            approver: {
                id: 20,
                firstName: "Manager",
                lastName: "User",
                email: "manager@example.com",
                status: "ACTIVE",
                deletedAt: null,
                user: {
                    id: 2,
                    email: "manager-account@thainhf.org",
                    isActive: true,
                    deletedAt: null,
                },
            },
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 0 });

        const req = new NextRequest("http://localhost/api/leave/not-taken", {
            method: "POST",
            body: JSON.stringify({ leaveId: "leave-duplicate", note: "Already requested" }),
        });

        const res = await POST(req);

        expect(res.status).toBe(409);
        expect(prisma.notificationOutbox.create).not.toHaveBeenCalled();
        expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("confirms not-taken request and returns quota", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 20, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-2",
            employeeId: 10,
            leaveType: "VACATION",
            startDate: new Date("2000-02-01T00:00:00.000Z"),
            endDate: new Date("2000-02-01T00:00:00.000Z"),
            period: "FULL_DAY",
            durationDays: 1,
            reason: "ลาพักร้อน",
            emergencyReason: null,
            specialReason: null,
            overQuotaDays: 0,
            status: "APPROVED",
            approverId: 20,
            approvedAt: new Date("2000-02-01T00:00:00.000Z"),
            rejectReason: null,
            notTakenReason: "ไม่ได้ลาเพราะมีงานด่วน",
            notTakenRequestedAt: new Date("2000-02-02T00:00:00.000Z"),
            notTakenConfirmedAt: null,
            notTakenConfirmedById: null,
            attachmentUrl: null,
            createdAt: new Date("2000-02-01T00:00:00.000Z"),
            updatedAt: new Date("2000-02-02T00:00:00.000Z"),
            employee: {
                id: 10,
                firstName: "Employee",
                lastName: "User",
                email: "employee@example.com",
                user: { id: 1 },
            },
            approver: {
                id: 20,
                firstName: "Manager",
                lastName: "User",
                email: "manager@example.com",
                status: "ACTIVE",
                deletedAt: null,
                user: { id: 2, email: "manager@example.com", isActive: true, deletedAt: null },
            },
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>);
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue({
            id: "quota-1",
            employeeId: 10,
            year: 2000,
            leaveType: "VACATION",
            totalDays: 6,
            usedDays: 3,
        });
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            id: "leave-2",
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);
        vi.mocked(prisma.leaveQuota.update).mockResolvedValue({
            id: "quota-1",
            usedDays: 2,
        } as Awaited<ReturnType<typeof prisma.leaveQuota.update>>);

        const req = new NextRequest("http://localhost/api/leave/not-taken", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-2" }),
        });

        const res = await PUT(req);
        expect(res.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({ id: "leave-2", status: "APPROVED" }),
            data: expect.objectContaining({
                status: "NOT_TAKEN",
                notTakenConfirmedById: 20,
            }),
        });
        expect(prisma.leaveQuota.update).toHaveBeenCalledWith({
            where: { id: "quota-1" },
            data: { usedDays: { decrement: 1 } },
        });
        expect(prisma.notification.updateMany).toHaveBeenCalledWith({
            where: {
                userId: 1,
                type: "LEAVE_NOT_TAKEN_REQUESTED",
                referenceId: "leave-2",
                isRead: false,
            },
            data: { isRead: true },
        });
        expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_NOT_TAKEN_CONFIRMED",
            }),
        });
    });

    it("rejects confirmation when the approver becomes inactive before the transaction", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const req = new NextRequest("http://localhost/api/leave/not-taken", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-2" }),
        });

        const res = await PUT(req);

        expect(res.status).toBe(403);
        expect(prisma.leaveRequest.findUnique).not.toHaveBeenCalled();
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
    });

    it("returns 403 to a non-approver without revealing original approver recovery", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 30, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 30 } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-recovery",
            employeeId: 10,
            status: "APPROVED",
            approverId: 20,
            endDate: new Date("2000-02-01T00:00:00.000Z"),
            notTakenRequestedAt: new Date("2000-02-02T00:00:00.000Z"),
            notTakenConfirmedAt: null,
            employee: { id: 10, firstName: "Employee", lastName: "User", user: { id: 1 } },
            approver: {
                id: 20,
                firstName: "Former",
                lastName: "Manager",
                email: "former@example.com",
                status: "INACTIVE",
                deletedAt: null,
                user: null,
            },
        } as never);

        const response = await PUT(new NextRequest("http://localhost/api/leave/not-taken", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-recovery" }),
        }));

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: "คุณไม่มีสิทธิ์ดำเนินการกับคำขอนี้" });
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
    });

    it("rejects not-taken confirmation if returning quota would make used days negative", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 20, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-3",
            employeeId: 10,
            leaveType: "VACATION",
            startDate: new Date("2000-02-01T00:00:00.000Z"),
            endDate: new Date("2000-02-01T00:00:00.000Z"),
            period: "FULL_DAY",
            durationDays: 1,
            reason: "ลาพักร้อน",
            emergencyReason: null,
            specialReason: null,
            overQuotaDays: 0,
            status: "APPROVED",
            approverId: 20,
            approvedAt: new Date("2000-02-01T00:00:00.000Z"),
            rejectReason: null,
            notTakenReason: "ไม่ได้ลาเพราะมีงานด่วน",
            notTakenRequestedAt: new Date("2000-02-02T00:00:00.000Z"),
            notTakenConfirmedAt: null,
            notTakenConfirmedById: null,
            attachmentUrl: null,
            createdAt: new Date("2000-02-01T00:00:00.000Z"),
            updatedAt: new Date("2000-02-02T00:00:00.000Z"),
            employee: {
                id: 10,
                firstName: "Employee",
                lastName: "User",
                email: "employee@example.com",
                user: { id: 1 },
            },
            approver: {
                id: 20,
                firstName: "Manager",
                lastName: "User",
                email: "manager@example.com",
                status: "ACTIVE",
                deletedAt: null,
                user: { id: 2, email: "manager@example.com", isActive: true, deletedAt: null },
            },
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>);
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue({
            id: "quota-1",
            employeeId: 10,
            year: 2000,
            leaveType: "VACATION",
            totalDays: 6,
            usedDays: 0.5,
        });
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveQuota.update).mockResolvedValue({
            id: "quota-1",
            usedDays: -0.5,
        } as Awaited<ReturnType<typeof prisma.leaveQuota.update>>);

        const req = new NextRequest("http://localhost/api/leave/not-taken", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-3" }),
        });

        const res = await PUT(req);

        expect(res.status).toBe(409);
        const data = await res.json();
        expect(data.error).toBe(
            "ไม่สามารถตรวจสอบสิทธิ์ลาของคำขอนี้ได้ กรุณาติดต่อผู้ดูแลระบบ",
        );
    });
});
