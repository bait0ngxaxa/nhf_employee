import { randomUUID } from "node:crypto";
import { LeaveStatus } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { buildLeaveAuthorizationContext } from "../../application/authorization";
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

function authorization(
    userId: number,
    employeeId: number,
    role: "ADMIN" | "USER" = "USER",
) {
    return buildLeaveAuthorizationContext(
        { id: userId, role },
        employeeId,
        "DASHBOARD",
    );
}

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
    payload: Partial<Parameters<typeof createLeaveRequest>[0]["payload"]> = {},
): Promise<string> {
    const result = await createLeaveRequest({
        id: randomUUID(),
        userId: fixture.employeeUserId,
        userEmail: fixture.employeeUserEmail,
        employeeId: fixture.employeeId,
        idempotencyKey,
        payload: { ...LEAVE_PAYLOAD, ...payload },
        attachments: [],
        authorization: authorization(
            fixture.employeeUserId,
            fixture.employeeId,
        ),
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

    it.each([
        ["MORNING", "AFTERNOON"],
        ["AFTERNOON", "MORNING"],
    ] as const)("persists complementary %s then %s across leave types", async (first, second) => {
        await createRequest(fixture, randomUUID(), { period: first, leaveType: "SICK" });
        await createRequest(fixture, randomUUID(), { period: second, leaveType: "PERSONAL" });
        const requests = await prisma.leaveRequest.findMany({
            where: { employeeId: fixture.employeeId },
        });
        expect(requests).toHaveLength(2);
        expect(requests.map(({ period }) => period).sort()).toEqual(["AFTERNOON", "MORNING"]);
        expect(requests.every(({ durationHalfDays, status }) => durationHalfDays === 1 && status === "PENDING")).toBe(true);
        const quotas = await prisma.leaveQuota.findMany({ where: { employeeId: fixture.employeeId } });
        expect(quotas.every(({ usedHalfDays }) => usedHalfDays === 0)).toBe(true);
        for (const request of requests) {
            expect(await prisma.notificationOutbox.count({ where: { payload: { contains: request.id } } })).toBe(1);
        }
        // Both candidates must be inspected: neither slot is now free.
        for (const period of ["MORNING", "AFTERNOON"] as const) {
            await expect(createRequest(fixture, randomUUID(), { period, leaveType: "VACATION" }))
                .rejects.toMatchObject({ statusCode: 409 });
        }
        expect(await prisma.leaveRequest.count({ where: { employeeId: fixture.employeeId } })).toBe(2);
    });

    it.each(["MORNING", "AFTERNOON"] as const)("rejects duplicate %s across leave types", async (period) => {
        await createRequest(fixture, randomUUID(), { period, leaveType: "SICK" });
        await expect(createRequest(fixture, randomUUID(), { period, leaveType: "PERSONAL" }))
            .rejects.toMatchObject({ statusCode: 409, message: "มีคำขอลาในช่วงวันที่นี้อยู่แล้ว" });
        expect(await prisma.leaveRequest.count({ where: { employeeId: fixture.employeeId } })).toBe(1);
    });

    it.each(["MORNING", "AFTERNOON"] as const)("full-day range blocks %s on an interior date", async (period) => {
        await createRequest(fixture, randomUUID(), { endDate: "2031-05-14" });
        await expect(createRequest(fixture, randomUUID(), {
            period, startDate: "2031-05-13", endDate: "2031-05-13",
        })).rejects.toMatchObject({ statusCode: 409 });
    });

    it.each(["MORNING", "AFTERNOON"] as const)("%s blocks a covering full-day range but permits a disjoint day", async (period) => {
        await createRequest(fixture, randomUUID(), {
            period, startDate: "2031-05-13", endDate: "2031-05-13",
        });
        await expect(createRequest(fixture, randomUUID(), { endDate: "2031-05-14" }))
            .rejects.toMatchObject({ statusCode: 409 });
        await createRequest(fixture, randomUUID(), { startDate: "2031-05-14", endDate: "2031-05-14" });
    });

    it.each(["PENDING", "APPROVED", "CANCELLATION_REQUESTED"] as const)(
        "%s blocks its occupied half-day while allowing the complementary slot",
        async (status) => {
            const id = await createRequest(fixture, randomUUID(), { period: "MORNING", leaveType: "SICK" });
            await prisma.leaveRequest.update({ where: { id }, data: { status } });
            await expect(createRequest(fixture, randomUUID(), { period: "MORNING", leaveType: "PERSONAL" }))
                .rejects.toMatchObject({ statusCode: 409 });
            await createRequest(fixture, randomUUID(), { period: "AFTERNOON" });
        },
    );

    it.each(["REJECTED", "CANCELLED", "NOT_TAKEN", "CANCELLED_AFTER_APPROVAL"] as const)(
        "%s permits reuse of its half-day slot",
        async (status) => {
            const id = await createRequest(fixture, randomUUID(), { period: "MORNING" });
            await prisma.leaveRequest.update({ where: { id }, data: { status } });
            await createRequest(fixture, randomUUID(), { period: "MORNING" });
            expect(await prisma.leaveRequest.count({ where: { employeeId: fixture.employeeId } })).toBe(2);
        },
    );

    it.each([
        ["MORNING", "MORNING", 1],
        ["AFTERNOON", "AFTERNOON", 1],
        ["MORNING", "AFTERNOON", 2],
        ["FULL_DAY", "MORNING", 1],
    ] as const)("concurrent %s and %s persist exactly %i requests", async (first, second, count) => {
        // Start both real transaction flows before awaiting either result.
        const outcomes = await Promise.allSettled([
            createRequest(fixture, randomUUID(), { period: first }),
            createRequest(fixture, randomUUID(), { period: second }),
        ]);
        expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(count);
        for (const outcome of outcomes) {
            if (outcome.status === "rejected") {
                expect(outcome.reason).toMatchObject({ statusCode: 409 });
            }
        }
        const persisted = await prisma.leaveRequest.findMany({ where: { employeeId: fixture.employeeId } });
        expect(persisted).toHaveLength(count);
        if (count === 2) {
            expect(persisted.map(({ period }) => period).sort()).toEqual(["AFTERNOON", "MORNING"]);
            expect(persisted.every(({ durationHalfDays }) => durationHalfDays === 1)).toBe(true);
        }
    });

    it("keeps different employees independent during concurrent same-slot requests", async () => {
        const employee = await prisma.employee.create({ data: {
            firstName: "Second", lastName: "Requester", position: "Employee",
            email: "leave-overlap-second-employee@integration.test",
            departmentId: (await prisma.employee.findUniqueOrThrow({ where: { id: fixture.employeeId } })).departmentId,
            managerId: fixture.approverEmployeeId,
        } });
        const user = await prisma.user.create({ data: {
            email: "leave-overlap-second@integration.test", name: "Second Requester",
            password: "integration-only", employeeId: employee.id,
        } });
        const other = { ...fixture, employeeId: employee.id, employeeUserId: user.id, employeeUserEmail: user.email };
        await Promise.all([
            createRequest(fixture, randomUUID(), { period: "MORNING" }),
            createRequest(other, randomUUID(), { period: "MORNING" }),
        ]);
        for (const employeeId of [fixture.employeeId, other.employeeId]) {
            expect(await prisma.leaveRequest.count({ where: { employeeId } })).toBe(1);
        }
    });

    it("concurrent identical keys replay one persisted half-day and one outbox event", async () => {
        const key = randomUUID();
        const ids = await Promise.all([
            createRequest(fixture, key, { period: "MORNING" }),
            createRequest(fixture, key, { period: "MORNING" }),
        ]);
        expect(ids[0]).toBe(ids[1]);
        expect(await prisma.leaveRequest.count({ where: { employeeId: fixture.employeeId } })).toBe(1);
        expect(await prisma.leaveRequestIdempotency.count({ where: { userId: fixture.employeeUserId } })).toBe(1);
        expect(await prisma.notificationOutbox.count({ where: { payload: { contains: ids[0] } } })).toBe(1);
    });

    it("replays a half-day key without duplicate requests or side effects and rejects changed payloads", async () => {
        const key = randomUUID();
        const id = await createRequest(fixture, key, { period: "MORNING" });
        await createRequest(fixture, randomUUID(), { period: "AFTERNOON" });
        expect(await createRequest(fixture, key, { period: "MORNING" })).toBe(id);
        await expect(createRequest(fixture, key, { period: "AFTERNOON" }))
            .rejects.toMatchObject({ name: "LeaveRequestIdempotencyConflictError" });
        expect(await prisma.leaveRequest.count({ where: { employeeId: fixture.employeeId } })).toBe(2);
        expect(await prisma.leaveRequestIdempotency.count({ where: { userId: fixture.employeeUserId } })).toBe(2);
        expect(await prisma.notificationOutbox.count({ where: { payload: { contains: id } } })).toBe(1);
        expect(await prisma.auditLog.count({ where: { action: "LEAVE_REQUEST_CREATE", details: { contains: id } } })).toBe(1);
    });

    it.each(["MORNING", "AFTERNOON"] as const)("still rejects multi-date %s", async (period) => {
        await expect(createRequest(fixture, randomUUID(), { period, endDate: "2031-05-14" }))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(await prisma.leaveRequest.count({ where: { employeeId: fixture.employeeId } })).toBe(0);
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
                chargedHalfDays: 2,
                approvedAt: new Date(),
            },
        });

        const cancellation = await cancelLeaveRequest(
            {
                userId: fixture.employeeUserId,
                employeeId: fixture.employeeId,
                authorization: authorization(
                    fixture.employeeUserId,
                    fixture.employeeId,
                ),
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
                chargedHalfDays: 2,
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
                    authorization: authorization(
                        fixture.employeeUserId,
                        fixture.employeeId,
                    ),
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
                    authorization: authorization(
                        fixture.approverUserId,
                        fixture.approverEmployeeId,
                    ),
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
                    authorization: authorization(
                        fixture.approverUserId,
                        fixture.approverEmployeeId,
                    ),
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
                chargedHalfDays: 2,
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
                    authorization: authorization(
                        fixture.employeeUserId,
                        fixture.employeeId,
                    ),
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
                    authorization: authorization(
                        fixture.approverUserId,
                        fixture.approverEmployeeId,
                    ),
                },
                originalLeaveId,
            ),
            rejectLeaveCancellation(
                {
                    userId: fixture.approverUserId,
                    employeeId: fixture.approverEmployeeId,
                    role: "USER",
                    authorization: authorization(
                        fixture.approverUserId,
                        fixture.approverEmployeeId,
                    ),
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
