import { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    buildITAuthorizationContext,
    getITAnalyticsDashboard,
    ITCapabilityDeniedError,
    ITWorkforceDeniedError,
    type ITAuthorizationContext,
} from "@/modules/it";

const TEST_PREFIX = "it7-ticket-analytics";
const NOW = new Date("2026-09-25T17:05:00.000Z");
let fixtureSequence = 0;
const trackedTicketIds = new Set<number>();
const trackedUserIds = new Set<number>();
const trackedEmployeeIds = new Set<number>();
const trackedDepartmentIds = new Set<number>();
const trackedCategoryIds = new Set<number>();

interface WorkforceUser {
    readonly userId: number;
    readonly employeeId: number;
    readonly context: ITAuthorizationContext;
}

interface TicketInput {
    readonly requester: WorkforceUser;
    readonly type: "INCIDENT" | "SERVICE_REQUEST" | "SUGGESTION";
    readonly status: "OPEN" | "IN_PROGRESS" | "WAITING_REQUESTER" | "RESOLVED" | "CLOSED" | "CANCELLED";
    readonly createdAt: Date;
    readonly firstRespondedAt?: Date | null;
    readonly assignedToUserId?: number | null;
    readonly categoryId?: number | null;
    readonly requesterDepartmentId?: number | null;
    readonly requesterDepartmentNameSnapshot?: string | null;
    readonly updatedAt?: Date;
}

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");
    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(databaseName)) {
        throw new Error("ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test");
    }
}

function nextFixtureKey(label: string): string {
    fixtureSequence += 1;
    return `${TEST_PREFIX}-${label}-${fixtureSequence}`;
}

async function cleanFixtures(): Promise<void> {
    const persistedTickets = await prisma.iTTicket.findMany({
        where: { requester: { email: { startsWith: `${TEST_PREFIX}-` } } },
        select: { id: true },
    });
    const ticketIds = [...new Set([
        ...trackedTicketIds,
        ...persistedTickets.map((ticket) => ticket.id),
    ])];
    if (ticketIds.length > 0) {
        await prisma.iTTicketEvent.deleteMany({ where: { ticketId: { in: ticketIds } } });
        await prisma.iTTicket.deleteMany({ where: { id: { in: ticketIds } } });
    }
    const persistedCategories = await prisma.iTTicketCategory.findMany({
        where: { key: { startsWith: `${TEST_PREFIX}-` } },
        select: { id: true },
    });
    const categoryIds = [...new Set([
        ...trackedCategoryIds,
        ...persistedCategories.map((category) => category.id),
    ])];
    if (categoryIds.length > 0) {
        await prisma.iTTicketCategory.deleteMany({
            where: { id: { in: categoryIds } },
        });
    }
    const persistedUsers = await prisma.user.findMany({
        where: { email: { startsWith: `${TEST_PREFIX}-` } },
        select: { id: true },
    });
    const userIds = [...new Set([
        ...trackedUserIds,
        ...persistedUsers.map((user) => user.id),
    ])];
    if (userIds.length > 0) {
        await prisma.userCapabilityGrant.deleteMany({
            where: { userId: { in: userIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const persistedEmployees = await prisma.employee.findMany({
        where: { email: { startsWith: `${TEST_PREFIX}-` } },
        select: { id: true },
    });
    const employeeIds = [...new Set([
        ...trackedEmployeeIds,
        ...persistedEmployees.map((employee) => employee.id),
    ])];
    if (employeeIds.length > 0) {
        await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
    }
    const persistedDepartments = await prisma.department.findMany({
        where: { code: { startsWith: `${TEST_PREFIX}-` } },
        select: { id: true },
    });
    const departmentIds = [...new Set([
        ...trackedDepartmentIds,
        ...persistedDepartments.map((department) => department.id),
    ])];
    if (departmentIds.length > 0) {
        await prisma.department.deleteMany({ where: { id: { in: departmentIds } } });
    }
    trackedTicketIds.clear();
    trackedUserIds.clear();
    trackedEmployeeIds.clear();
    trackedDepartmentIds.clear();
    trackedCategoryIds.clear();
}

async function explainResolvedEventAggregation(): Promise<readonly Record<string, unknown>[]> {
    return prisma.$queryRaw<readonly Record<string, unknown>[]>(Prisma.sql`
        EXPLAIN FORMAT=JSON
        SELECT ticketId, MIN(occurredAt)
        FROM it_ticket_events
        WHERE kind = ${"STATUS_CHANGED"}
          AND toStatus = ${"RESOLVED"}
          AND occurredAt >= ${new Date("2026-09-19T17:00:00.000Z")}
          AND occurredAt < ${NOW}
        GROUP BY ticketId
    `);
}

async function createDepartment(label: string): Promise<number> {
    const key = nextFixtureKey(label);
    const department = await prisma.department.create({
        data: { name: `${TEST_PREFIX} ${label}`, code: key },
        select: { id: true },
    });
    trackedDepartmentIds.add(department.id);
    return department.id;
}

async function createWorkforceUser(
    label: string,
    departmentId: number,
    role: Role = Role.USER,
): Promise<WorkforceUser> {
    const key = nextFixtureKey(label);
    const employee = await prisma.employee.create({
        data: {
            firstName: "เจ้าหน้าที่",
            lastName: label,
            email: `${key}-employee@integration.test`,
            position: "ผู้ทดสอบ",
            departmentId,
        },
        select: { id: true },
    });
    trackedEmployeeIds.add(employee.id);
    const user = await prisma.user.create({
        data: {
            email: `${key}@integration.test`,
            name: `บัญชี ${label}`,
            password: "integration-test-only",
            role,
            employeeId: employee.id,
        },
        select: { id: true, role: true },
    });
    trackedUserIds.add(user.id);
    return {
        userId: user.id,
        employeeId: employee.id,
        context: buildITAuthorizationContext(
            { id: user.id, role: user.role },
            employee.id,
        ),
    };
}

async function grant(userId: number, capability: string): Promise<void> {
    await prisma.userCapabilityGrant.create({
        data: { userId, capabilityKey: capability, scope: "ALL" },
    });
}

async function createTicket(input: TicketInput): Promise<number> {
    const ticket = await prisma.iTTicket.create({
        data: {
            type: input.type,
            title: "ข้อมูลทดสอบที่ต้องไม่ปรากฏในรายงาน",
            description: "รายละเอียดทดสอบส่วนบุคคล",
            status: input.status,
            requesterUserId: input.requester.userId,
            assignedToUserId: input.assignedToUserId ?? null,
            categoryId: input.categoryId ?? null,
            requesterDepartmentId: input.requesterDepartmentId ?? null,
            requesterDepartmentNameSnapshot: input.requesterDepartmentNameSnapshot ?? null,
            firstRespondedAt: input.firstRespondedAt ?? null,
            createdAt: input.createdAt,
            updatedAt: input.updatedAt ?? input.createdAt,
        },
        select: { id: true },
    });
    trackedTicketIds.add(ticket.id);
    return ticket.id;
}

async function createResolvedEvent(
    ticketId: number,
    actorUserId: number,
    occurredAt: Date,
): Promise<void> {
    await prisma.iTTicketEvent.create({
        data: {
            ticketId,
            actorUserId,
            kind: "STATUS_CHANGED",
            fromStatus: "IN_PROGRESS",
            toStatus: "RESOLVED",
            occurredAt,
        },
        select: { id: true },
    });
}

describe.sequential("IT7 Ticket analytics with real MySQL", () => {
    beforeAll(() => assertDedicatedDatabase());
    beforeEach(async () => {
        await cleanFixtures();
    });
    afterAll(async () => {
        await cleanFixtures();
    });

    it("uses current Ticket facts, immutable Department snapshots, and distinct resolution events", async () => {
        const oldDepartmentId = await createDepartment("ฝ่ายเดิม");
        const newDepartmentId = await createDepartment("ฝ่ายปัจจุบัน");
        const requester = await createWorkforceUser("ผู้แจ้ง", oldDepartmentId);
        const inactiveAssignee = await createWorkforceUser("อดีตผู้รับผิดชอบ", oldDepartmentId);
        const activeAssignee = await createWorkforceUser("ผู้รับผิดชอบ", oldDepartmentId);
        const analyticsOnly = await createWorkforceUser("ผู้ดูรายงาน", oldDepartmentId);
        await grant(analyticsOnly.userId, "it.analytics.read");

        const category = await prisma.iTTicketCategory.create({
            data: {
                key: nextFixtureKey("legacy-category"),
                name: "หมวดหมู่ที่ปิดใช้งานแล้ว",
                isActive: true,
            },
            select: { id: true },
        });
        trackedCategoryIds.add(category.id);

        const periodStart = new Date("2026-09-19T17:00:00.000Z");
        const oldBacklogTicket = await createTicket({
            requester,
            type: "INCIDENT",
            status: "OPEN",
            createdAt: periodStart,
            assignedToUserId: null,
            categoryId: category.id,
            requesterDepartmentId: oldDepartmentId,
            requesterDepartmentNameSnapshot: "ฝ่ายเดิม ณ วันสร้าง",
            firstRespondedAt: new Date(periodStart.getTime() + 42 * 60_000),
        });
        await createTicket({
            requester,
            type: "SERVICE_REQUEST",
            status: "WAITING_REQUESTER",
            createdAt: new Date("2026-09-25T16:59:59.000Z"),
            assignedToUserId: inactiveAssignee.userId,
            categoryId: category.id,
            requesterDepartmentId: oldDepartmentId,
            requesterDepartmentNameSnapshot: "ฝ่ายเดิม ณ วันสร้าง",
            firstRespondedAt: new Date("2026-09-25T17:01:59.000Z"),
        });
        const inProgressTicket = await createTicket({
            requester,
            type: "SUGGESTION",
            status: "IN_PROGRESS",
            createdAt: new Date("2026-09-25T17:00:01.000Z"),
            assignedToUserId: activeAssignee.userId,
            requesterDepartmentId: oldDepartmentId,
            requesterDepartmentNameSnapshot: null,
        });
        const resolvedTicket = await createTicket({
            requester,
            type: "INCIDENT",
            status: "RESOLVED",
            createdAt: new Date("2026-09-25T16:00:00.000Z"),
            requesterDepartmentNameSnapshot: "ฝ่ายเดิม ณ วันสร้าง",
            updatedAt: new Date("2026-09-30T00:00:00.000Z"),
        });
        const closedTicket = await createTicket({
            requester,
            type: "SERVICE_REQUEST",
            status: "CLOSED",
            createdAt: new Date("2026-09-25T16:02:00.000Z"),
            requesterDepartmentNameSnapshot: "ฝ่ายเดิม ณ วันสร้าง",
            updatedAt: new Date("2026-09-30T00:00:00.000Z"),
        });
        const cancelledTicket = await createTicket({
            requester,
            type: "SUGGESTION",
            status: "CANCELLED",
            createdAt: new Date("2026-09-25T16:04:00.000Z"),
            requesterDepartmentNameSnapshot: null,
        });
        const atPeriodEndTicket = await createTicket({
            requester,
            type: "INCIDENT",
            status: "OPEN",
            createdAt: NOW,
        });
        const oldestBacklogTicket = await createTicket({
            requester,
            type: "INCIDENT",
            status: "OPEN",
            createdAt: new Date("2026-08-01T00:00:00.000Z"),
            assignedToUserId: activeAssignee.userId,
            categoryId: category.id,
            requesterDepartmentNameSnapshot: "หน่วยงานก่อนหน้า",
        });

        await createResolvedEvent(
            resolvedTicket,
            analyticsOnly.userId,
            new Date("2026-09-25T17:01:00.000Z"),
        );
        await createResolvedEvent(
            resolvedTicket,
            analyticsOnly.userId,
            new Date("2026-09-25T17:03:00.000Z"),
        );
        await createResolvedEvent(
            closedTicket,
            analyticsOnly.userId,
            new Date("2026-09-25T17:02:00.000Z"),
        );

        await prisma.iTTicketCategory.update({
            where: { id: category.id },
            data: { isActive: false },
        });
        await prisma.user.update({
            where: { id: inactiveAssignee.userId },
            data: { isActive: false },
        });
        await prisma.employee.update({
            where: { id: inactiveAssignee.employeeId },
            data: { status: "INACTIVE" },
        });
        await prisma.department.update({
            where: { id: oldDepartmentId },
            data: { name: "ฝ่ายที่เปลี่ยนชื่อภายหลัง" },
        });
        await prisma.employee.update({
            where: { id: requester.employeeId },
            data: { departmentId: newDepartmentId },
        });

        const dashboard = await getITAnalyticsDashboard(
            analyticsOnly.context,
            "7D",
            NOW,
        );
        const plan = await explainResolvedEventAggregation();
        expect(plan).toHaveLength(1);
        console.warn("IT7 resolved-event EXPLAIN FORMAT=JSON:", JSON.stringify(plan[0]));

        expect(dashboard.summary).toEqual({
            currentBacklog: 5,
            waitingRequester: 1,
            unassignedBacklog: 2,
            oldestUnresolvedAgeMinutes: Math.floor(
                (NOW.getTime() - new Date("2026-08-01T00:00:00.000Z").getTime()) / 60_000,
            ),
            newTickets: 6,
            resolvedTickets: 2,
            firstRespondedTickets: 2,
            averageFirstResponseMinutes: 22,
            averageResolutionMinutes: 60.5,
        });
        expect(dashboard.trend).toHaveLength(7);
        expect(dashboard.trend.filter((row) => row.created > 0)).toEqual([
            { date: "2026-09-20", created: 1, resolved: 0 },
            { date: "2026-09-25", created: 4, resolved: 0 },
            { date: "2026-09-26", created: 1, resolved: 2 },
        ]);
        expect(dashboard.statusDistribution).toEqual([
            { status: "OPEN", count: 3 },
            { status: "IN_PROGRESS", count: 1 },
            { status: "WAITING_REQUESTER", count: 1 },
            { status: "RESOLVED", count: 1 },
            { status: "CLOSED", count: 1 },
            { status: "CANCELLED", count: 1 },
        ]);
        expect(dashboard.typeDistribution).toEqual([
            { type: "INCIDENT", count: 2 },
            { type: "SERVICE_REQUEST", count: 2 },
            { type: "SUGGESTION", count: 2 },
        ]);
        expect(dashboard.categoryBacklog).toContainEqual({
            label: "หมวดหมู่ที่ปิดใช้งานแล้ว",
            count: 3,
        });
        expect(dashboard.assigneeBacklog).toContainEqual({
            label: "ยังไม่มีผู้รับผิดชอบ",
            count: 2,
        });
        expect(dashboard.assigneeBacklog).toContainEqual({
            label: "ผู้รับผิดชอบเดิม",
            count: 1,
        });
        expect(dashboard.assigneeBacklog).toContainEqual({
            label: "เจ้าหน้าที่ ผู้รับผิดชอบ",
            count: 2,
        });
        expect(dashboard.departmentCreated).toContainEqual({
            label: "ฝ่ายเดิม ณ วันสร้าง",
            count: 4,
        });
        expect(dashboard.departmentCreated).toContainEqual({
            label: "ไม่ระบุหน่วยงาน",
            count: 2,
        });
        const serialized = JSON.stringify(dashboard);
        expect(serialized).not.toContain("ข้อมูลทดสอบที่ต้องไม่ปรากฏในรายงาน");
        expect(serialized).not.toContain("รายละเอียดทดสอบส่วนบุคคล");
        expect(serialized).not.toContain("requesterUserId");
        expect(serialized).not.toContain("ticketId");
        expect(trackedTicketIds).toContain(oldBacklogTicket);
        expect(trackedTicketIds).toContain(inProgressTicket);
        expect(trackedTicketIds).toContain(cancelledTicket);
        expect(trackedTicketIds).toContain(atPeriodEndTicket);
        expect(trackedTicketIds).toContain(oldestBacklogTicket);
    });

    it("preserves category and assignee identities when display labels collide", async () => {
        const departmentId = await createDepartment("dimension-identity");
        const requester = await createWorkforceUser("dimension-requester", departmentId);
        const sameNameAssigneeA = await createWorkforceUser("ชื่อซ้ำ", departmentId);
        const sameNameAssigneeB = await createWorkforceUser("ชื่อซ้ำ", departmentId);
        const inactiveAssigneeA = await createWorkforceUser("อดีตผู้รับผิดชอบ A", departmentId);
        const inactiveAssigneeB = await createWorkforceUser("อดีตผู้รับผิดชอบ B", departmentId);
        const analyticsOnly = await createWorkforceUser("dimension-report-reader", departmentId);
        await grant(analyticsOnly.userId, "it.analytics.read");

        const categoryA = await prisma.iTTicketCategory.create({
            data: {
                key: nextFixtureKey("duplicate-name-network"),
                name: "ระบบ",
                isActive: true,
            },
            select: { id: true, key: true },
        });
        const categoryB = await prisma.iTTicketCategory.create({
            data: {
                key: nextFixtureKey("duplicate-name-software"),
                name: "ระบบ",
                isActive: true,
            },
            select: { id: true, key: true },
        });
        trackedCategoryIds.add(categoryA.id);
        trackedCategoryIds.add(categoryB.id);

        const createdAt = new Date("2026-09-25T16:00:00.000Z");
        const createBacklogGroup = async (
            count: number,
            assignedToUserId: number,
            categoryId: number | null,
        ): Promise<void> => {
            for (let index = 0; index < count; index += 1) {
                await createTicket({
                    requester,
                    type: "INCIDENT",
                    status: "OPEN",
                    createdAt,
                    assignedToUserId,
                    categoryId,
                    requesterDepartmentNameSnapshot: "หน่วยงาน ณ วันสร้าง",
                });
            }
        };

        await createBacklogGroup(3, sameNameAssigneeA.userId, categoryA.id);
        await createBacklogGroup(5, sameNameAssigneeB.userId, categoryB.id);
        await createBacklogGroup(4, inactiveAssigneeA.userId, null);
        await createBacklogGroup(6, inactiveAssigneeB.userId, null);

        await prisma.iTTicketCategory.updateMany({
            where: { id: { in: [categoryA.id, categoryB.id] } },
            data: { isActive: false },
        });
        for (const inactiveAssignee of [inactiveAssigneeA, inactiveAssigneeB]) {
            await prisma.user.update({
                where: { id: inactiveAssignee.userId },
                data: { isActive: false },
            });
            await prisma.employee.update({
                where: { id: inactiveAssignee.employeeId },
                data: { status: "INACTIVE" },
            });
        }

        const dashboard = await getITAnalyticsDashboard(analyticsOnly.context, "7D", NOW);

        expect(dashboard.summary.currentBacklog).toBe(18);
        expect(dashboard.categoryBacklog).toContainEqual({
            label: `ระบบ (${categoryA.key})`,
            count: 3,
        });
        expect(dashboard.categoryBacklog).toContainEqual({
            label: `ระบบ (${categoryB.key})`,
            count: 5,
        });
        expect(dashboard.assigneeBacklog).toContainEqual({
            label: "เจ้าหน้าที่ ชื่อซ้ำ (1)",
            count: 3,
        });
        expect(dashboard.assigneeBacklog).toContainEqual({
            label: "เจ้าหน้าที่ ชื่อซ้ำ (2)",
            count: 5,
        });
        expect(dashboard.assigneeBacklog).toContainEqual({
            label: "ผู้รับผิดชอบเดิม (1)",
            count: 4,
        });
        expect(dashboard.assigneeBacklog).toContainEqual({
            label: "ผู้รับผิดชอบเดิม (2)",
            count: 6,
        });
        expect(dashboard.categoryBacklog.reduce((sum, row) => sum + row.count, 0))
            .toBe(dashboard.summary.currentBacklog);
        expect(dashboard.assigneeBacklog.reduce((sum, row) => sum + row.count, 0))
            .toBe(dashboard.summary.currentBacklog);
    });

    it("allows analytics-only authority and denies defaults, ADMIN, ticket scopes, and inactive workforce", async () => {
        const departmentId = await createDepartment("auth");
        const defaults = await createWorkforceUser("default", departmentId);
        const administrator = await createWorkforceUser("admin", departmentId, Role.ADMIN);
        const ticketOperator = await createWorkforceUser("ticket-operator", departmentId);
        await grant(ticketOperator.userId, "it.ticket.read");
        await grant(ticketOperator.userId, "it.ticket.manage");
        const inactiveAnalyticsUser = await createWorkforceUser("inactive-analytics", departmentId);
        await grant(inactiveAnalyticsUser.userId, "it.analytics.read");
        await prisma.employee.update({
            where: { id: inactiveAnalyticsUser.employeeId },
            data: { status: "INACTIVE" },
        });

        await expect(getITAnalyticsDashboard(defaults.context, "7D", NOW))
            .rejects.toBeInstanceOf(ITCapabilityDeniedError);
        await expect(getITAnalyticsDashboard(administrator.context, "7D", NOW))
            .rejects.toBeInstanceOf(ITCapabilityDeniedError);
        await expect(getITAnalyticsDashboard(ticketOperator.context, "7D", NOW))
            .rejects.toBeInstanceOf(ITCapabilityDeniedError);
        await expect(getITAnalyticsDashboard(inactiveAnalyticsUser.context, "7D", NOW))
            .rejects.toBeInstanceOf(ITWorkforceDeniedError);

        const analyticsOnly = await createWorkforceUser("analytics-only", departmentId);
        await grant(analyticsOnly.userId, "it.analytics.read");
        await expect(getITAnalyticsDashboard(analyticsOnly.context, "7D", NOW))
            .resolves.toMatchObject({
                summary: { currentBacklog: 0, newTickets: 0 },
            });
    });

});
