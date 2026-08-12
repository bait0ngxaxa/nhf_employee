import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/leave/decision/route";
import { requireApiSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { processOutbox } from "@/lib/services/outbox/processor";
import type * as NextServerModule from "next/server";
import { formatAuditLogDisplay } from "@/lib/audit-log/display";

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: vi.fn((callback) => {
            callback();
        }),
    };
});

vi.mock("@/lib/auth/api", () => ({
    requireApiSession: vi.fn(),
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
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
        },
        leaveRequest: {
            findUnique: vi.fn(),
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        leaveQuota: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
        },
        notification: {
            updateMany: vi.fn(),
        },
        notificationOutbox: {
            create: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    },
}));

describe("POST /api/leave/decision", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            session: {
                user: {
                    id: "20",
                    email: "manager@example.com",
                    name: "Manager User",
                    role: "USER",
                },
            },
            user: {
                id: 20,
                email: "manager@example.com",
                name: "Manager User",
                role: "USER",
            },
        });
        vi.mocked(getEmployeeIdFromUserId).mockResolvedValue(20);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 20, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 20 } as never);
        vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.leaveQuota.findMany).mockResolvedValue([]);
        vi.mocked(processOutbox).mockResolvedValue({ processed: 0, failed: 0 });
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
            if (typeof callback === "function") {
                return callback(prisma);
            }
            return callback;
        });
    });

    it("rejects an inactive manager before starting the business transaction", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 20,
            isActive: true,
            employeeId: 20,
            employee: {
                id: 20,
                status: "INACTIVE",
                deletedAt: null,
            },
        } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);

        const req = new NextRequest("http://localhost/api/leave/decision", {
            method: "POST",
            body: JSON.stringify({
                leaveId: "leave-1",
                action: "REJECT",
                reason: "ไม่อนุมัติ",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(403);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
        expect(prisma.notificationOutbox.create).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("rejects an approver who is not recorded on the pending request", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-original-approver",
            employeeId: 10,
            leaveType: "VACATION",
            startDate: new Date("2031-05-05T00:00:00.000Z"),
            endDate: new Date("2031-05-05T00:00:00.000Z"),
            period: "FULL_DAY",
            durationHalfDays: 2,
            reason: "พักร้อน",
            emergencyReason: null,
            specialReason: null,
            overQuotaHalfDays: 0,
            status: "PENDING",
            approverId: 30,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            employee: {
                id: 10,
                firstName: "Employee",
                lastName: "User",
                email: "employee@thainhf.org",
                user: { id: 10 },
            },
            approver: {
                id: 30,
                firstName: "New",
                lastName: "Manager",
                email: "new-manager@thainhf.org",
            },
        } as never);

        const req = new NextRequest("http://localhost/api/leave/decision", {
            method: "POST",
            body: JSON.stringify({
                leaveId: "leave-original-approver",
                action: "REJECT",
                reason: "ไม่อนุมัติ",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(403);
        expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(prisma.notificationOutbox.create).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("returns 403 instead of disclosing a processed request to a non-approver", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-processed-other-approver",
            employeeId: 10,
            status: "APPROVED",
            approverId: 30,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            employee: { id: 10 },
            approver: { id: 30 },
        } as never);

        const response = await POST(new NextRequest("http://localhost/api/leave/decision", {
            method: "POST",
            body: JSON.stringify({
                leaveId: "leave-processed-other-approver",
                action: "REJECT",
                reason: "ไม่อนุมัติ",
            }),
        }));

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: "คุณไม่มีสิทธิ์อนุมัติคำขอนี้" });
        expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
    });

    it("rejects when the approver becomes inactive before the transaction", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const req = new NextRequest("http://localhost/api/leave/decision", {
            method: "POST",
            body: JSON.stringify({
                leaveId: "leave-1",
                action: "REJECT",
                reason: "ไม่อนุมัติ",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(403);
        expect(prisma.leaveRequest.findUnique).not.toHaveBeenCalled();
        expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
    });

    it("recalculates over-quota days downward when quota is returned before approval", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-1",
            employeeId: 10,
            leaveType: "VACATION",
            startDate: new Date("2031-05-05T00:00:00.000Z"),
            endDate: new Date("2031-05-05T00:00:00.000Z"),
            period: "FULL_DAY",
            durationHalfDays: 2,
            reason: "พักร้อน",
            emergencyReason: null,
            specialReason: "หัวหน้าอนุมัติกรณีพิเศษ",
            overQuotaHalfDays: 2,
            status: "PENDING",
            approverId: 20,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            approvedAt: null,
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
            createdAt: new Date("2031-05-01T00:00:00.000Z"),
            updatedAt: new Date("2031-05-01T00:00:00.000Z"),
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
            },
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>);
        vi.mocked(prisma.leaveRequest.update).mockResolvedValue({
            id: "leave-1",
        } as Awaited<ReturnType<typeof prisma.leaveRequest.update>>);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            id: "leave-1",
            durationHalfDays: 2,
            overQuotaHalfDays: 0,
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue({
            id: "quota-2030",
            employeeId: 10,
            year: 2030,
            leaveType: "VACATION",
            totalHalfDays: 12,
            carryBalanceHalfDays: 0,
            usedHalfDays: 8,
        });
        vi.mocked(prisma.leaveQuota.upsert).mockResolvedValue({
            id: "quota-1",
            employeeId: 10,
            year: 2031,
            leaveType: "VACATION",
            totalHalfDays: 12,
            carryBalanceHalfDays: 4,
            usedHalfDays: 14,
        });
        vi.mocked(prisma.leaveQuota.update).mockResolvedValue({
            id: "quota-1",
        } as Awaited<ReturnType<typeof prisma.leaveQuota.update>>);

        const req = new NextRequest("http://localhost/api/leave/decision", {
            method: "POST",
            body: JSON.stringify({
                leaveId: "leave-1",
                action: "APPROVE",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(prisma.leaveQuota.update).toHaveBeenCalledWith({
            where: { id: "quota-1" },
            data: { usedHalfDays: { increment: 2 } },
        });
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: { id: "leave-1", status: "PENDING", approverId: 20 },
            data: expect.objectContaining({
                status: "APPROVED",
            }),
        });
        const auditCall = vi.mocked(prisma.auditLog.create).mock.calls[0]?.[0];
        const auditDetails = JSON.parse(String(auditCall?.data.details)) as Record<string, unknown>;
        expect(auditCall?.data.action).toBe("LEAVE_REQUEST_APPROVE");
        expect(formatAuditLogDisplay({
            action: "LEAVE_REQUEST_APPROVE",
            entityType: "LeaveRequest",
            entityId: null,
            details: auditDetails,
        }).summary).toContain("อนุมัติคำขอลาพักร้อนของ Employee User");
    });

    it("records a rejection reason in the real writer-to-formatter contract", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-rejected",
            employeeId: 10,
            leaveType: "SICK",
            startDate: new Date("2031-07-10T00:00:00.000Z"),
            endDate: new Date("2031-07-11T00:00:00.000Z"),
            period: "FULL_DAY",
            durationHalfDays: 4,
            status: "PENDING",
            approverId: 20,
            specialReason: null,
            overQuotaHalfDays: 0,
            employee: {
                id: 10,
                firstName: "สมชาย",
                lastName: "ใจดี",
                email: "somchai@example.com",
                user: { id: 10 },
            },
            approver: {
                id: 20,
                firstName: "วิชัย",
                lastName: "ใจดี",
                email: "manager@example.com",
            },
        } as never);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            id: "leave-rejected",
            durationHalfDays: 4,
            overQuotaHalfDays: 0,
            status: "REJECTED",
        } as never);

        const response = await POST(new NextRequest("http://localhost/api/leave/decision", {
            method: "POST",
            body: JSON.stringify({
                leaveId: "leave-rejected",
                action: "REJECT",
                reason: "เอกสารไม่ครบ",
            }),
        }));

        expect(response.status).toBe(200);
        const auditCall = vi.mocked(prisma.auditLog.create).mock.calls[0]?.[0];
        const auditDetails = JSON.parse(String(auditCall?.data.details)) as Record<string, unknown>;
        const display = formatAuditLogDisplay({
            action: "LEAVE_REQUEST_REJECT",
            entityType: "LeaveRequest",
            entityId: null,
            details: auditDetails,
        });

        expect(auditCall?.data.action).toBe("LEAVE_REQUEST_REJECT");
        expect(display.summary).toContain("ไม่อนุมัติคำขอลาป่วยของ สมชาย ใจดี");
        expect(display.summary).toContain("เอกสารไม่ครบ");
    });

    it("records the full request when signed carry starts the year over quota", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-already-over-quota",
            employeeId: 10,
            leaveType: "VACATION",
            startDate: new Date("2031-05-05T00:00:00.000Z"),
            endDate: new Date("2031-05-06T00:00:00.000Z"),
            period: "FULL_DAY",
            durationHalfDays: 4,
            reason: "พักร้อน",
            emergencyReason: null,
            specialReason: "อนุมัติกรณีพิเศษ",
            overQuotaHalfDays: 8,
            status: "PENDING",
            approverId: 20,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            approvedAt: null,
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
            createdAt: new Date("2031-05-01T00:00:00.000Z"),
            updatedAt: new Date("2031-05-01T00:00:00.000Z"),
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
            },
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            id: "leave-already-over-quota",
            durationHalfDays: 4,
            overQuotaHalfDays: 4,
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue({
            id: "quota-2030",
            employeeId: 10,
            year: 2030,
            leaveType: "VACATION",
            totalHalfDays: 12,
            carryBalanceHalfDays: 0,
            usedHalfDays: 28,
        });
        vi.mocked(prisma.leaveQuota.upsert).mockResolvedValue({
            id: "quota-1",
            employeeId: 10,
            year: 2031,
            leaveType: "VACATION",
            totalHalfDays: 12,
            carryBalanceHalfDays: -16,
            usedHalfDays: 0,
        });

        const req = new NextRequest("http://localhost/api/leave/decision", {
            method: "POST",
            body: JSON.stringify({ leaveId: "leave-already-over-quota", action: "APPROVE" }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).toHaveBeenLastCalledWith({
            where: { id: "leave-already-over-quota", status: "APPROVED" },
            data: { overQuotaHalfDays: 4 },
        });
    });

    it("does not consume quota when cancelling wins the pending-state claim", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-1",
            employeeId: 10,
            leaveType: "VACATION",
            startDate: new Date("2031-05-05T00:00:00.000Z"),
            endDate: new Date("2031-05-05T00:00:00.000Z"),
            period: "FULL_DAY",
            durationHalfDays: 2,
            reason: "พักร้อน",
            emergencyReason: null,
            specialReason: null,
            overQuotaHalfDays: 0,
            status: "PENDING",
            approverId: 20,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            approvedAt: null,
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
            createdAt: new Date("2031-05-01T00:00:00.000Z"),
            updatedAt: new Date("2031-05-01T00:00:00.000Z"),
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
            },
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>>);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 0 });

        const req = new NextRequest("http://localhost/api/leave/decision", {
            method: "POST",
            body: JSON.stringify({ leaveId: "leave-1", action: "APPROVE" }),
        });

        const res = await POST(req);

        expect(res.status).toBe(409);
        expect(prisma.leaveQuota.findFirst).not.toHaveBeenCalled();
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
    });
});
