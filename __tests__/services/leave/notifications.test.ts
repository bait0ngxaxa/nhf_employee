import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

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

const leaveEmailMocks = vi.hoisted(() => ({
    sendLeaveActionNotification: vi.fn(),
    sendLeaveResultNotification: vi.fn(),
    sendLeaveCancelledAfterApprovalNotification: vi.fn(),
    sendLeaveNotTakenConfirmedNotification: vi.fn(),
    sendLeaveCancelledNotification: vi.fn(),
    sendLeaveCancellationRequestedNotification: vi.fn(),
    sendLeaveNotTakenRequestedNotification: vi.fn(),
}));
import {
    buildConfiguredApproverSnapshot,
    buildLeaveRecipientSnapshot,
    parseLeaveActionPayload,
} from "@/lib/services/leave/notification-payloads";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/network/public-url", () => ({
    getPublicOrigin: () => "https://example.com",
}));

vi.mock("@/modules/leave/infrastructure/notifications/email", () => ({
    ...leaveEmailMocks,
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
        leaveEmailMocks.sendLeaveActionNotification.mockResolvedValue(true);
        leaveEmailMocks.sendLeaveResultNotification.mockResolvedValue(true);
        leaveEmailMocks.sendLeaveCancelledAfterApprovalNotification.mockResolvedValue(true);
        leaveEmailMocks.sendLeaveNotTakenConfirmedNotification.mockResolvedValue(true);
    });

    it("builds canonical employee and approver name snapshots", () => {
        const employee = buildLeaveRecipientSnapshot({
            id: 10,
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: "ชาย",
            email: "employee@example.com",
            user: { id: 1 },
        });
        const approver = buildConfiguredApproverSnapshot({
            id: 20,
            firstName: "สมหญิง",
            lastName: "ใจดี",
            nickname: "หญิง",
            email: "manager@example.com",
            user: { id: 2, email: "manager@example.com" },
        });

        expect(employee.name).toBe("สมชาย ใจดี (ชาย)");
        expect(approver.name).toBe("สมหญิง ใจดี (หญิง)");
    });

    it("continues to parse legacy leave outbox name snapshots", () => {
        expect(parseLeaveActionPayload(buildActionPayload())).toEqual(
            buildActionPayload(),
        );
    });

    it("still creates in-app emergency leave notification when action email delivery fails", async () => {
        leaveEmailMocks.sendLeaveActionNotification.mockResolvedValue(false);
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

    it("does not label an assigned admin decision as a recovery override", async () => {
        await sendLeaveNotTakenConfirmedNotifications({
            ...buildNotTakenDecisionPayload(),
            recoveryOverride: false,
        });

        expect(prismaMock.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "LEAVE_NOT_TAKEN_CONFIRMED",
                message: expect.stringContaining("Admin User ยืนยันไม่ได้ใช้วันลา"),
            }),
        });
        expect(prismaMock.notification.create).not.toHaveBeenCalledWith({
            data: expect.objectContaining({
                message: expect.stringContaining("ผู้ดูแลระบบ Admin User"),
            }),
        });
    });
});
