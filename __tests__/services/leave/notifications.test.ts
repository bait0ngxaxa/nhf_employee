import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { emailService } from "@/lib/email";
import { prisma } from "@/lib/db/prisma";
import {
    sendLeaveActionNotifications,
    sendLeaveCancelledAfterApprovalNotifications,
    sendLeaveNotTakenConfirmedNotifications,
    sendLeaveResultNotifications,
} from "@/lib/services/leave/notifications";
import type {
    LeaveActionPayload,
    LeaveCancelledAfterApprovalPayload,
    LeaveNotTakenConfirmedPayload,
    LeaveResultPayload,
} from "@/lib/services/leave/notification-payloads";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/network/public-url", () => ({
    getPublicOrigin: () => "https://example.com",
}));

vi.mock("@/lib/email", () => ({
    emailService: {
        sendLeaveActionNotification: vi.fn(),
        sendLeaveResultNotification: vi.fn(),
        sendLeaveCancelledAfterApprovalNotification: vi.fn(),
        sendLeaveNotTakenConfirmedNotification: vi.fn(),
    },
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function buildActionPayload(): LeaveActionPayload {
    return {
        leaveId: "leave-1",
        employee: {
            employeeId: 10,
            userId: 1,
            email: "employee@example.com",
            name: "Employee User",
        },
        approver: {
            employeeId: 20,
            userId: 2,
            email: "manager@example.com",
            name: "Manager User",
        },
        leaveType: "SICK",
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-01T00:00:00.000Z",
        period: "FULL_DAY",
        durationDays: 1,
        reason: "ลาป่วย",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
    };
}

function buildResultPayload(): LeaveResultPayload {
    const actionPayload = buildActionPayload();
    return {
        leaveId: actionPayload.leaveId,
        employee: actionPayload.employee,
        approverName: actionPayload.approver.name,
        leaveType: actionPayload.leaveType,
        startDate: actionPayload.startDate,
        endDate: actionPayload.endDate,
        period: actionPayload.period,
        durationDays: actionPayload.durationDays,
        status: "APPROVED",
        reason: null,
    };
}

function buildDecisionPayload(): LeaveCancelledAfterApprovalPayload {
    return {
        leaveId: "leave-1",
        employee: {
            employeeId: 10,
            userId: 1,
            email: "employee@example.com",
            name: "Employee User",
        },
        decisionActorName: "Admin User",
        decisionActorRole: "ADMIN",
        recoveryOverride: true,
        leaveType: "SICK",
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-01T00:00:00.000Z",
        period: "FULL_DAY",
        durationDays: 1,
    };
}

function buildNotTakenDecisionPayload(): LeaveNotTakenConfirmedPayload {
    return buildDecisionPayload();
}

describe("leave notification delivery", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        vi.mocked(emailService.sendLeaveActionNotification).mockResolvedValue(true);
        vi.mocked(emailService.sendLeaveResultNotification).mockResolvedValue(true);
        vi.mocked(emailService.sendLeaveCancelledAfterApprovalNotification).mockResolvedValue(true);
        vi.mocked(emailService.sendLeaveNotTakenConfirmedNotification).mockResolvedValue(true);
    });

    it("still creates in-app emergency leave notification when action email delivery fails", async () => {
        vi.mocked(emailService.sendLeaveActionNotification).mockResolvedValue(false);
        const payload = {
            ...buildActionPayload(),
            emergencyReason: "ป่วยฉุกเฉินจนยื่นคำขอไม่ทัน",
        };

        await expect(sendLeaveActionNotifications(payload)).rejects.toThrow(
            "LEAVE_ACTION email notification failed",
        );
        expect(prismaMock.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_REQUESTED",
                referenceId: "leave-1",
                userId: 2,
                message: expect.stringContaining("ลาย้อนหลัง"),
            }),
        });
    });

    it("creates result notification once and treats duplicate as success", async () => {
        const duplicateError = new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            {
                code: "P2002",
                clientVersion: "test",
            },
        );
        prismaMock.notification.create.mockRejectedValue(duplicateError);

        await expect(
            sendLeaveResultNotifications(buildResultPayload()),
        ).resolves.toBeUndefined();
        expect(prismaMock.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_APPROVED",
                referenceId: "leave-1",
                userId: 1,
                dedupeKey: "leave:1:LEAVE_APPROVED:leave-1",
            }),
        });
    });

    it("shows the admin as the decision actor for cancellation recovery", async () => {
        await sendLeaveCancelledAfterApprovalNotifications(buildDecisionPayload());

        expect(prismaMock.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_CANCELLED_AFTER_APPROVAL",
                message: expect.stringContaining(
                    "ผู้ดูแลระบบ Admin User ยืนยันการยกเลิก",
                ),
            }),
        });
    });

    it("shows the admin as the decision actor for not-taken recovery", async () => {
        await sendLeaveNotTakenConfirmedNotifications(buildNotTakenDecisionPayload());

        expect(prismaMock.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_NOT_TAKEN_CONFIRMED",
                message: expect.stringContaining(
                    "ผู้ดูแลระบบ Admin User ยืนยันไม่ได้ใช้วันลา",
                ),
            }),
        });
    });
});
