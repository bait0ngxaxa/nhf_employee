import { randomUUID } from "node:crypto";
import { LeaveStatus } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    cancelLeaveRequest,
    confirmLeaveCancellation,
    rejectLeaveCancellation,
} from "../../application/cancellation/cancellation";
import {
    createLeaveRequest,
    type LeaveRequestError,
} from "../../application/requests/create-request";

const DEPARTMENT_NAME = "Leave Cancellation Overlap Integration";
const DEPARTMENT_CODE = "LEAVE-CANCEL-OVERLAP";
const LEAVE_PAYLOAD = {
    leaveType: "PERSONAL",
    startDate: "2031-05-12",
    endDate: "2031-05-12",
    period: "FULL_DAY",
    reason: "ตรวจสอบคำขอลาซ้อนกับการยกเลิก",
} satisfies Parameters<typeof createLeaveRequest>[0]["payload"];

type Fixture = {
    approverEmployeeId: number;
    approverUserId: number;
    employeeId: number;
    employeeUserId: number;
    employeeUserEmail: string;
};

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) {
        throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");
    }

    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (
        url.protocol !== "mysql:"
        || !/(?:_integration|_test)$/.test(databaseName)
    ) {
        throw new Error(
            "ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test",
        );
    }
}

async function cleanFixture(): Promise<void> {
    const department = await prisma.department.findUnique({
        where: { name: DEPARTMENT_NAME },
        select: { id: true },
    });
    if (!department) {
        return;
    }

    const employees = await prisma.employee.findMany({
        where: { departmentId: department.id },
        select: { id: true },
    });
    const employeeIds = employees.map(({ id }) => id);
    const leaveRequests = employeeIds.length > 0
        ? await prisma.leaveRequest.findMany({
            where: { employeeId: { in: employeeIds } },
            select: { id: true },
        })
        : [];
    const leaveIds = leaveRequests.map(({ id }) => id);

    if (leaveIds.length > 0) {
        await prisma.notificationOutbox.deleteMany({
            where: {
                OR: leaveIds.map((leaveId) => ({
                    payload: { contains: leaveId },
                })),
            },
        });
        await prisma.notification.deleteMany({
            where: { referenceId: { in: leaveIds } },
        });
        await prisma.auditLog.deleteMany({
            where: {
                OR: leaveIds.map((leaveId) => ({
                    details: { contains: leaveId },
                })),
            },
        });
        await prisma.leaveRequest.deleteMany({
            where: { id: { in: leaveIds } },
        });
    }

    if (employeeIds.length > 0) {
        await prisma.leaveQuota.deleteMany({
            where: { employeeId: { in: employeeIds } },
        });
        await prisma.employee.updateMany({
            where: { id: { in: employeeIds } },
            data: { managerId: null },
        });
        await prisma.user.deleteMany({
            where: { employeeId: { in: employeeIds } },
        });
        await prisma.employee.deleteMany({
            where: { id: { in: employeeIds } },
        });
    }

    await prisma.department.delete({ where: { id: department.id } });
}

async function createFixture(): Promise<Fixture> {
    const department = await prisma.department.create({
        data: {
            name: DEPARTMENT_NAME,
            code: DEPARTMENT_CODE,
        },
    });
    const approver = await prisma.employee.create({
        data: {
            firstName: "Cancellation",
            lastName: "Approver",
            email: "leave-cancel-overlap-approver@integration.test",
            position: "Manager",
            departmentId: department.id,
        },
    });
    const employee = await prisma.employee.create({
        data: {
            firstName: "Cancellation",
            lastName: "Requester",
            email: "leave-cancel-overlap-requester@integration.test",
            position: "Employee",
            departmentId: department.id,
            managerId: approver.id,
        },
    });
    const employeeUser = await prisma.user.create({
        data: {
            email: "leave-cancel-overlap-user@integration.test",
            name: "Cancellation Requester",
            password: "integration-only",
            employeeId: employee.id,
        },
    });
    const approverUser = await prisma.user.create({
        data: {
            email: "leave-cancel-overlap-approver-user@integration.test",
            name: "Cancellation Approver",
            password: "integration-only",
            employeeId: approver.id,
        },
    });

    return {
        approverEmployeeId: approver.id,
        approverUserId: approverUser.id,
        employeeId: employee.id,
        employeeUserId: employeeUser.id,
        employeeUserEmail: employeeUser.email,
    };
}

async function createRequest(
    fixture: Fixture,
    idempotencyKey: string,
): Promise<string> {
    const result = await createLeaveRequest({
        id: randomUUID(),
        userId: fixture.employeeUserId,
        userEmail: fixture.employeeUserEmail,
        employeeId: fixture.employeeId,
        idempotencyKey,
        payload: LEAVE_PAYLOAD,
        attachments: [],
    });
    return result.request.id;
}

describe.sequential("leave cancellation lifecycle with real MySQL", () => {
    let fixture: Fixture;

    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => {
        await cleanFixture();
        fixture = await createFixture();
    });

    afterAll(async () => {
        await cleanFixture();
        await prisma.$disconnect();
    });

    it("rejects a new request while cancellation is awaiting confirmation", async () => {
        const originalLeaveId = await createRequest(
            fixture,
            "leave-cancel-overlap-original",
        );
        await prisma.leaveRequest.update({
            where: { id: originalLeaveId },
            data: {
                status: LeaveStatus.APPROVED,
                approvedAt: new Date(),
            },
        });

        const cancellation = await cancelLeaveRequest(
            {
                userId: fixture.employeeUserId,
                employeeId: fixture.employeeId,
            },
            originalLeaveId,
            "เปลี่ยนแผนการเดินทาง",
        );

        expect(cancellation.kind).toBe("CANCELLATION_REQUESTED");
        expect(cancellation.request.status).toBe("CANCELLATION_REQUESTED");
        expect(cancellation.request.cancellationConfirmedAt).toBeNull();

        await expect(
            createRequest(fixture, "leave-cancel-overlap-duplicate"),
        ).rejects.toMatchObject({
            message: "มีคำขอลาในช่วงวันที่นี้อยู่แล้ว",
            statusCode: 409,
        } satisfies Pick<LeaveRequestError, "message" | "statusCode">);

        await expect(
            prisma.leaveRequest.findMany({
                where: { employeeId: fixture.employeeId },
                select: {
                    id: true,
                    status: true,
                    cancellationConfirmedAt: true,
                },
            }),
        ).resolves.toEqual([{
            id: originalLeaveId,
            status: LeaveStatus.CANCELLATION_REQUESTED,
            cancellationConfirmedAt: null,
        }]);
    });

    it("can reject a late cancellation without returning quota", async () => {
        const originalLeaveId = await createRequest(
            fixture,
            "leave-cancel-expired-original",
        );
        await prisma.leaveRequest.update({
            where: { id: originalLeaveId },
            data: {
                status: LeaveStatus.APPROVED,
                approvedAt: new Date(),
            },
        });
        await prisma.leaveQuota.create({
            data: {
                employeeId: fixture.employeeId,
                year: 2000,
                leaveType: "PERSONAL",
                totalHalfDays: 20,
                usedHalfDays: 2,
            },
        });

        await expect(
            cancelLeaveRequest(
                {
                    userId: fixture.employeeUserId,
                    employeeId: fixture.employeeId,
                },
                originalLeaveId,
                "เปลี่ยนแผนการเดินทาง",
            ),
        ).resolves.toMatchObject({ kind: "CANCELLATION_REQUESTED" });

        const expiredDate = new Date("2000-01-10T00:00:00.000Z");
        await prisma.leaveRequest.update({
            where: { id: originalLeaveId },
            data: { startDate: expiredDate, endDate: expiredDate },
        });

        await expect(
            confirmLeaveCancellation(
                {
                    userId: fixture.approverUserId,
                    employeeId: fixture.approverEmployeeId,
                    role: "USER",
                },
                originalLeaveId,
            ),
        ).rejects.toMatchObject({
            message: "ไม่สามารถยืนยันการยกเลิกได้ เนื่องจากวันลาเริ่มแล้ว",
            statusCode: 409,
        });

        await expect(
            rejectLeaveCancellation(
                {
                    userId: fixture.approverUserId,
                    employeeId: fixture.approverEmployeeId,
                    role: "USER",
                },
                originalLeaveId,
            ),
        ).resolves.toMatchObject({
            kind: "CANCELLATION_REJECTED",
            request: { status: LeaveStatus.APPROVED },
        });

        await expect(
            prisma.leaveRequest.findUniqueOrThrow({
                where: { id: originalLeaveId },
                select: { status: true, cancellationConfirmedAt: true },
            }),
        ).resolves.toEqual({
            status: LeaveStatus.APPROVED,
            cancellationConfirmedAt: null,
        });
        await expect(
            prisma.leaveQuota.findUniqueOrThrow({
                where: {
                    employeeId_year_leaveType: {
                        employeeId: fixture.employeeId,
                        year: 2000,
                        leaveType: "PERSONAL",
                    },
                },
                select: { usedHalfDays: true },
            }),
        ).resolves.toEqual({ usedHalfDays: 2 });
    });

    it("allows only one concurrent cancellation decision to win", async () => {
        const originalLeaveId = await createRequest(
            fixture,
            "leave-cancel-concurrent-decision",
        );
        await prisma.leaveRequest.update({
            where: { id: originalLeaveId },
            data: {
                status: LeaveStatus.APPROVED,
                approvedAt: new Date(),
            },
        });
        await prisma.leaveQuota.update({
            where: {
                employeeId_year_leaveType: {
                    employeeId: fixture.employeeId,
                    year: 2031,
                    leaveType: "PERSONAL",
                },
            },
            data: { usedHalfDays: 2 },
        });

        await expect(
            cancelLeaveRequest(
                {
                    userId: fixture.employeeUserId,
                    employeeId: fixture.employeeId,
                },
                originalLeaveId,
                "เปลี่ยนแผนการเดินทาง",
            ),
        ).resolves.toMatchObject({ kind: "CANCELLATION_REQUESTED" });

        const outcomes = await Promise.allSettled([
            confirmLeaveCancellation(
                {
                    userId: fixture.approverUserId,
                    employeeId: fixture.approverEmployeeId,
                    role: "USER",
                },
                originalLeaveId,
            ),
            rejectLeaveCancellation(
                {
                    userId: fixture.approverUserId,
                    employeeId: fixture.approverEmployeeId,
                    role: "USER",
                },
                originalLeaveId,
            ),
        ]);

        expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
        const request = await prisma.leaveRequest.findUniqueOrThrow({
            where: { id: originalLeaveId },
            select: { status: true },
        });
        const quota = await prisma.leaveQuota.findUniqueOrThrow({
            where: {
                employeeId_year_leaveType: {
                    employeeId: fixture.employeeId,
                    year: 2031,
                    leaveType: "PERSONAL",
                },
            },
            select: { usedHalfDays: true },
        });
        const actionOutbox = await prisma.notificationOutbox.findMany({
            where: {
                payload: { contains: originalLeaveId },
                type: {
                    in: ["LEAVE_CANCELLED_AFTER_APPROVAL"],
                },
            },
            select: { type: true },
        });
        const rejectionNotifications = await prisma.notification.findMany({
            where: {
                referenceId: originalLeaveId,
                type: "SYSTEM_ALERT",
            },
            select: { id: true },
        });

        if (request.status === LeaveStatus.CANCELLED_AFTER_APPROVAL) {
            expect(quota.usedHalfDays).toBe(0);
            expect(actionOutbox).toHaveLength(1);
            expect(rejectionNotifications).toHaveLength(0);
        } else {
            expect(request.status).toBe(LeaveStatus.APPROVED);
            expect(quota.usedHalfDays).toBe(2);
            expect(actionOutbox).toHaveLength(0);
            expect(rejectionNotifications).toHaveLength(1);
        }
    });
});
