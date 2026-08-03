import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as submitLeaveRequest } from "@/app/api/leave/request/route";
import { prisma } from "@/lib/db/prisma";
import { resetMutationRateLimit } from "@/lib/security/mutation-rate-limit";

const mocks = vi.hoisted(() => ({
    session: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: (callback: () => void): void => {
            callback();
        },
    };
});

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceSession: mocks.session,
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn().mockResolvedValue(undefined),
}));

const DEPARTMENT_NAME = "Leave Quota Concurrency Integration";
const DEPARTMENT_CODE = "LEAVE-QUOTA-CONCURRENCY";
const LEAVE_YEAR = 2031;

type Fixture = {
    employeeId: number;
    employeeUserEmail: string;
    employeeUserId: number;
};

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) {
        throw new Error("DATABASE_URL is required for integration tests");
    }

    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (
        url.protocol !== "mysql:"
        || !/(?:_integration|_test)$/.test(databaseName)
    ) {
        throw new Error(
            "Refusing to run: DATABASE_URL is not a dedicated integration database",
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
            firstName: "Quota",
            lastName: "Approver",
            email: "leave-quota-concurrency-approver@integration.test",
            position: "Manager",
            departmentId: department.id,
        },
    });
    const employee = await prisma.employee.create({
        data: {
            firstName: "Quota",
            lastName: "Requester",
            email: "leave-quota-concurrency-requester@integration.test",
            position: "Employee",
            departmentId: department.id,
            managerId: approver.id,
        },
    });
    await prisma.user.create({
        data: {
            email: "leave-quota-concurrency-approver-user@integration.test",
            name: "Quota Approver",
            password: "integration-only",
            employeeId: approver.id,
        },
    });
    const employeeUser = await prisma.user.create({
        data: {
            email: "leave-quota-concurrency-requester-user@integration.test",
            name: "Quota Requester",
            password: "integration-only",
            employeeId: employee.id,
        },
    });

    return {
        employeeId: employee.id,
        employeeUserEmail: employeeUser.email,
        employeeUserId: employeeUser.id,
    };
}

function configureSession(fixture: Fixture): void {
    mocks.session.mockResolvedValue({
        ok: true,
        session: {
            user: { id: fixture.employeeUserId, role: "USER" },
        },
        user: {
            id: fixture.employeeUserId,
            email: fixture.employeeUserEmail,
            name: "Quota Requester",
        },
        employeeId: fixture.employeeId,
    });
}

function createRequest(
    idempotencyKey: string,
    startDate: string,
): NextRequest {
    return new NextRequest("http://localhost/api/leave/request", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
            leaveType: "PERSONAL",
            startDate,
            endDate: startDate,
            period: "FULL_DAY",
            reason: "Concurrent non-overlapping leave",
        }),
    });
}

describe.sequential("leave quota creation concurrency with real MySQL", () => {
    let fixture: Fixture;

    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        resetMutationRateLimit();
        await cleanFixture();
        fixture = await createFixture();
        configureSession(fixture);
    });

    afterAll(async () => {
        await cleanFixture();
        await prisma.$disconnect();
    });

    it("creates one quota for concurrent non-overlapping requests with different keys", async () => {
        const quotaBefore = await prisma.leaveQuota.count({
            where: {
                employeeId: fixture.employeeId,
                year: LEAVE_YEAR,
                leaveType: "PERSONAL",
            },
        });
        expect(quotaBefore).toBe(0);

        const responses = await Promise.all([
            submitLeaveRequest(createRequest(
                "leave-quota-concurrency-first",
                "2031-05-12",
            )),
            submitLeaveRequest(createRequest(
                "leave-quota-concurrency-second",
                "2031-05-13",
            )),
        ]);

        expect(responses.map((response) => response.status)).toEqual([201, 201]);

        const quotaRows = await prisma.leaveQuota.findMany({
            where: {
                employeeId: fixture.employeeId,
                year: LEAVE_YEAR,
                leaveType: "PERSONAL",
            },
            select: { id: true },
        });
        expect(quotaRows).toHaveLength(1);

        await expect(
            prisma.leaveRequest.count({ where: { employeeId: fixture.employeeId } }),
        ).resolves.toBe(2);
        await expect(
            prisma.leaveRequestIdempotency.count({
                where: { userId: fixture.employeeUserId },
            }),
        ).resolves.toBe(2);
    });
});
