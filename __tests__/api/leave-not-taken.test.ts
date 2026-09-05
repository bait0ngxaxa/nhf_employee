import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, PUT } from "@/app/api/leave/not-taken/route";
import { getApiAuthSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { processOutbox } from "@/lib/services/outbox/processor";
import { LEAVE_JSON_MUTATION_MAX_BYTES } from "@/lib/ssot/request-limits";
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
        employee: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        leaveQuota: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
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
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 10, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 1 } as never);
        vi.mocked(prisma.employee.findUnique).mockResolvedValue({ manager: null } as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([{
            id: 99,
            firstName: "Recovery",
            lastName: "Admin",
            email: "recovery-admin@example.com",
            status: "ACTIVE",
            deletedAt: null,
            user: {
                id: 99,
                email: "recovery-admin@example.com",
                isActive: true,
                deletedAt: null,
            },
        }] as never);
        vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
        vi.mocked(prisma.leaveQuota.findMany).mockResolvedValue([]);
        vi.mocked(processOutbox).mockResolvedValue({ processed: 0, failed: 0 });
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
            if (typeof callback === "function") {
                return callback(prisma);
            }
            return callback;
        });
    });

    it.each([
        ["missing", undefined],
        ["lying", "10"],
    ] as const)(
        "rejects an actually oversized not-taken body with a %s Content-Length",
        async (_label, contentLength) => {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (contentLength) headers["Content-Length"] = contentLength;

            const response = await POST(new NextRequest(
                "http://localhost/api/leave/not-taken",
                {
                    method: "POST",
                    headers,
                    body: new ArrayBuffer(LEAVE_JSON_MUTATION_MAX_BYTES + 1),
                },
            ));

            expect(response.status).toBe(413);
            expect(prisma.leaveRequest.findUnique).not.toHaveBeenCalled();
            expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        },
    );

    it("records employee not-taken request for an approved past leave", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-1",
            employeeId: 10,
            leaveType: "SICK",
            startDate: new Date("2000-01-01T00:00:00.000Z"),
            endDate: new Date("2000-01-01T00:00:00.000Z"),
            period: "FULL_DAY",
            durationHalfDays: 2,
            reason: "ลาป่วย",
            emergencyReason: null,
            specialReason: null,
            overQuotaHalfDays: 0,
            status: "APPROVED",
            approverId: 20,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            approvalActionVersion: 1,
            approvedAt: new Date("2000-01-01T00:00:00.000Z"),
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

    it("records a not-taken request for admin recovery when the original approver is inactive", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-recovery-request",
            employeeId: 10,
            leaveType: "SICK",
            startDate: new Date("2000-01-01T00:00:00.000Z"),
            endDate: new Date("2000-01-01T00:00:00.000Z"),
            period: "FULL_DAY",
            durationHalfDays: 2,
            reason: "ลาป่วย",
            emergencyReason: null,
            specialReason: null,
            overQuotaHalfDays: 0,
            status: "APPROVED",
            approverId: 20,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            approvalActionVersion: 1,
            approvedAt: new Date("2000-01-01T00:00:00.000Z"),
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
                firstName: "Former",
                lastName: "Manager",
                email: "former@example.com",
                status: "INACTIVE",
                deletedAt: null,
                user: null,
            },
        } as never);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });

        const response = await POST(new NextRequest("http://localhost/api/leave/not-taken", {
            method: "POST",
            body: JSON.stringify({
                leaveId: "leave-recovery-request",
                note: "ไม่ได้ลาเพราะมีงานด่วน",
            }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                id: "leave-recovery-request",
                notTakenRequestedAt: null,
            }),
            data: expect.objectContaining({
                notTakenReason: "ไม่ได้ลาเพราะมีงานด่วน",
            }),
        });
        expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_NOT_TAKEN_REQUESTED",
                payload: expect.stringContaining('"employeeId":99'),
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
            durationHalfDays: 2,
            reason: "Not taken",
            emergencyReason: null,
            specialReason: null,
            overQuotaHalfDays: 0,
            status: "APPROVED",
            approverId: 20,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            approvalActionVersion: 1,
            approvedAt: new Date("2000-01-01T00:00:00.000Z"),
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

    it("records one non-transactional audit for a normal assigned manager", async () => {
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
            durationHalfDays: 2,
            reason: "ลาพักร้อน",
            emergencyReason: null,
            specialReason: null,
            overQuotaHalfDays: 0,
            status: "APPROVED",
            approverId: 20,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            approvalActionVersion: 1,
            approvedAt: new Date("2000-02-01T00:00:00.000Z"),
            rejectReason: null,
            notTakenReason: "ไม่ได้ลาเพราะมีงานด่วน",
            notTakenRequestedAt: new Date("2000-02-02T00:00:00.000Z"),
            notTakenConfirmedAt: null,
            notTakenConfirmedById: null,
            cancellationReason: null,
            cancellationRequestedAt: null,
            cancellationConfirmedAt: null,
            cancellationConfirmedById: null,
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
            totalHalfDays: 12,
            carryBalanceHalfDays: 0,
            usedHalfDays: 6,
        });
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            id: "leave-2",
            durationHalfDays: 2,
            overQuotaHalfDays: 0,
        } as Awaited<ReturnType<typeof prisma.leaveRequest.findUniqueOrThrow>>);
        vi.mocked(prisma.leaveQuota.update).mockResolvedValue({
            id: "quota-1",
            usedHalfDays: 4,
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
            data: { usedHalfDays: { decrement: 2 } },
        });
        expect(prisma.leaveQuota.findMany).toHaveBeenCalledWith({
            where: {
                employeeId: 10,
                leaveType: "VACATION",
                year: { gt: 2000 },
            },
            orderBy: { year: "asc" },
        });
        expect(prisma.notification.updateMany).toHaveBeenCalledWith({
            where: {
                userId: 2,
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
        expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
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

    it("records exactly one transactional audit for an admin recovery override", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: {
                id: "99",
                email: "admin@example.com",
                name: "Admin",
                role: "ADMIN",
            },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 99, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 99 } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-admin-recovery",
            employeeId: 10,
            leaveType: "VACATION",
            startDate: new Date("2000-02-01T00:00:00.000Z"),
            endDate: new Date("2000-02-01T00:00:00.000Z"),
            period: "FULL_DAY",
            durationHalfDays: 2,
            status: "APPROVED",
            approverId: 20,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            approvalActionVersion: 1,
            notTakenRequestedAt: new Date("2000-02-02T00:00:00.000Z"),
            notTakenConfirmedAt: null,
            employee: {
                id: 10,
                firstName: "Employee",
                lastName: "User",
                email: "employee@example.com",
                user: { id: 1 },
            },
            approver: {
                id: 20,
                firstName: "Former",
                lastName: "Manager",
                email: "former@example.com",
                status: "INACTIVE",
                deletedAt: null,
                user: {
                    id: 20,
                    email: "former@example.com",
                    isActive: false,
                    deletedAt: null,
                },
            },
        } as never);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue({
            id: "quota-admin-recovery",
            employeeId: 10,
            year: 2000,
            leaveType: "VACATION",
            totalHalfDays: 12,
            carryBalanceHalfDays: 0,
            usedHalfDays: 4,
        });
        vi.mocked(prisma.leaveQuota.update).mockResolvedValue({
            id: "quota-admin-recovery",
            usedHalfDays: 2,
        } as never);
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            id: "leave-admin-recovery",
            status: "NOT_TAKEN",
            durationHalfDays: 2,
            overQuotaHalfDays: 0,
        } as never);

        const response = await PUT(new NextRequest("http://localhost/api/leave/not-taken", {
            method: "PUT",
            body: JSON.stringify({
                leaveId: "leave-admin-recovery",
                reason: "ตรวจสอบแทนผู้อนุมัติที่พ้นสภาพ",
            }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                id: "leave-admin-recovery",
                status: "APPROVED",
                notTakenRequestedAt: { not: null },
            }),
            data: expect.objectContaining({
                status: "NOT_TAKEN",
                notTakenConfirmedById: 99,
            }),
        });
        expect(prisma.leaveQuota.update).toHaveBeenCalledWith({
            where: { id: "quota-admin-recovery" },
            data: { usedHalfDays: { decrement: 2 } },
        });
        expect(prisma.notification.updateMany).toHaveBeenCalledWith({
            where: {
                userId: 20,
                type: "LEAVE_NOT_TAKEN_REQUESTED",
                referenceId: "leave-admin-recovery",
                isRead: false,
            },
            data: { isRead: true },
        });
        expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_NOT_TAKEN_CONFIRMED",
                payload: expect.stringContaining('"decisionActorName":"Admin"'),
            }),
        });
        expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_NOT_TAKEN_CONFIRMED",
                payload: expect.stringContaining('"decisionActorRole":"ADMIN"'),
            }),
        });
        expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_NOT_TAKEN_CONFIRMED",
                payload: expect.stringContaining('"recoveryOverride":true'),
            }),
        });
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "LEAVE_REQUEST_NOT_TAKEN_CONFIRM",
                details: expect.stringContaining(
                    '"overrideReason":"ตรวจสอบแทนผู้อนุมัติที่พ้นสภาพ"',
                ),
            }),
        });
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "LEAVE_REQUEST_NOT_TAKEN_CONFIRM",
                details: expect.stringContaining('"adminOverride":true'),
            }),
        });
        expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it("requires a reason for an admin not-taken recovery override", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: {
                id: "99",
                email: "admin@example.com",
                name: "Admin",
                role: "ADMIN",
            },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 99, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 99 } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-admin-recovery-no-reason",
            employeeId: 10,
            status: "APPROVED",
            approverId: 20,
            exceptionApproverId: null,
            notTakenRequestedAt: new Date("2000-02-02T00:00:00.000Z"),
            notTakenConfirmedAt: null,
            employee: { id: 10, firstName: "Employee", lastName: "User", user: { id: 1 } },
            approver: {
                id: 20,
                status: "INACTIVE",
                deletedAt: null,
                user: null,
            },
        } as never);

        const response = await PUT(new NextRequest("http://localhost/api/leave/not-taken", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-admin-recovery-no-reason" }),
        }));

        expect(response.status).toBe(400);
        expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
    });

    it("does not allow an admin to confirm their own not-taken request", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: {
                id: "99",
                email: "admin@example.com",
                name: "Admin",
                role: "ADMIN",
            },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 99, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 99 } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-admin-owner",
            employeeId: 99,
            status: "APPROVED",
            approverId: 20,
            exceptionApproverId: null,
            notTakenRequestedAt: new Date("2000-02-02T00:00:00.000Z"),
            notTakenConfirmedAt: null,
            endDate: new Date("2000-02-01T00:00:00.000Z"),
            employee: { id: 99, firstName: "Admin", lastName: "Owner", user: { id: 99 } },
            approver: {
                id: 20,
                status: "INACTIVE",
                deletedAt: null,
                user: null,
            },
        } as never);

        const response = await PUT(new NextRequest("http://localhost/api/leave/not-taken", {
            method: "PUT",
            body: JSON.stringify({
                leaveId: "leave-admin-owner",
                reason: "ตรวจสอบรายการที่ผู้อนุมัติไม่พร้อม",
            }),
        }));

        expect(response.status).toBe(403);
        expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
    });

    it("does not allow an admin to override an active assigned manager", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: {
                id: "99",
                email: "admin@example.com",
                name: "Admin",
                role: "ADMIN",
            },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 99, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 99 } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-active-manager",
            employeeId: 10,
            status: "APPROVED",
            approverId: 20,
            exceptionApproverId: null,
            notTakenRequestedAt: new Date("2000-02-02T00:00:00.000Z"),
            notTakenConfirmedAt: null,
            endDate: new Date("2000-02-01T00:00:00.000Z"),
            employee: { id: 10, firstName: "Employee", lastName: "User", user: { id: 1 } },
            approver: {
                id: 20,
                status: "ACTIVE",
                deletedAt: null,
                user: {
                    id: 2,
                    email: "manager@example.com",
                    isActive: true,
                    deletedAt: null,
                },
            },
        } as never);

        const response = await PUT(new NextRequest("http://localhost/api/leave/not-taken", {
            method: "PUT",
            body: JSON.stringify({
                leaveId: "leave-active-manager",
                reason: "ผู้อนุมัติเดิมยังพร้อมใช้งาน",
            }),
        }));

        expect(response.status).toBe(403);
        expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
    });

    it("records exactly one audit when an assigned admin confirms not-taken", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: {
                id: "99",
                email: "admin@example.com",
                name: "Admin",
                role: "ADMIN",
            },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            deletedAt: null,
            employee: { id: 99, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 99 } as never);
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-assigned-admin",
            employeeId: 10,
            leaveType: "VACATION",
            startDate: new Date("2000-02-01T00:00:00.000Z"),
            endDate: new Date("2000-02-01T00:00:00.000Z"),
            period: "FULL_DAY",
            durationHalfDays: 2,
            status: "APPROVED",
            approverId: 99,
            exceptionApproverId: null,
            notTakenRequestedAt: new Date("2000-02-02T00:00:00.000Z"),
            notTakenConfirmedAt: null,
            employee: { id: 10, firstName: "Employee", lastName: "User", user: { id: 1 } },
            approver: {
                id: 99,
                status: "ACTIVE",
                deletedAt: null,
                user: {
                    id: 99,
                    email: "admin@example.com",
                    isActive: true,
                    deletedAt: null,
                },
            },
        } as never);
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue({
            id: "quota-assigned-admin",
            employeeId: 10,
            year: 2000,
            leaveType: "VACATION",
            totalHalfDays: 12,
            carryBalanceHalfDays: 0,
            usedHalfDays: 4,
        });
        vi.mocked(prisma.leaveQuota.update).mockResolvedValue({
            id: "quota-assigned-admin",
            usedHalfDays: 2,
        } as never);
        vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue({
            id: "leave-assigned-admin",
            status: "NOT_TAKEN",
            durationHalfDays: 2,
            overQuotaHalfDays: 0,
        } as never);

        const response = await PUT(new NextRequest("http://localhost/api/leave/not-taken", {
            method: "PUT",
            body: JSON.stringify({ leaveId: "leave-assigned-admin" }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                approverId: 99,
                employeeId: { not: 99 },
            }),
            data: expect.objectContaining({
                status: "NOT_TAKEN",
                notTakenConfirmedById: 99,
            }),
        });
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "LEAVE_REQUEST_NOT_TAKEN_CONFIRM",
                details: expect.stringContaining('"adminOverride":false'),
            }),
        });
        expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
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
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            approvalActionVersion: 1,
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
            durationHalfDays: 2,
            reason: "ลาพักร้อน",
            emergencyReason: null,
            specialReason: null,
            overQuotaHalfDays: 0,
            status: "APPROVED",
            approverId: 20,
            exceptionApproverId: null,
            exceptionApproverAssignedAt: null,
            approvalActionVersion: 1,
            approvedAt: new Date("2000-02-01T00:00:00.000Z"),
            rejectReason: null,
            notTakenReason: "ไม่ได้ลาเพราะมีงานด่วน",
            notTakenRequestedAt: new Date("2000-02-02T00:00:00.000Z"),
            notTakenConfirmedAt: null,
            notTakenConfirmedById: null,
            cancellationReason: null,
            cancellationRequestedAt: null,
            cancellationConfirmedAt: null,
            cancellationConfirmedById: null,
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
            totalHalfDays: 12,
            carryBalanceHalfDays: 0,
            usedHalfDays: 1,
        });
        vi.mocked(prisma.leaveRequest.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(prisma.leaveQuota.update).mockResolvedValue({
            id: "quota-1",
            usedHalfDays: -1,
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
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
});
