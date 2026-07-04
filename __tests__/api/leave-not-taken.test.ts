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
        notification: {
            create: vi.fn(),
            updateMany: vi.fn(),
        },
        notificationOutbox: {
            create: vi.fn(),
        },
        leaveRequest: {
            findUnique: vi.fn(),
            update: vi.fn(),
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
                user: { id: 2, isActive: true },
            },
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>);
        vi.mocked(prisma.leaveRequest.update).mockResolvedValue({
            id: "leave-1",
        } as Awaited<ReturnType<typeof prisma.leaveRequest.update>>);

        const req = new NextRequest("http://localhost/api/leave/not-taken", {
            method: "POST",
            body: JSON.stringify({
                leaveId: "leave-1",
                note: "ไม่ได้ลาเพราะมีงานด่วน",
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(prisma.leaveRequest.update).toHaveBeenCalledWith({
            where: { id: "leave-1" },
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

    it("confirms not-taken request and returns quota", async () => {
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
            approverId: 10,
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
                id: 10,
                firstName: "Manager",
                lastName: "User",
                email: "manager@example.com",
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
        vi.mocked(prisma.leaveRequest.update).mockResolvedValue({
            id: "leave-2",
        } as Awaited<ReturnType<typeof prisma.leaveRequest.update>>);
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
        expect(prisma.leaveRequest.update).toHaveBeenCalledWith({
            where: { id: "leave-2" },
            data: expect.objectContaining({
                status: "NOT_TAKEN",
                notTakenConfirmedById: 10,
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

    it("rejects not-taken confirmation if returning quota would make used days negative", async () => {
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
            approverId: 10,
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
                id: 10,
                firstName: "Manager",
                lastName: "User",
                email: "manager@example.com",
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
        vi.mocked(prisma.leaveRequest.update).mockResolvedValue({
            id: "leave-3",
        } as Awaited<ReturnType<typeof prisma.leaveRequest.update>>);
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
