import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { amendPendingLeaveSpecialReason, buildLeaveAuthorizationContext, decideLeaveRequest, getEmployeeLeaveQuotaProjection } from "@/modules/leave";
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
            role: "USER",
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

    it("concurrent quota reads do not initialize rows and retain signed carry", async () => {
        await prisma.leaveQuota.create({ data: {
            employeeId: fixture.employeeId, year: 2029, leaveType: "PERSONAL",
            totalHalfDays: 20, usedHalfDays: 25, carryBalanceHalfDays: 0,
        } });
        const before = await prisma.leaveQuota.findMany({ where: { employeeId: fixture.employeeId } });
        const projections = await Promise.all(Array.from({ length: 5 }, () => getEmployeeLeaveQuotaProjection(fixture.employeeId, 2031)));
        expect(projections[0].find((quota) => quota.leaveType === "PERSONAL")).toMatchObject({ carryBalanceDays: 7.5, remainingDays: 17.5 });
        expect(await prisma.leaveQuota.findMany({ where: { employeeId: fixture.employeeId } })).toEqual(before);
    });

    async function submitPair(): Promise<string[]> {
        for (const [index, date] of ["2031-05-12", "2031-05-13"].entries()) {
            const response = await submitLeaveRequest(createRequest(`pending-pair-${index}`, date));
            expect(response.status).toBe(201);
        }
        const requests = await prisma.leaveRequest.findMany({ where: { employeeId: fixture.employeeId }, orderBy: { startDate: "asc" } });
        expect(requests.every((request) => request.status === "PENDING")).toBe(true);
        expect((await prisma.leaveQuota.findFirstOrThrow({ where: { employeeId: fixture.employeeId, year: LEAVE_YEAR, leaveType: "PERSONAL" } })).usedHalfDays).toBe(0);
        return requests.map((request) => request.id);
    }

    async function approverActor() {
        const employee = await prisma.employee.findUniqueOrThrow({ where: { id: fixture.employeeId }, include: { manager: { include: { user: true } } } });
        const manager = employee.manager;
        if (!manager?.user) throw new Error("Missing approver fixture");
        return { userId: manager.user.id, employeeId: manager.id, userEmail: manager.user.email, name: manager.user.name, authorization: buildLeaveAuthorizationContext(manager.user, manager.id, "DASHBOARD") };
    }

    function requesterActor(channel: "DASHBOARD" | "LIFF_SELF_SERVICE" = "DASHBOARD") {
        return { userEmail: fixture.employeeUserEmail, authorization: buildLeaveAuthorizationContext({ id: fixture.employeeUserId, role: "USER" }, fixture.employeeId, channel) };
    }

    it("A: pending requests consume nothing and both approve within entitlement", async () => {
        const ids = await submitPair();
        const actor = await approverActor();
        for (const leaveId of ids) await decideLeaveRequest(actor, { leaveId, action: "APPROVE" });
        expect((await prisma.leaveQuota.findFirstOrThrow({ where: { employeeId: fixture.employeeId, year: LEAVE_YEAR, leaveType: "PERSONAL" } })).usedHalfDays).toBe(4);
    });

    it.each(["DASHBOARD", "LIFF_SELF_SERVICE"] as const)("B/F: %s recovers from pending quota collision with one audited amendment", async (channel) => {
        const ids = await submitPair();
        await prisma.leaveQuota.updateMany({ where: { employeeId: fixture.employeeId, year: LEAVE_YEAR, leaveType: "PERSONAL" }, data: { usedHalfDays: 18 } });
        const actor = await approverActor();
        await decideLeaveRequest(actor, { leaveId: ids[0], action: "APPROVE" });
        await expect(decideLeaveRequest(actor, { leaveId: ids[1], action: "APPROVE" })).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("ผู้ยื่นคำขอ") });
        expect((await prisma.leaveRequest.findUniqueOrThrow({ where: { id: ids[1] } })).status).toBe("PENDING");
        expect((await prisma.leaveQuota.findFirstOrThrow({ where: { employeeId: fixture.employeeId, year: LEAVE_YEAR, leaveType: "PERSONAL" } })).usedHalfDays).toBe(20);
        const before = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: ids[1] } });
        const amendment = { leaveId: ids[1], specialReason: "มีเหตุจำเป็นต้องดูแลครอบครัว", expectedSpecialReason: null };
        await amendPendingLeaveSpecialReason(requesterActor(channel), amendment);
        await amendPendingLeaveSpecialReason(requesterActor(channel), amendment);
        const after = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: ids[1] } });
        expect(after).toEqual({ ...before, specialReason: amendment.specialReason, updatedAt: after.updatedAt });
        const audits = await prisma.auditLog.findMany({ where: { action: "LEAVE_REQUEST_SPECIAL_REASON_UPDATE", details: { contains: ids[1] } } });
        expect(audits).toHaveLength(1);
        expect(audits[0].userId).toBe(fixture.employeeUserId);
        await decideLeaveRequest(actor, { leaveId: ids[1], action: "APPROVE" });
        expect((await prisma.leaveQuota.findFirstOrThrow({ where: { employeeId: fixture.employeeId, year: LEAVE_YEAR, leaveType: "PERSONAL" } })).usedHalfDays).toBe(22);
        expect((await prisma.leaveRequest.findUniqueOrThrow({ where: { id: ids[1] } })).overQuotaHalfDays).toBe(2);
    });

    it("C: simultaneous amendment and approval serialize without losing or double-deducting", async () => {
        const [leaveId] = await submitPair();
        const actor = await approverActor();
        const results = await Promise.allSettled([
            amendPendingLeaveSpecialReason(requesterActor(), { leaveId, specialReason: "มีเหตุจำเป็นเป็นกรณีพิเศษ", expectedSpecialReason: null }),
            decideLeaveRequest(actor, { leaveId, action: "APPROVE" }),
        ]);
        expect(results[1].status).toBe("fulfilled");
        const request = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: leaveId } });
        expect(request.status).toBe("APPROVED");
        if (results[0].status === "fulfilled") expect(request.specialReason).toBe("มีเหตุจำเป็นเป็นกรณีพิเศษ");
        else expect(results[0].reason).toMatchObject({ statusCode: 409 });
        await expect(decideLeaveRequest(actor, { leaveId, action: "APPROVE" })).rejects.toMatchObject({ statusCode: 409 });
        expect((await prisma.leaveQuota.findFirstOrThrow({ where: { employeeId: fixture.employeeId, year: LEAVE_YEAR, leaveType: "PERSONAL" } })).usedHalfDays).toBe(2);
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
            select: {
                id: true,
                totalHalfDays: true,
                carryBalanceHalfDays: true,
                usedHalfDays: true,
            },
        });
        expect(quotaRows).toEqual([
            expect.objectContaining({
                totalHalfDays: 20,
                carryBalanceHalfDays: 0,
                usedHalfDays: 0,
            }),
        ]);

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
