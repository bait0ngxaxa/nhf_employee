import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/leave/decision/route";
import { requireApiSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logLeaveEvent } from "@/lib/server/audit";
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

vi.mock("@/lib/auth/api", () => ({
    requireApiSession: vi.fn(),
}));

vi.mock("@/lib/server/audit", () => ({
    logLeaveEvent: vi.fn(),
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
        leaveRequest: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        leaveQuota: {
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        notification: {
            updateMany: vi.fn(),
        },
        notificationOutbox: {
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
        vi.mocked(processOutbox).mockResolvedValue({ processed: 0, failed: 0 });
        vi.mocked(logLeaveEvent).mockResolvedValue(undefined);
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
            if (typeof callback === "function") {
                return callback(prisma);
            }
            return callback;
        });
    });

    it("recalculates over-quota days downward when quota is returned before approval", async () => {
        vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue({
            id: "leave-1",
            employeeId: 10,
            leaveType: "VACATION",
            startDate: new Date("2031-05-05T00:00:00.000Z"),
            endDate: new Date("2031-05-05T00:00:00.000Z"),
            period: "FULL_DAY",
            durationDays: 1,
            reason: "พักร้อน",
            emergencyReason: null,
            specialReason: "หัวหน้าอนุมัติกรณีพิเศษ",
            overQuotaDays: 1,
            status: "PENDING",
            approverId: 20,
            approvedAt: null,
            rejectReason: null,
            notTakenReason: null,
            notTakenRequestedAt: null,
            notTakenConfirmedAt: null,
            notTakenConfirmedById: null,
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
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue({
            id: "quota-1",
            employeeId: 10,
            year: 2031,
            leaveType: "VACATION",
            totalDays: 6,
            usedDays: 5,
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
            data: { usedDays: { increment: 1 } },
        });
        expect(prisma.leaveRequest.update).toHaveBeenCalledWith({
            where: { id: "leave-1" },
            data: expect.objectContaining({
                status: "APPROVED",
                overQuotaDays: 0,
            }),
        });
    });
});
