import { randomUUID } from "node:crypto";
import { LeaveStatus } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    cancelLeaveRequest,
    confirmLeaveCancellation,
} from "@/lib/services/leave/cancellation";
import {
    createLeaveRequest,
} from "@/lib/services/leave/create-request";
import type { LeaveRequestError } from "@/lib/services/leave/create-request";
import type { LeaveRequestValues } from "@/lib/validations/leave";

const DEPARTMENT_NAME = "Leave Cancellation Overlap Integration";
const DEPARTMENT_CODE = "LEAVE-CANCEL-OVERLAP";
const LEAVE_PAYLOAD = {
    leaveType: "PERSONAL",
    startDate: "2031-05-12",
    endDate: "2031-05-12",
    period: "FULL_DAY",
    reason: "ตรวจสอบคำขอลาซ้อนกับการยกเลิก",
} satisfies LeaveRequestValues;

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

describe.sequential("leave overlap after cancellation request with real MySQL", () => {
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

    it("does not confirm cancellation or return quota after the leave has started", async () => {
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
            prisma.leaveRequest.findUniqueOrThrow({
                where: { id: originalLeaveId },
                select: { status: true, cancellationConfirmedAt: true },
            }),
        ).resolves.toEqual({
            status: LeaveStatus.CANCELLATION_REQUESTED,
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
});
