import { Role, type ITTicketPriority, type ITTicketStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    buildITAuthorizationContext,
    getITAnalyticsDashboard,
    getITOperatorTicket,
    ITCapabilityDeniedError,
    ITWorkforceDeniedError,
    listITOperatorTickets,
    type ITAuthorizationContext,
} from "@/modules/it";

const TEST_PREFIX = "it7-ticket-analytics";
const NOW = new Date("2026-09-25T17:05:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
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
    readonly priority?: ITTicketPriority;
    readonly triagedAt?: Date | null;
    readonly triagedByUserId?: number | null;
    readonly createdAt: Date;
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

async function explainBacklogAgingCount(): Promise<readonly Record<string, unknown>[]> {
    return prisma.$queryRaw<readonly Record<string, unknown>[]>(Prisma.sql`
        EXPLAIN FORMAT=JSON
        SELECT COUNT(*)
        FROM it_tickets
        WHERE status IN (${"OPEN"}, ${"IN_PROGRESS"}, ${"WAITING_REQUESTER"})
          AND createdAt <= ${new Date(NOW.getTime() - 8 * DAY_MS)}
          AND createdAt > ${new Date(NOW.getTime() - 15 * DAY_MS)}
    `);
}

async function explainCreatedCategoryAggregation(): Promise<readonly Record<string, unknown>[]> {
    return prisma.$queryRaw<readonly Record<string, unknown>[]>(Prisma.sql`
        EXPLAIN FORMAT=JSON
        SELECT categoryId, COUNT(*)
        FROM it_tickets
        WHERE createdAt >= ${new Date("2026-09-19T17:00:00.000Z")}
          AND createdAt < ${NOW}
        GROUP BY categoryId
    `);
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
            priority: input.priority ?? "P2",
            triagedAt: input.triagedAt ?? null,
            triagedByUserId: input.triagedByUserId ?? null,
            title: "ข้อมูลทดสอบที่ต้องไม่ปรากฏในรายงาน",
            description: "รายละเอียดทดสอบส่วนบุคคล",
            status: input.status,
            requesterUserId: input.requester.userId,
            assignedToUserId: input.assignedToUserId ?? null,
            categoryId: input.categoryId ?? null,
            requesterDepartmentId: input.requesterDepartmentId ?? null,
            requesterDepartmentNameSnapshot: input.requesterDepartmentNameSnapshot ?? null,
            createdAt: input.createdAt,
            updatedAt: input.updatedAt ?? input.createdAt,
        },
        select: { id: true },
    });
    trackedTicketIds.add(ticket.id);
    return ticket.id;
}

async function createStatusEvent(
    ticketId: number,
    actorUserId: number,
    fromStatus: ITTicketStatus,
    toStatus: ITTicketStatus,
    occurredAt: Date,
): Promise<void> {
    await prisma.iTTicketEvent.create({
        data: { ticketId, actorUserId, kind: "STATUS_CHANGED", fromStatus, toStatus, occurredAt },
        select: { id: true },
    });
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
        const priorityOperator = await createWorkforceUser("ผู้ประเมิน Priority", oldDepartmentId);
        await grant(analyticsOnly.userId, "it.analytics.read");
        await grant(priorityOperator.userId, "it.ticket.read");
        await grant(priorityOperator.userId, "it.ticket.comment");
        await grant(priorityOperator.userId, "it.ticket.manage");

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
            priority: "P0",
            triagedAt: new Date("2026-09-20T00:00:00.000Z"),
            triagedByUserId: priorityOperator.userId,
            createdAt: periodStart,
            assignedToUserId: null,
            categoryId: category.id,
            requesterDepartmentId: oldDepartmentId,
            requesterDepartmentNameSnapshot: "ฝ่ายเดิม ณ วันสร้าง",
        });
        await createTicket({
            requester,
            type: "SERVICE_REQUEST",
            status: "WAITING_REQUESTER",
            priority: "P1",
            createdAt: new Date("2026-09-25T16:59:59.000Z"),
            assignedToUserId: inactiveAssignee.userId,
            categoryId: category.id,
            requesterDepartmentId: oldDepartmentId,
            requesterDepartmentNameSnapshot: "ฝ่ายเดิม ณ วันสร้าง",
        });
        const inProgressTicket = await createTicket({
            requester,
            type: "SUGGESTION",
            status: "IN_PROGRESS",
            priority: "P2",
            createdAt: new Date("2026-09-25T17:00:01.000Z"),
            assignedToUserId: activeAssignee.userId,
            requesterDepartmentId: oldDepartmentId,
            requesterDepartmentNameSnapshot: null,
        });
        const resolvedTicket = await createTicket({
            requester,
            type: "INCIDENT",
            status: "RESOLVED",
            priority: "P3",
            createdAt: new Date("2026-09-25T16:00:00.000Z"),
            requesterDepartmentNameSnapshot: "ฝ่ายเดิม ณ วันสร้าง",
            updatedAt: new Date("2026-09-30T00:00:00.000Z"),
        });
        const closedTicket = await createTicket({
            requester,
            type: "SERVICE_REQUEST",
            status: "CLOSED",
            priority: "P1",
            createdAt: new Date("2026-09-25T16:02:00.000Z"),
            requesterDepartmentNameSnapshot: "ฝ่ายเดิม ณ วันสร้าง",
            updatedAt: new Date("2026-09-30T00:00:00.000Z"),
        });
        const cancelledTicket = await createTicket({
            requester,
            type: "SUGGESTION",
            status: "CANCELLED",
            priority: "P0",
            createdAt: new Date("2026-09-25T16:04:00.000Z"),
            requesterDepartmentNameSnapshot: null,
        });
        const atPeriodEndTicket = await createTicket({
            requester,
            type: "INCIDENT",
            status: "OPEN",
            priority: "P3",
            createdAt: NOW,
        });
        const oldestBacklogTicket = await createTicket({
            requester,
            type: "INCIDENT",
            status: "OPEN",
            priority: "P2",
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
        await prisma.iTTicketEvent.create({
            data: {
                ticketId: cancelledTicket,
                actorUserId: analyticsOnly.userId,
                kind: "STATUS_CHANGED",
                fromStatus: "IN_PROGRESS",
                toStatus: "CANCELLED",
                occurredAt: new Date("2026-09-25T17:04:00.000Z"),
            },
            select: { id: true },
        });

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
            untriagedBacklog: 4,
            highPriorityBacklog: 2,
            agedBacklog: 1,
            oldestUnresolvedAgeMinutes: Math.floor(
                (NOW.getTime() - new Date("2026-08-01T00:00:00.000Z").getTime()) / 60_000,
            ),
            newTickets: 6,
            resolvedTickets: 2,
            closedTickets: 0,
            cancelledTickets: 1,
            reopenedTickets: 0,
        });
        expect(dashboard.backlogAging).toEqual([
            { bucket: "0_1", count: 3 },
            { bucket: "2_3", count: 0 },
            { bucket: "4_7", count: 1 },
            { bucket: "8_14", count: 0 },
            { bucket: "15_PLUS", count: 1 },
        ]);
        expect(dashboard.topCategories.rows).toEqual([
            { categoryId: null, label: "ยังไม่จัดหมวดหมู่", count: 4 },
            { categoryId: category.id, label: "หมวดหมู่ที่ปิดใช้งานแล้ว", count: 2 },
        ]);
        expect(dashboard.filterOptions.categories).toContainEqual({
            id: category.id,
            key: expect.stringContaining("legacy-category"),
            name: "หมวดหมู่ที่ปิดใช้งานแล้ว",
            isActive: false,
        });
        expect(dashboard.filters).toEqual({ type: null, category: null });
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
        expect(dashboard.priorityDistribution).toEqual([
            { priority: "P0", count: 2 },
            { priority: "P1", count: 2 },
            { priority: "P2", count: 2 },
            { priority: "P3", count: 2 },
        ]);
        expect(dashboard.priorityBacklog).toEqual([
            { priority: "P0", count: 1 },
            { priority: "P1", count: 1 },
            { priority: "P2", count: 2 },
            { priority: "P3", count: 1 },
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

    it("applies type/category filters consistently while keeping current backlog independent of the period", async () => {
        const departmentId = await createDepartment("filters");
        const requester = await createWorkforceUser("filter-requester", departmentId);
        const operator = await createWorkforceUser("filter-operator", departmentId);
        const analyticsOnly = await createWorkforceUser("filter-report-reader", departmentId);
        await grant(analyticsOnly.userId, "it.analytics.read");

        const createCategory = async (label: string, name: string, isActive = true): Promise<number> => {
            const created = await prisma.iTTicketCategory.create({
                data: { key: nextFixtureKey(label), name, isActive },
                select: { id: true },
            });
            trackedCategoryIds.add(created.id);
            return created.id;
        };
        const categoryA = await createCategory("filter-a", "หมวด ก");
        const categoryB = await createCategory("filter-b", "หมวด ข");
        const unreferencedInactive = await createCategory("filter-c", "หมวดไม่มีการใช้งาน", false);
        const ago = (days: number, extraMs = 0): Date => new Date(NOW.getTime() - days * DAY_MS - extraMs);

        // Created in period with category A, later reclassified to B.
        const reclassified = await createTicket({
            requester, type: "INCIDENT", status: "IN_PROGRESS", priority: "P2",
            createdAt: ago(1), categoryId: categoryA,
        });
        await prisma.iTTicket.update({ where: { id: reclassified }, data: { categoryId: categoryB } });
        // Resolved, reopened and resolved again inside the period.
        const reopened = await createTicket({
            requester, type: "SERVICE_REQUEST", status: "RESOLVED", priority: "P2",
            createdAt: ago(2), categoryId: categoryA,
        });
        await createStatusEvent(reopened, operator.userId, "IN_PROGRESS", "RESOLVED", ago(1));
        await createStatusEvent(reopened, operator.userId, "RESOLVED", "IN_PROGRESS", ago(0, 2 * 3_600_000));
        await createStatusEvent(reopened, operator.userId, "IN_PROGRESS", "RESOLVED", ago(0, 3_600_000));
        // Exactly eight completed days old; priority raised P3 -> P1 after creation.
        const reprioritized = await createTicket({
            requester, type: "INCIDENT", status: "OPEN", priority: "P3",
            createdAt: ago(8), triagedAt: ago(7), triagedByUserId: operator.userId,
        });
        await prisma.iTTicket.update({ where: { id: reprioritized }, data: { priority: "P1" } });
        // Exactly fifteen completed days old: outside 7D but still current backlog.
        await createTicket({
            requester, type: "INCIDENT", status: "WAITING_REQUESTER", priority: "P0",
            createdAt: ago(15), categoryId: categoryA, assignedToUserId: operator.userId,
            triagedAt: ago(14), triagedByUserId: operator.userId,
        });
        // Terminal Ticket is never backlog.
        await createTicket({
            requester, type: "INCIDENT", status: "CLOSED", priority: "P0",
            createdAt: ago(3), categoryId: categoryA,
        });
        // Inconsistent future timestamp clamps into the youngest bucket.
        await createTicket({
            requester, type: "SUGGESTION", status: "OPEN", priority: "P1",
            createdAt: new Date(NOW.getTime() + 3_600_000),
        });
        await prisma.iTTicketCategory.update({ where: { id: categoryA }, data: { isActive: false } });

        const all = await getITAnalyticsDashboard(analyticsOnly.context, { period: "7D" }, NOW);
        expect(all.summary).toMatchObject({
            currentBacklog: 4,
            highPriorityBacklog: 3,
            agedBacklog: 2,
            unassignedBacklog: 3,
            untriagedBacklog: 2,
            newTickets: 3,
            resolvedTickets: 1,
        });
        expect(all.backlogAging.map((row) => row.count)).toEqual([2, 0, 0, 1, 1]);
        expect(all.backlogAging.reduce((sum, row) => sum + row.count, 0))
            .toBe(all.summary.currentBacklog);
        expect(all.priorityBacklog).toEqual([
            { priority: "P0", count: 1 },
            { priority: "P1", count: 2 },
            { priority: "P2", count: 1 },
            { priority: "P3", count: 0 },
        ]);
        expect(all.topCategories.rows).toEqual([
            { categoryId: categoryA, label: "หมวด ก", count: 2 },
            { categoryId: categoryB, label: "หมวด ข", count: 1 },
        ]);
        const optionIds = all.filterOptions.categories.map((option) => option.id);
        expect(optionIds).toEqual(expect.arrayContaining([categoryA, categoryB]));
        expect(optionIds).not.toContain(unreferencedInactive);
        expect(all.filterOptions.categories.find((option) => option.id === categoryA)?.isActive)
            .toBe(false);

        const incidents = await getITAnalyticsDashboard(
            analyticsOnly.context, { period: "7D", type: "INCIDENT" }, NOW,
        );
        expect(incidents.filters).toEqual({ type: "INCIDENT", category: null });
        expect(incidents.summary).toMatchObject({
            currentBacklog: 3, highPriorityBacklog: 2, agedBacklog: 2, newTickets: 2, resolvedTickets: 0,
        });
        expect(incidents.backlogAging.map((row) => row.count)).toEqual([1, 0, 0, 1, 1]);
        expect(incidents.topCategories.rows).toEqual([
            { categoryId: categoryA, label: "หมวด ก", count: 1 },
            { categoryId: categoryB, label: "หมวด ข", count: 1 },
        ]);
        expect(incidents.typeDistribution).toEqual([
            { type: "INCIDENT", count: 2 },
            { type: "SERVICE_REQUEST", count: 0 },
            { type: "SUGGESTION", count: 0 },
        ]);

        const serviceRequests = await getITAnalyticsDashboard(
            analyticsOnly.context, { period: "7D", type: "SERVICE_REQUEST" }, NOW,
        );
        expect(serviceRequests.summary).toMatchObject({
            currentBacklog: 0, resolvedTickets: 1, newTickets: 1,
        });
        expect(serviceRequests.trend.reduce((sum, row) => sum + row.resolved, 0)).toBe(1);

        const categoryAOnly = await getITAnalyticsDashboard(
            analyticsOnly.context, { period: "7D", category: String(categoryA) }, NOW,
        );
        expect(categoryAOnly.filters).toEqual({ type: null, category: categoryA });
        expect(categoryAOnly.summary).toMatchObject({
            currentBacklog: 1, highPriorityBacklog: 1, agedBacklog: 1, newTickets: 2, resolvedTickets: 1,
        });
        expect(categoryAOnly.topCategories.rows).toEqual([
            { categoryId: categoryA, label: "หมวด ก", count: 2 },
        ]);
        expect(categoryAOnly.backlogAging.map((row) => row.count)).toEqual([0, 0, 0, 0, 1]);

        const uncategorized = await getITAnalyticsDashboard(
            analyticsOnly.context, { period: "7D", category: "uncategorized" }, NOW,
        );
        expect(uncategorized.summary).toMatchObject({
            currentBacklog: 2, highPriorityBacklog: 2, newTickets: 0,
        });
        expect(uncategorized.topCategories.rows).toEqual([]);
        expect(uncategorized.categoryBacklog).toEqual([
            { label: "ยังไม่จัดหมวดหมู่", count: 2 },
        ]);

        const none = await getITAnalyticsDashboard(
            analyticsOnly.context, { period: "7D", category: String(categoryB), type: "SUGGESTION" }, NOW,
        );
        expect(none.summary).toMatchObject({ currentBacklog: 0, newTickets: 0, resolvedTickets: 0 });
        expect(none.backlogAging.every((row) => row.count === 0)).toBe(true);
        expect(none.summary.oldestUnresolvedAgeMinutes).toBeNull();

        const agingPlan = await explainBacklogAgingCount();
        const categoryPlan = await explainCreatedCategoryAggregation();
        expect(agingPlan).toHaveLength(1);
        expect(categoryPlan).toHaveLength(1);
        console.warn("IT analytics backlog-aging EXPLAIN FORMAT=JSON:", JSON.stringify(agingPlan[0]));
        console.warn("IT analytics created-category EXPLAIN FORMAT=JSON:", JSON.stringify(categoryPlan[0]));
    });

    it("partitions every aging boundary exactly once under type/category filters", async () => {
        const departmentId = await createDepartment("aging-boundaries");
        const actor = await createWorkforceUser("aging-boundaries", departmentId);
        await grant(actor.userId, "it.analytics.read");
        const category = await prisma.iTTicketCategory.create({ data: { key: nextFixtureKey("aging"), name: "อายุงาน" } });
        trackedCategoryIds.add(category.id);
        const ages = [-DAY_MS, 0, 2 * DAY_MS - 1, 2 * DAY_MS, 4 * DAY_MS - 1, 4 * DAY_MS,
            8 * DAY_MS - 1, 8 * DAY_MS, 15 * DAY_MS - 1, 15 * DAY_MS, 800 * DAY_MS];
        for (const type of ["INCIDENT", "SERVICE_REQUEST"] as const) {
            for (const categoryId of [category.id, null]) {
                for (const [index, age] of ages.entries()) await createTicket({
                    requester: actor, type, categoryId,
                    status: (["OPEN", "IN_PROGRESS", "WAITING_REQUESTER"] as const)[index % 3] ?? "OPEN",
                    createdAt: new Date(NOW.getTime() - age),
                });
                for (const status of ["RESOLVED", "CLOSED", "CANCELLED"] as const) await createTicket({
                    requester: actor, type, categoryId, status, createdAt: NOW,
                });
            }
        }
        for (const type of [undefined, "INCIDENT"] as const) {
            for (const categoryFilter of [undefined, String(category.id), "uncategorized"]) {
                const report = await getITAnalyticsDashboard(actor.context, {
                    period: "7D", ...(type ? { type } : {}), ...(categoryFilter ? { category: categoryFilter } : {}),
                }, NOW);
                const multiplier = (type ? 1 : 2) * (categoryFilter ? 1 : 2);
                expect(report.backlogAging.map((row) => row.count)).toEqual([3, 2, 2, 2, 2].map((count) => count * multiplier));
                expect(report.summary.currentBacklog).toBe(ages.length * multiplier);
                expect(report.priorityBacklog.reduce((sum, row) => sum + row.count, 0)).toBe(report.summary.currentBacklog);
                expect(report.backlogAging.reduce((sum, row) => sum + row.count, 0)).toBe(report.summary.currentBacklog);
            }
        }
    });

    it("counts the first qualifying event in each period and ignores additional events without changing the full DTO", async () => {
        const departmentId = await createDepartment("historical-periods");
        const viewer = await createWorkforceUser("historical-periods", departmentId);
        await grant(viewer.userId, "it.analytics.read");
        const category = await prisma.iTTicketCategory.create({
            data: { key: nextFixtureKey("historical-category"), name: "หมวดหมู่ย้อนหลัง", isActive: false },
        });
        trackedCategoryIds.add(category.id);
        const createdAt = new Date("2026-07-01T17:00:00.000Z");
        const start7 = new Date("2026-09-19T17:00:00.000Z");
        const start30 = new Date("2026-08-27T17:00:00.000Z");
        const reopened = await createTicket({
            requester: viewer, type: "INCIDENT", status: "IN_PROGRESS", priority: "P1",
            categoryId: category.id, createdAt,
        });
        const endOnly = await createTicket({
            requester: viewer, type: "INCIDENT", status: "RESOLVED", categoryId: category.id, createdAt,
        });
        const uncategorized = await createTicket({
            requester: viewer, type: "INCIDENT", status: "RESOLVED", createdAt,
        });
        await createResolvedEvent(reopened, viewer.userId, start30);
        await createStatusEvent(reopened, viewer.userId, "RESOLVED", "IN_PROGRESS", new Date(+start30 + 1000));
        await createResolvedEvent(reopened, viewer.userId, start7);
        await createStatusEvent(reopened, viewer.userId, "RESOLVED", "IN_PROGRESS", new Date(+start7 + 1000));
        await createResolvedEvent(uncategorized, viewer.userId, new Date(+start7 - 1));

        const scope = { type: "INCIDENT", category: String(category.id) };
        const weekly = await getITAnalyticsDashboard(viewer.context, { ...scope, period: "7D" }, NOW);
        const monthly = await getITAnalyticsDashboard(viewer.context, { ...scope, period: "30D" }, NOW);
        expect(weekly.summary).toMatchObject({ resolvedTickets: 1, currentBacklog: 1 });
        expect(monthly.summary).toMatchObject({ resolvedTickets: 1 });
        expect(weekly.trend.filter(({ resolved }) => resolved > 0)).toMatchObject([{ date: "2026-09-20", resolved: 1 }]);
        expect(monthly.trend.filter(({ resolved }) => resolved > 0)).toMatchObject([{ date: "2026-08-28", resolved: 1 }]);
        const uncategorizedScope = { type: "INCIDENT", category: "uncategorized" };
        const zero = await getITAnalyticsDashboard(viewer.context, { ...uncategorizedScope, period: "7D" }, NOW);
        expect(zero.summary).toMatchObject({ resolvedTickets: 0 });

        await prisma.iTTicketEvent.createMany({
            data: Array.from({ length: 512 }, (_, offset) => ({
                ticketId: reopened, actorUserId: viewer.userId, kind: "STATUS_CHANGED", toStatus: "RESOLVED",
                occurredAt: new Date(+createdAt + offset),
            })),
        });
        await createResolvedEvent(reopened, viewer.userId, start7);
        await createResolvedEvent(reopened, viewer.userId, new Date(+start7 + DAY_MS));
        await createResolvedEvent(endOnly, viewer.userId, NOW);
        await expect(getITAnalyticsDashboard(viewer.context, { ...scope, period: "7D" }, NOW)).resolves.toEqual(weekly);
        await expect(getITAnalyticsDashboard(viewer.context, { ...scope, period: "30D" }, NOW)).resolves.toEqual(monthly);
        await expect(getITAnalyticsDashboard(viewer.context, { ...uncategorizedScope, period: "7D" }, NOW)).resolves.toEqual(zero);
    });

    it("counts distinct lifecycle transitions and comparisons at both boundaries under the same Ticket filters", async () => {
        const departmentId = await createDepartment("reporting-boundaries");
        const viewer = await createWorkforceUser("reporting-boundaries", departmentId);
        await grant(viewer.userId, "it.analytics.read");
        const category = await prisma.iTTicketCategory.create({
            data: { key: nextFixtureKey("reporting-category"), name: "หมวดรายงาน" },
        });
        trackedCategoryIds.add(category.id);
        const previousStart = new Date("2026-09-13T16:55:00.000Z");
        const currentStart = new Date("2026-09-19T17:00:00.000Z");
        const beforeBoth = new Date(+previousStart - 1);
        const beforeCurrent = new Date(+currentStart - 1);
        const inside = new Date(+currentStart + 1000);
        const selected = { requester: viewer, type: "INCIDENT", categoryId: category.id } as const;
        const reopened = await createTicket({ ...selected, status: "IN_PROGRESS", priority: "P1", createdAt: beforeBoth });
        const closed = await createTicket({ ...selected, status: "CLOSED", createdAt: previousStart });
        const cancelled = await createTicket({ ...selected, status: "CANCELLED", createdAt: currentStart });
        const ordinary = await createTicket({ ...selected, status: "IN_PROGRESS", createdAt: beforeBoth });
        const excludedType = await createTicket({ ...selected, type: "SERVICE_REQUEST", status: "CLOSED", createdAt: previousStart });
        const excludedCategory = await createTicket({ ...selected, categoryId: null, status: "CLOSED", createdAt: previousStart });
        const outside = await createTicket({ ...selected, status: "CANCELLED", createdAt: beforeBoth });

        await createResolvedEvent(reopened, viewer.userId, previousStart);
        await createResolvedEvent(reopened, viewer.userId, beforeCurrent);
        await createResolvedEvent(reopened, viewer.userId, currentStart);
        await createResolvedEvent(reopened, viewer.userId, new Date(+inside + 2000));
        await createStatusEvent(reopened, viewer.userId, "RESOLVED", "IN_PROGRESS", inside);
        await createStatusEvent(reopened, viewer.userId, "RESOLVED", "IN_PROGRESS", new Date(+inside + 3000));
        await createResolvedEvent(closed, viewer.userId, beforeCurrent);
        await createStatusEvent(closed, viewer.userId, "RESOLVED", "CLOSED", inside);
        await createStatusEvent(cancelled, viewer.userId, "OPEN", "CANCELLED", currentStart);
        await createStatusEvent(ordinary, viewer.userId, "WAITING_REQUESTER", "IN_PROGRESS", inside);
        await prisma.iTTicketEvent.create({
            data: {
                ticketId: ordinary, actorUserId: viewer.userId, kind: "CATEGORY_CHANGED",
                fromStatus: "RESOLVED", toStatus: "IN_PROGRESS", occurredAt: inside,
            },
        });
        await createResolvedEvent(outside, viewer.userId, beforeBoth);
        await createStatusEvent(outside, viewer.userId, "RESOLVED", "CLOSED", beforeCurrent);
        await createStatusEvent(outside, viewer.userId, "OPEN", "CANCELLED", NOW);
        for (const ticketId of [excludedType, excludedCategory]) {
            await createResolvedEvent(ticketId, viewer.userId, beforeCurrent);
            await createStatusEvent(ticketId, viewer.userId, "RESOLVED", "CLOSED", inside);
        }

        const filters = { type: "INCIDENT", category: String(category.id) };
        const weekly = await getITAnalyticsDashboard(viewer.context, { ...filters, period: "7D" }, NOW);

        expect(weekly.summary).toMatchObject({
            newTickets: 1, resolvedTickets: 1, closedTickets: 1, cancelledTickets: 1, reopenedTickets: 1,
            currentBacklog: 2, highPriorityBacklog: 1, unassignedBacklog: 2, untriagedBacklog: 2, agedBacklog: 2,
        });
        expect(weekly.previousPeriod).toEqual({
            startAt: previousStart.toISOString(),
            endAt: currentStart.toISOString(),
            newTickets: { count: 1, percentageChange: 0 },
            resolvedTickets: { count: 2, percentageChange: -50 },
        });
        expect(weekly.trend[0]).toEqual({ date: "2026-09-20", created: 1, resolved: 1 });
        expect(weekly.trend.reduce((sum, row) => sum + row.resolved, 0)).toBe(1);
        const activeStatuses = weekly.statusDistribution.filter(({ status }) =>
            status === "OPEN" || status === "IN_PROGRESS" || status === "WAITING_REQUESTER");
        for (const rows of [activeStatuses, weekly.priorityBacklog, weekly.backlogAging, weekly.assigneeBacklog]) {
            expect(rows.reduce((sum, { count }) => sum + count, 0)).toBe(weekly.summary.currentBacklog);
        }

        const monthly = await getITAnalyticsDashboard(viewer.context, { ...filters, period: "30D" }, NOW);
        expect(monthly.summary.currentBacklog).toBe(weekly.summary.currentBacklog);
        expect(monthly.backlogAging).toEqual(weekly.backlogAging);
        for (const partialFilters of [{ type: filters.type }, { category: filters.category }]) {
            const report = await getITAnalyticsDashboard(viewer.context, { ...partialFilters, period: "7D" }, NOW);
            expect(report.previousPeriod.newTickets.count).toBe(2);
            expect(report.previousPeriod.resolvedTickets.count).toBe(3);
            expect(report.summary.closedTickets).toBe(2);
        }
        const unfiltered = await getITAnalyticsDashboard(viewer.context, "7D", NOW);
        expect(unfiltered.previousPeriod.newTickets.count).toBe(3);
        expect(unfiltered.previousPeriod.resolvedTickets.count).toBe(4);
        expect(unfiltered.summary.closedTickets).toBe(3);
    });

    it("keeps a whole Dashboard snapshot while another transaction commits Ticket and event changes", async () => {
        const departmentId = await createDepartment("resolution-snapshot");
        const viewer = await createWorkforceUser("resolution-snapshot", departmentId);
        await grant(viewer.userId, "it.analytics.read");
        const category = await prisma.iTTicketCategory.create({
            data: { key: nextFixtureKey("snapshot-category"), name: "หมวดหมู่ปัจจุบัน" },
        });
        trackedCategoryIds.add(category.id);
        const createdAt = new Date("2026-09-20T17:00:00.000Z");
        const historicallyResolved = await createTicket({
            requester: viewer, type: "INCIDENT", status: "RESOLVED", priority: "P2", createdAt,
        });
        const newlyResolved = await createTicket({
            requester: viewer, type: "INCIDENT", status: "IN_PROGRESS", priority: "P1", createdAt,
        });
        const earlier = new Date(+createdAt + 3_600_000);
        await createResolvedEvent(historicallyResolved, viewer.userId, earlier);
        const input = { period: "7D", type: "INCIDENT", category: "uncategorized" };
        const baseline = await getITAnalyticsDashboard(viewer.context, input, NOW);
        expect(baseline.summary).toMatchObject({ resolvedTickets: 1, currentBacklog: 1 });

        const transaction = prisma.$transaction.bind(prisma);
        const spy = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (read, options) => {
            expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
            return transaction(async (tx) => {
                // Pin the reader snapshot, then wait for an independent writer to commit.
                expect(await tx.iTTicket.count({ where: { id: { in: [historicallyResolved, newlyResolved] } } })).toBe(2);
                await transaction(async (writer) => {
                    await writer.iTTicket.update({
                        where: { id: historicallyResolved }, data: { status: "IN_PROGRESS", priority: "P0", categoryId: category.id },
                    });
                    await writer.iTTicket.update({ where: { id: newlyResolved }, data: { status: "RESOLVED" } });
                    await writer.iTTicketEvent.createMany({
                        data: [
                            { ticketId: historicallyResolved, actorUserId: viewer.userId, kind: "STATUS_CHANGED", fromStatus: "RESOLVED", toStatus: "IN_PROGRESS", occurredAt: new Date(+earlier + 1000) },
                            { ticketId: historicallyResolved, actorUserId: viewer.userId, kind: "CATEGORY_CHANGED", toCategoryId: category.id, occurredAt: new Date(+earlier + 1000) },
                            { ticketId: newlyResolved, actorUserId: viewer.userId, kind: "STATUS_CHANGED", fromStatus: "IN_PROGRESS", toStatus: "RESOLVED", occurredAt: new Date(+earlier + 3_600_000) },
                        ],
                    });
                });
                return read(tx);
            }, options);
        });
        try {
            await expect(getITAnalyticsDashboard(viewer.context, input, NOW)).resolves.toEqual(baseline);
            expect(spy).toHaveBeenCalledTimes(1);
        } finally {
            spy.mockRestore();
        }
        const fresh = await getITAnalyticsDashboard(viewer.context, input, NOW);
        expect(fresh.summary).toMatchObject({ resolvedTickets: 1, currentBacklog: 0 });
        const all = await getITAnalyticsDashboard(viewer.context, { period: "7D" }, NOW);
        expect(all.summary).toMatchObject({ resolvedTickets: 2, currentBacklog: 1 });
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
        const inactiveAccount = await createWorkforceUser("inactive-account", departmentId);
        await grant(inactiveAccount.userId, "it.analytics.read");
        await prisma.user.update({ where: { id: inactiveAccount.userId }, data: { isActive: false } });
        const nonGlobal = await createWorkforceUser("non-global", departmentId);
        // Exercise fail-closed resolution for an unsupported persisted grant.
        await prisma.userCapabilityGrant.create({
            data: { userId: nonGlobal.userId, capabilityKey: "it.analytics.read", scope: "OWN" },
        });

        await expect(getITAnalyticsDashboard(defaults.context, "7D", NOW))
            .rejects.toBeInstanceOf(ITCapabilityDeniedError);
        await expect(getITAnalyticsDashboard(administrator.context, "7D", NOW))
            .rejects.toBeInstanceOf(ITCapabilityDeniedError);
        await expect(getITAnalyticsDashboard(ticketOperator.context, "7D", NOW))
            .rejects.toBeInstanceOf(ITCapabilityDeniedError);
        await expect(getITAnalyticsDashboard(inactiveAnalyticsUser.context, "7D", NOW))
            .rejects.toBeInstanceOf(ITWorkforceDeniedError);
        await expect(getITAnalyticsDashboard(inactiveAccount.context, "7D", NOW))
            .rejects.toBeInstanceOf(ITWorkforceDeniedError);
        await expect(getITAnalyticsDashboard(nonGlobal.context, "7D", NOW))
            .rejects.toMatchObject({ name: "AuthorizationConfigurationError", code: "UNSUPPORTED_PERSISTED_SCOPE" });

        const analyticsOnly = await createWorkforceUser("analytics-only", departmentId);
        await grant(analyticsOnly.userId, "it.analytics.read");
        await expect(getITAnalyticsDashboard(analyticsOnly.context, "7D", NOW))
            .resolves.toMatchObject({
                summary: { currentBacklog: 0, newTickets: 0 },
            });

        const otherTicketId = await createTicket({
            requester: defaults, type: "INCIDENT", status: "OPEN", createdAt: NOW,
        });
        await expect(listITOperatorTickets(analyticsOnly.context, {}))
            .rejects.toBeInstanceOf(ITCapabilityDeniedError);
        await expect(getITOperatorTicket(analyticsOnly.context, otherTicketId))
            .rejects.toBeInstanceOf(ITCapabilityDeniedError);
    });

});
