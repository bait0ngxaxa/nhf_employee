import { Role } from "@prisma/client";
import mysql from "mysql2/promise";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    ITTicketAssigneeNotEligibleError,
    ITTicketCategoryInactiveError,
    ITTicketCategoryNotFoundError,
    ITTicketIdempotencyConflictError,
    ITTicketInvalidTransitionError,
    ITTicketMutationConflictError,
    ITTicketStatus,
    assignITTicket,
    buildITAuthorizationContext,
    createITTicket,
    setITTicketCategory,
    transitionITTicketStatus,
} from "@/modules/it";
import type { ITAuthorizationContext } from "@/modules/it";
import {
    hasConfiguredCapabilityScopeForUser,
    type AuthorizationConfigurationError,
} from "@/modules/authorization";
import { getCurrentWorkforceDepartmentSnapshotInTransaction } from "@/modules/employee";
import { ITWorkforceDeniedError } from "@/modules/it";

const TEST_PREFIX = "it2-ticket-workflow";
let fixtureSequence = 0;

interface WorkforceUser {
    readonly userId: number;
    readonly employeeId: number;
    readonly role: Role;
    readonly context: ITAuthorizationContext;
}

interface ITFixture {
    readonly departmentId: number;
    readonly departmentName: string;
    readonly requester: WorkforceUser;
    readonly operator: WorkforceUser;
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

function getTestDatabaseUrl(): string {
    assertDedicatedDatabase();
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับจัดการ integration trigger");
    return databaseUrl;
}

async function dropEventFailureTrigger(): Promise<void> {
    const connection = await mysql.createConnection(getTestDatabaseUrl());
    try {
        await connection.query("DROP TRIGGER IF EXISTS `it2_force_event_failure`");
    } finally {
        await connection.end();
    }
}

async function createEventFailureTrigger(): Promise<void> {
    const connection = await mysql.createConnection(getTestDatabaseUrl());
    try {
        await connection.query(
            "CREATE TRIGGER it2_force_event_failure BEFORE INSERT ON it_ticket_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IT2 integration event failure'",
        );
    } finally {
        await connection.end();
    }
}

async function cleanFixtures(): Promise<void> {
    await dropEventFailureTrigger();
    await prisma.iTTicketCreateIdempotency.deleteMany({
        where: { requester: { email: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.iTTicketEvent.deleteMany({
        where: { ticket: { requester: { email: { startsWith: `${TEST_PREFIX}-` } } } },
    });
    await prisma.iTTicket.deleteMany({
        where: { requester: { email: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.iTTicketCategory.deleteMany({
        where: { key: { startsWith: `${TEST_PREFIX}-` } },
    });
    await prisma.userCapabilityGrant.deleteMany({
        where: { user: { email: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.teamMembership.deleteMany({
        where: { team: { key: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.teamRoleCapabilityGrant.deleteMany({
        where: { teamRole: { team: { key: { startsWith: `${TEST_PREFIX}-` } } } },
    });
    await prisma.teamCapabilityGrant.deleteMany({
        where: { team: { key: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.teamRole.deleteMany({
        where: { team: { key: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.team.deleteMany({
        where: { key: { startsWith: `${TEST_PREFIX}-` } },
    });
    await prisma.user.deleteMany({
        where: { email: { startsWith: `${TEST_PREFIX}-` } },
    });
    await prisma.employee.deleteMany({
        where: { email: { startsWith: `${TEST_PREFIX}-` } },
    });
    await prisma.department.deleteMany({
        where: { code: { startsWith: `${TEST_PREFIX}-` } },
    });
}

async function createDepartment(label: string): Promise<{
    readonly id: number;
    readonly name: string;
}> {
    const key = nextFixtureKey(label);
    return prisma.department.create({
        data: {
            name: `${TEST_PREFIX} ${label} ${fixtureSequence}`,
            code: key,
        },
        select: { id: true, name: true },
    });
}

async function createWorkforceUser(
    label: string,
    departmentId: number,
    options: {
        readonly role?: Role;
        readonly employeeStatus?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    } = {},
): Promise<WorkforceUser> {
    const key = nextFixtureKey(label);
    const employee = await prisma.employee.create({
        data: {
            firstName: "ผู้ใช้",
            lastName: label,
            email: `${key}-employee@integration.test`,
            position: "ผู้ทดสอบ",
            departmentId,
            status: options.employeeStatus ?? "ACTIVE",
        },
        select: { id: true },
    });
    const role = options.role ?? Role.USER;
    const user = await prisma.user.create({
        data: {
            email: `${key}@integration.test`,
            name: `ผู้ใช้ทดสอบ ${label}`,
            password: "integration-test-only",
            role,
            employeeId: employee.id,
        },
        select: { id: true, role: true },
    });

    return {
        userId: user.id,
        employeeId: employee.id,
        role: user.role,
        context: buildITAuthorizationContext(
            { id: user.id, role: user.role },
            employee.id,
        ),
    };
}

async function createFixture(label: string): Promise<ITFixture> {
    const department = await createDepartment(label);
    const requester = await createWorkforceUser(`${label}-requester`, department.id);
    const operator = await createWorkforceUser(`${label}-operator`, department.id);
    await grant(operator.userId, "it.ticket.manage");
    return {
        departmentId: department.id,
        departmentName: department.name,
        requester,
        operator,
    };
}

async function grant(
    userId: number,
    capabilityKey: string,
    scope: string = "ALL",
): Promise<void> {
    await prisma.userCapabilityGrant.create({
        data: { userId, capabilityKey, scope },
    });
}

async function grantAssigneeUsingAllSources(
    userId: number,
    label: string,
): Promise<void> {
    const teamKey = nextFixtureKey(label);
    const team = await prisma.team.create({
        data: { key: teamKey, name: `ทีม ${label}` },
        select: { id: true },
    });
    const teamRole = await prisma.teamRole.create({
        data: {
            teamId: team.id,
            key: `${label}-${fixtureSequence}`,
            name: `ผู้ปฏิบัติงาน ${label}`,
        },
        select: { id: true },
    });
    await prisma.teamMembership.create({
        data: { teamId: team.id, userId, teamRoleId: teamRole.id },
    });
    await prisma.teamCapabilityGrant.create({
        data: { teamId: team.id, capabilityKey: "it.ticket.read", scope: "ALL" },
    });
    await prisma.teamRoleCapabilityGrant.create({
        data: { teamRoleId: teamRole.id, capabilityKey: "it.ticket.comment", scope: "ALL" },
    });
    await grant(userId, "it.ticket.manage");
}

async function createTicket(
    requester: WorkforceUser,
    idempotencyKey: string = nextFixtureKey("key"),
    input: unknown = {
        type: "INCIDENT",
        title: "ระบบลงเวลาใช้งานไม่ได้",
        description: "พบข้อผิดพลาดเมื่อบันทึกเวลาเข้าทำงาน",
    },
) {
    return createITTicket(requester.context, input, { idempotencyKey });
}

async function eventsFor(ticketId: number) {
    return prisma.iTTicketEvent.findMany({
        where: { ticketId },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
}

describe.sequential("IT Ticket workflow with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => {
        await cleanFixtures();
    });

    afterAll(async () => {
        await cleanFixtures();
        await prisma.$disconnect();
    });

    it("creates from the authenticated requester, snapshots Department, and replays the canonical request", async () => {
        const fixture = await createFixture("create-replay");
        const key = nextFixtureKey("create-key");
        const input = {
            type: "SERVICE_REQUEST",
            title: "  ขอความช่วยเหลือระบบงาน  ",
            description: "  ระบบแสดงข้อความผิดพลาดเมื่อเปิดหน้าแบบฟอร์ม  ",
        };

        const created = await createTicket(fixture.requester, key, input);
        const replay = await createTicket(fixture.requester, key, {
            type: "SERVICE_REQUEST",
            title: "ขอความช่วยเหลือระบบงาน",
            description: "ระบบแสดงข้อความผิดพลาดเมื่อเปิดหน้าแบบฟอร์ม",
        });

        expect(created.replayed).toBe(false);
        expect(replay.replayed).toBe(true);
        expect(replay.ticket.id).toBe(created.ticket.id);
        expect(created.ticket).toMatchObject({
            type: "SERVICE_REQUEST",
            title: "ขอความช่วยเหลือระบบงาน",
            description: "ระบบแสดงข้อความผิดพลาดเมื่อเปิดหน้าแบบฟอร์ม",
            status: ITTicketStatus.OPEN,
            requesterUserId: fixture.requester.userId,
            assignedToUserId: null,
            categoryId: null,
            requesterDepartmentId: fixture.departmentId,
            requesterDepartmentNameSnapshot: fixture.departmentName,
            version: 1,
            resolvedAt: null,
        });
        expect(await prisma.iTTicket.count({
            where: { requesterUserId: fixture.requester.userId },
        })).toBe(1);
        expect(await prisma.iTTicketCreateIdempotency.count({
            where: { requesterUserId: fixture.requester.userId, idempotencyKey: key },
        })).toBe(1);
        expect(await prisma.iTTicketEvent.count({
            where: { ticketId: created.ticket.id },
        })).toBe(1);
        expect(await prisma.notificationOutbox.count({
            where: { eventKey: `it-ticket:${created.ticket.id}:created` },
        })).toBe(0);

        const event = (await eventsFor(created.ticket.id))[0];
        expect(event).toMatchObject({
            ticketId: created.ticket.id,
            actorUserId: fixture.requester.userId,
            kind: "CREATED",
            fromStatus: null,
            toStatus: null,
        });
        const idempotency = await prisma.iTTicketCreateIdempotency.findUniqueOrThrow({
            where: {
                requesterUserId_idempotencyKey: {
                    requesterUserId: fixture.requester.userId,
                    idempotencyKey: key,
                },
            },
        });
        expect(idempotency.requestHash).toMatch(/^[a-f0-9]{64}$/);
        expect(idempotency.ticketId).toBe(created.ticket.id);
    });

    it("rejects reuse of a creation key with different normalized input", async () => {
        const fixture = await createFixture("hash-conflict");
        const key = nextFixtureKey("hash-key");
        await createTicket(fixture.requester, key);

        await expect(createTicket(fixture.requester, key, {
            type: "INCIDENT",
            title: "หัวข้อใหม่",
            description: "รายละเอียดใหม่",
        })).rejects.toBeInstanceOf(ITTicketIdempotencyConflictError);
        expect(await prisma.iTTicket.count({
            where: { requesterUserId: fixture.requester.userId },
        })).toBe(1);
        expect(await prisma.iTTicketEvent.count({
            where: { ticket: { requesterUserId: fixture.requester.userId } },
        })).toBe(1);
    });

    it("serializes concurrent same-key creates to one Ticket, event, and idempotency record", async () => {
        const fixture = await createFixture("create-race");
        const key = nextFixtureKey("concurrent-key");
        const input = {
            type: "SUGGESTION",
            title: "ปรับปรุงขั้นตอนรับบริการ",
            description: "ขอเสนอให้ปรับหน้าขอรับบริการให้อ่านง่ายขึ้น",
        };

        const results = await Promise.all([
            createTicket(fixture.requester, key, input),
            createTicket(fixture.requester, key, input),
        ]);

        expect(new Set(results.map((result) => result.ticket.id)).size).toBe(1);
        expect(results.filter((result) => result.replayed)).toHaveLength(1);
        expect(await prisma.iTTicket.count({
            where: { requesterUserId: fixture.requester.userId },
        })).toBe(1);
        expect(await prisma.iTTicketEvent.count({
            where: { ticket: { requesterUserId: fixture.requester.userId } },
        })).toBe(1);
        expect(await prisma.iTTicketCreateIdempotency.count({
            where: { requesterUserId: fixture.requester.userId, idempotencyKey: key },
        })).toBe(1);
    });

    it("rolls back Ticket and idempotency writes when event persistence fails", async () => {
        const fixture = await createFixture("create-rollback");
        await createEventFailureTrigger();

        try {
            await expect(createTicket(fixture.requester)).rejects.toBeDefined();
        } finally {
            await dropEventFailureTrigger();
        }

        expect(await prisma.iTTicket.count({
            where: { requesterUserId: fixture.requester.userId },
        })).toBe(0);
        expect(await prisma.iTTicketEvent.count({
            where: { ticket: { requesterUserId: fixture.requester.userId } },
        })).toBe(0);
        expect(await prisma.iTTicketCreateIdempotency.count({
            where: { requesterUserId: fixture.requester.userId },
        })).toBe(0);
    });

    it("allows default creation for USER and ADMIN while denying inactive or corruptly configured actors", async () => {
        const department = await createDepartment("create-auth");
        const user = await createWorkforceUser("create-auth-user", department.id);
        const admin = await createWorkforceUser("create-auth-admin", department.id, {
            role: Role.ADMIN,
        });
        await expect(createTicket(user)).resolves.toMatchObject({ replayed: false });
        await expect(createTicket(admin)).resolves.toMatchObject({ replayed: false });

        const inactive = await createWorkforceUser("create-auth-inactive", department.id, {
            employeeStatus: "INACTIVE",
        });
        await expect(createTicket(inactive)).rejects.toBeInstanceOf(ITWorkforceDeniedError);

        const corrupt = await createWorkforceUser("create-auth-corrupt", department.id);
        await grant(corrupt.userId, "it.ticket.create");
        await expect(createTicket(corrupt)).rejects.toMatchObject({
            name: "AuthorizationConfigurationError",
            code: "UNSUPPORTED_PERSISTED_SCOPE",
        } satisfies Partial<AuthorizationConfigurationError>);
    });

    it("rechecks operator workforce and manage authority in the mutation transaction", async () => {
        const fixture = await createFixture("mutation-revalidation");
        const created = await createTicket(fixture.requester);
        const staleProjection = await prisma.$transaction((tx) =>
            hasConfiguredCapabilityScopeForUser({
                userId: fixture.operator.userId,
                capability: "it.ticket.manage",
                scope: "ALL",
                channel: "DASHBOARD",
            }, tx),
        );
        expect(staleProjection).toBe(true);
        await prisma.userCapabilityGrant.delete({
            where: {
                userId_capabilityKey_scope: {
                    userId: fixture.operator.userId,
                    capabilityKey: "it.ticket.manage",
                    scope: "ALL",
                },
            },
        });

        await expect(transitionITTicketStatus(fixture.operator.context, {
            ticketId: created.ticket.id,
            targetStatus: ITTicketStatus.IN_PROGRESS,
            expectedVersion: 1,
        })).rejects.toMatchObject({ name: "ITCapabilityDeniedError" });
        expect(await prisma.iTTicket.findUniqueOrThrow({
            where: { id: created.ticket.id },
        })).toMatchObject({ status: ITTicketStatus.OPEN, version: 1 });

        await grant(fixture.operator.userId, "it.ticket.manage");
        await prisma.employee.update({
            where: { id: fixture.operator.employeeId },
            data: { status: "INACTIVE" },
        });
        await expect(transitionITTicketStatus(fixture.operator.context, {
            ticketId: created.ticket.id,
            targetStatus: ITTicketStatus.IN_PROGRESS,
            expectedVersion: 1,
        })).rejects.toBeInstanceOf(ITWorkforceDeniedError);
    });

    it("implements only approved status transitions and appends atomic resolved history", async () => {
        const fixture = await createFixture("status-flow");
        const created = await createTicket(fixture.requester);
        const transitions = [
            { from: ITTicketStatus.OPEN, to: ITTicketStatus.IN_PROGRESS },
            { from: ITTicketStatus.IN_PROGRESS, to: ITTicketStatus.WAITING_REQUESTER },
            { from: ITTicketStatus.WAITING_REQUESTER, to: ITTicketStatus.IN_PROGRESS },
            { from: ITTicketStatus.IN_PROGRESS, to: ITTicketStatus.RESOLVED },
        ] as const;

        let expectedVersion = 1;
        for (const transition of transitions) {
            const changed = await transitionITTicketStatus(fixture.operator.context, {
                ticketId: created.ticket.id,
                targetStatus: transition.to,
                expectedVersion,
            });
            expectedVersion += 1;
            expect(changed).toMatchObject({
                changed: true,
                ticket: { status: transition.to, version: expectedVersion },
            });
        }

        const ticket = await prisma.iTTicket.findUniqueOrThrow({
            where: { id: created.ticket.id },
        });
        expect(ticket.resolvedAt).not.toBeNull();
        const events = await eventsFor(ticket.id);
        expect(events.map((event) => [event.kind, event.fromStatus, event.toStatus]))
            .toEqual([
                ["CREATED", null, null],
                ...transitions.map(({ from, to }) => ["STATUS_CHANGED", from, to]),
            ]);
        expect(events.slice(1).every((event) => event.actorUserId === fixture.operator.userId))
            .toBe(true);
        expect(events.every((event, index) => {
            const previousEvent = events[index - 1];
            if (previousEvent === undefined) return true;
            return previousEvent.occurredAt < event.occurredAt
                || (previousEvent.occurredAt.getTime() === event.occurredAt.getTime()
                    && previousEvent.id < event.id);
        })).toBe(true);
        const resolvedEvent = events.at(-1);
        expect(resolvedEvent?.occurredAt).toEqual(ticket.resolvedAt);

        await expect(transitionITTicketStatus(fixture.operator.context, {
            ticketId: ticket.id,
            targetStatus: ITTicketStatus.CLOSED,
            expectedVersion: expectedVersion,
        })).rejects.toBeInstanceOf(ITTicketInvalidTransitionError);
        await expect(transitionITTicketStatus(fixture.operator.context, {
            ticketId: ticket.id,
            targetStatus: ITTicketStatus.IN_PROGRESS,
            expectedVersion: expectedVersion,
        })).rejects.toBeInstanceOf(ITTicketInvalidTransitionError);
        expect(await prisma.iTTicketEvent.count({ where: { ticketId: ticket.id } }))
            .toBe(transitions.length + 1);
    });

    it("assigns only eligible configured operators and records assign, reassign, and unassign facts", async () => {
        const fixture = await createFixture("assignment-flow");
        const ticket = await createTicket(fixture.requester);
        const firstAssignee = await createWorkforceUser(
            "assignment-first",
            fixture.departmentId,
        );
        const secondAssignee = await createWorkforceUser(
            "assignment-second",
            fixture.departmentId,
        );
        await grantAssigneeUsingAllSources(firstAssignee.userId, "first-assignee");
        await grant(secondAssignee.userId, "it.ticket.read");
        await grant(secondAssignee.userId, "it.ticket.comment");
        await grant(secondAssignee.userId, "it.ticket.manage");

        const assigned = await assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: firstAssignee.userId,
            expectedVersion: 1,
        });
        expect(assigned).toMatchObject({
            changed: true,
            ticket: { assignedToUserId: firstAssignee.userId, version: 2 },
        });
        const sameAssignee = await assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: firstAssignee.userId,
            expectedVersion: 2,
        });
        expect(sameAssignee).toMatchObject({ changed: false, ticket: { version: 2 } });

        const reassigned = await assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: secondAssignee.userId,
            expectedVersion: 2,
        });
        expect(reassigned.ticket.version).toBe(3);
        const unassigned = await assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: null,
            expectedVersion: 3,
        });
        expect(unassigned).toMatchObject({
            changed: true,
            ticket: { assignedToUserId: null, version: 4 },
        });
        const alreadyUnassigned = await assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: null,
            expectedVersion: 4,
        });
        expect(alreadyUnassigned).toMatchObject({ changed: false, ticket: { version: 4 } });

        const assignmentEvents = (await eventsFor(ticket.ticket.id)).slice(1);
        expect(assignmentEvents.map((event) => ({
            kind: event.kind,
            from: event.fromAssigneeUserId,
            to: event.toAssigneeUserId,
        }))).toEqual([
            { kind: "ASSIGNED", from: null, to: firstAssignee.userId },
            { kind: "ASSIGNED", from: firstAssignee.userId, to: secondAssignee.userId },
            { kind: "UNASSIGNED", from: secondAssignee.userId, to: null },
        ]);
        await expect(assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: null,
            expectedVersion: 3,
        })).rejects.toBeInstanceOf(ITTicketMutationConflictError);
    });

    it("denies every independently missing assignee condition, defaults, ADMIN, analytics-only, and inactive workforce", async () => {
        const fixture = await createFixture("assignment-denials");
        const ticket = await createTicket(fixture.requester);
        const missingCapabilities = [
            "it.ticket.read",
            "it.ticket.comment",
            "it.ticket.manage",
        ] as const;

        for (const missingCapability of missingCapabilities) {
            const target = await createWorkforceUser(
                `missing-${missingCapability.split(".").at(-1)}`,
                fixture.departmentId,
            );
            for (const capability of missingCapabilities) {
                if (capability !== missingCapability) await grant(target.userId, capability);
            }
            await expect(assignITTicket(fixture.operator.context, {
                ticketId: ticket.ticket.id,
                assigneeUserId: target.userId,
                expectedVersion: 1,
            })).rejects.toBeInstanceOf(ITTicketAssigneeNotEligibleError);
        }

        await expect(assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: fixture.requester.userId,
            expectedVersion: 1,
        })).rejects.toBeInstanceOf(ITTicketAssigneeNotEligibleError);

        const admin = await createWorkforceUser("assignment-admin", fixture.departmentId, {
            role: Role.ADMIN,
        });
        await expect(assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: admin.userId,
            expectedVersion: 1,
        })).rejects.toBeInstanceOf(ITTicketAssigneeNotEligibleError);

        const analyticsOnly = await createWorkforceUser(
            "assignment-analytics-only",
            fixture.departmentId,
        );
        await grant(analyticsOnly.userId, "it.analytics.read");
        await expect(assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: analyticsOnly.userId,
            expectedVersion: 1,
        })).rejects.toBeInstanceOf(ITTicketAssigneeNotEligibleError);

        const inactive = await createWorkforceUser(
            "assignment-inactive",
            fixture.departmentId,
        );
        await grant(inactive.userId, "it.ticket.read");
        await grant(inactive.userId, "it.ticket.comment");
        await grant(inactive.userId, "it.ticket.manage");
        await prisma.employee.update({
            where: { id: inactive.employeeId },
            data: { status: "SUSPENDED" },
        });
        await expect(assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: inactive.userId,
            expectedVersion: 1,
        })).rejects.toBeInstanceOf(ITTicketAssigneeNotEligibleError);

        expect(await prisma.iTTicket.findUniqueOrThrow({
            where: { id: ticket.ticket.id },
        })).toMatchObject({ assignedToUserId: null, version: 1 });
        expect(await prisma.iTTicketEvent.count({ where: { ticketId: ticket.ticket.id } }))
            .toBe(1);
    });

    it("rechecks assignee grants after a previously eligible projection is revoked", async () => {
        const fixture = await createFixture("assignment-revocation");
        const ticket = await createTicket(fixture.requester);
        const target = await createWorkforceUser("assignment-revoked-target", fixture.departmentId);
        await grantAssigneeUsingAllSources(target.userId, "revoked-target");
        await expect(prisma.$transaction((tx) => hasConfiguredCapabilityScopeForUser({
            userId: target.userId,
            capability: "it.ticket.comment",
            scope: "ALL",
            channel: "DASHBOARD",
        }, tx))).resolves.toBe(true);
        await prisma.teamRoleCapabilityGrant.deleteMany({
            where: {
                teamRole: { memberships: { some: { userId: target.userId } } },
                capabilityKey: "it.ticket.comment",
            },
        });

        await expect(assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: target.userId,
            expectedVersion: 1,
        })).rejects.toBeInstanceOf(ITTicketAssigneeNotEligibleError);
        expect(await prisma.iTTicket.findUniqueOrThrow({ where: { id: ticket.ticket.id } }))
            .toMatchObject({ assignedToUserId: null, version: 1 });
    });

    it("classifies and clears categories without version or event churn on no-op", async () => {
        const fixture = await createFixture("category-flow");
        const ticket = await createTicket(fixture.requester);
        const activeCategory = await prisma.iTTicketCategory.create({
            data: {
                key: nextFixtureKey("category-active"),
                name: "การเข้าถึงระบบ",
            },
        });
        const inactiveCategory = await prisma.iTTicketCategory.create({
            data: {
                key: nextFixtureKey("category-inactive"),
                name: "หมวดหมู่เดิม",
                isActive: false,
            },
        });

        await expect(setITTicketCategory(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            categoryId: 999_999_999,
            expectedVersion: 1,
        })).rejects.toBeInstanceOf(ITTicketCategoryNotFoundError);
        await expect(setITTicketCategory(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            categoryId: inactiveCategory.id,
            expectedVersion: 1,
        })).rejects.toBeInstanceOf(ITTicketCategoryInactiveError);

        const set = await setITTicketCategory(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            categoryId: activeCategory.id,
            expectedVersion: 1,
        });
        expect(set).toMatchObject({
            changed: true,
            ticket: { categoryId: activeCategory.id, version: 2 },
        });
        const same = await setITTicketCategory(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            categoryId: activeCategory.id,
            expectedVersion: 2,
        });
        expect(same).toMatchObject({ changed: false, ticket: { version: 2 } });
        await prisma.iTTicketCategory.update({
            where: { id: activeCategory.id },
            data: { isActive: false },
        });
        await expect(prisma.iTTicket.findUnique({
            where: { id: ticket.ticket.id },
            include: { category: true },
        })).resolves.toMatchObject({
            categoryId: activeCategory.id,
            category: { isActive: false },
        });

        const cleared = await setITTicketCategory(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            categoryId: null,
            expectedVersion: 2,
        });
        expect(cleared).toMatchObject({
            changed: true,
            ticket: { categoryId: null, version: 3 },
        });
        const stillClear = await setITTicketCategory(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            categoryId: null,
            expectedVersion: 3,
        });
        expect(stillClear).toMatchObject({ changed: false, ticket: { version: 3 } });
        await expect(setITTicketCategory(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            categoryId: null,
            expectedVersion: 2,
        })).rejects.toBeInstanceOf(ITTicketMutationConflictError);

        const events = (await eventsFor(ticket.ticket.id)).slice(1);
        expect(events.map((event) => ({
            kind: event.kind,
            from: event.fromCategoryId,
            to: event.toCategoryId,
        }))).toEqual([
            { kind: "CATEGORY_CHANGED", from: null, to: activeCategory.id },
            { kind: "CATEGORY_CHANGED", from: activeCategory.id, to: null },
        ]);
    });

    it("allows only one competing mutation to claim an expected version", async () => {
        const fixture = await createFixture("mutation-race");
        const ticket = await createTicket(fixture.requester);
        const assignee = await createWorkforceUser("mutation-race-target", fixture.departmentId);
        await grantAssigneeUsingAllSources(assignee.userId, "mutation-race-target");

        const results = await Promise.allSettled([
            transitionITTicketStatus(fixture.operator.context, {
                ticketId: ticket.ticket.id,
                targetStatus: ITTicketStatus.IN_PROGRESS,
                expectedVersion: 1,
            }),
            assignITTicket(fixture.operator.context, {
                ticketId: ticket.ticket.id,
                assigneeUserId: assignee.userId,
                expectedVersion: 1,
            }),
        ]);

        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        const rejected = results.find((result) => result.status === "rejected");
        expect(rejected?.status).toBe("rejected");
        if (rejected?.status === "rejected") {
            expect(rejected.reason).toBeInstanceOf(ITTicketMutationConflictError);
        }
        const current = await prisma.iTTicket.findUniqueOrThrow({
            where: { id: ticket.ticket.id },
        });
        expect(current.version).toBe(2);
        expect(await prisma.iTTicketEvent.count({ where: { ticketId: ticket.ticket.id } }))
            .toBe(2);
    });

    it("uses a transaction-aware Employee projection and preserves the creation Department snapshot", async () => {
        const fixture = await createFixture("department-snapshot");
        await expect(prisma.$transaction((tx) =>
            getCurrentWorkforceDepartmentSnapshotInTransaction(
                tx,
                fixture.requester.userId,
            ),
        )).resolves.toEqual({
            employeeId: fixture.requester.employeeId,
            departmentId: fixture.departmentId,
            departmentName: fixture.departmentName,
        });

        const ticket = await createTicket(fixture.requester);
        const nextDepartment = await createDepartment("department-next");
        await prisma.employee.update({
            where: { id: fixture.requester.employeeId },
            data: { departmentId: nextDepartment.id },
        });
        await prisma.employee.update({
            where: { id: fixture.operator.employeeId },
            data: { departmentId: nextDepartment.id },
        });
        await prisma.department.update({
            where: { id: fixture.departmentId },
            data: { name: `${fixture.departmentName} Renamed` },
        });
        await expect(prisma.iTTicket.findUniqueOrThrow({ where: { id: ticket.ticket.id } }))
            .resolves.toMatchObject({
                requesterDepartmentId: fixture.departmentId,
                requesterDepartmentNameSnapshot: fixture.departmentName,
            });

        await prisma.department.delete({ where: { id: fixture.departmentId } });
        await expect(prisma.iTTicket.findUniqueOrThrow({ where: { id: ticket.ticket.id } }))
            .resolves.toMatchObject({
                requesterDepartmentId: null,
                requesterDepartmentNameSnapshot: fixture.departmentName,
            });
    });

    it("denies workforce projections for inactive/deleted users and inactive/deleted employees", async () => {
        const fixture = await createFixture("workforce-lifecycle");
        const snapshot = () => prisma.$transaction((tx) =>
            getCurrentWorkforceDepartmentSnapshotInTransaction(tx, fixture.requester.userId),
        );
        await expect(snapshot()).resolves.not.toBeNull();
        await prisma.user.update({
            where: { id: fixture.requester.userId },
            data: { isActive: false },
        });
        await expect(snapshot()).resolves.toBeNull();
        await prisma.user.update({
            where: { id: fixture.requester.userId },
            data: { isActive: true, deletedAt: new Date() },
        });
        await expect(snapshot()).resolves.toBeNull();
        await prisma.user.update({
            where: { id: fixture.requester.userId },
            data: { deletedAt: null },
        });
        await prisma.employee.update({
            where: { id: fixture.requester.employeeId },
            data: { status: "INACTIVE" },
        });
        await expect(snapshot()).resolves.toBeNull();
        await prisma.employee.update({
            where: { id: fixture.requester.employeeId },
            data: { status: "ACTIVE", deletedAt: new Date() },
        });
        await expect(snapshot()).resolves.toBeNull();
    });
});
