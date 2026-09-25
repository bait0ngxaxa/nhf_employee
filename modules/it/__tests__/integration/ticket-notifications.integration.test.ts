import { Role } from "@prisma/client";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    assignITTicket,
    buildITAuthorizationContext,
    createITTicket,
    dispatchITTicketNotificationOutbox,
    postITOperatorTicketComment,
    postITRequesterTicketComment,
    transitionITTicketStatus,
    type ITAuthorizationContext,
} from "@/modules/it";
import {
    parseITTicketNotificationPayload,
    type ITTicketNotificationPayloadV1,
} from "../../domain/ticket-notification";

const TEST_PREFIX = "it6-ticket-notifications";
const OUTBOX_FAILURE_TRIGGER = "it6_force_notification_outbox_failure";
let fixtureSequence = 0;
const trackedTicketIds = new Set<number>();

interface WorkforceUser {
    readonly userId: number;
    readonly employeeId: number;
    readonly context: ITAuthorizationContext;
}

interface TicketFixture {
    readonly departmentId: number;
    readonly requester: WorkforceUser;
}

interface ParsedOutboxRow {
    readonly row: Awaited<ReturnType<typeof prisma.notificationOutbox.findMany>>[number];
    readonly payload: ITTicketNotificationPayloadV1;
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
    if (!databaseUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration trigger");
    return databaseUrl;
}

async function dropOutboxFailureTrigger(): Promise<void> {
    const connection = await mysql.createConnection(getTestDatabaseUrl());
    try {
        await connection.query(`DROP TRIGGER IF EXISTS \`${OUTBOX_FAILURE_TRIGGER}\``);
    } finally {
        await connection.end();
    }
}

async function createOutboxFailureTrigger(): Promise<void> {
    const connection = await mysql.createConnection(getTestDatabaseUrl());
    try {
        await connection.query(
            `CREATE TRIGGER \`${OUTBOX_FAILURE_TRIGGER}\` BEFORE INSERT ON notification_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IT6 forced outbox failure'`,
        );
    } finally {
        await connection.end();
    }
}

async function cleanFixtures(): Promise<void> {
    await dropOutboxFailureTrigger();
    const ticketIds = [...trackedTicketIds];
    for (const ticketId of ticketIds) {
        await prisma.notificationOutbox.deleteMany({
            where: {
                type: "IT_TICKET_IN_APP",
                eventKey: { startsWith: `it:ticket:${ticketId}:` },
            },
        });
    }
    if (ticketIds.length > 0) {
        await prisma.notification.deleteMany({
            where: {
                type: "IT_TICKET",
                referenceId: { in: ticketIds.map(String) },
            },
        });
    }
    await prisma.iTTicketCommentIdempotency.deleteMany({
        where: { author: { email: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.iTTicketCreateIdempotency.deleteMany({
        where: { requester: { email: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.iTTicketComment.deleteMany({
        where: { ticket: { requester: { email: { startsWith: `${TEST_PREFIX}-` } } } },
    });
    await prisma.iTTicketEvent.deleteMany({
        where: { ticket: { requester: { email: { startsWith: `${TEST_PREFIX}-` } } } },
    });
    await prisma.iTTicket.deleteMany({
        where: { requester: { email: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.userCapabilityGrant.deleteMany({
        where: { user: { email: { startsWith: `${TEST_PREFIX}-` } } },
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
    trackedTicketIds.clear();
}

async function createTicketFixture(label: string): Promise<TicketFixture> {
    const departmentKey = nextFixtureKey(label);
    const department = await prisma.department.create({
        data: {
            name: `${TEST_PREFIX} ${label}`,
            code: departmentKey,
        },
        select: { id: true },
    });
    return {
        departmentId: department.id,
        requester: await createWorkforceUser(`${label}-requester`, department.id),
    };
}

async function createWorkforceUser(
    label: string,
    departmentId: number,
): Promise<WorkforceUser> {
    const key = nextFixtureKey(label);
    const employee = await prisma.employee.create({
        data: {
            firstName: "พนักงาน",
            lastName: label,
            email: `${key}-employee@integration.test`,
            position: "ผู้ทดสอบ",
            departmentId,
        },
        select: { id: true },
    });
    const user = await prisma.user.create({
        data: {
            email: `${key}@integration.test`,
            name: `บัญชี ${label}`,
            password: "integration-test-only",
            role: Role.USER,
            employeeId: employee.id,
        },
        select: { id: true, role: true },
    });
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

async function createOperator(
    fixture: TicketFixture,
    label: string,
): Promise<WorkforceUser> {
    const operator = await createWorkforceUser(label, fixture.departmentId);
    await grant(operator.userId, "it.ticket.read");
    await grant(operator.userId, "it.ticket.comment");
    await grant(operator.userId, "it.ticket.manage");
    return operator;
}

async function grantOperator(user: WorkforceUser): Promise<void> {
    await grant(user.userId, "it.ticket.read");
    await grant(user.userId, "it.ticket.comment");
    await grant(user.userId, "it.ticket.manage");
}

function createTicketInput(label: string) {
    return {
        type: "INCIDENT" as const,
        title: `ระบบขัดข้อง ${label}`,
        description: `รายละเอียดส่วนตัวของ ${label}`,
    };
}

async function createTicket(
    requester: WorkforceUser,
    label: string,
    idempotencyKey: string = nextFixtureKey(`${label}-create`),
) {
    const result = await createITTicket(
        requester.context,
        createTicketInput(label),
        { idempotencyKey },
    );
    trackedTicketIds.add(result.ticket.id);
    return { ...result, idempotencyKey };
}

async function getOutboxRows(ticketId: number): Promise<ParsedOutboxRow[]> {
    const rows = await prisma.notificationOutbox.findMany({
        where: {
            type: "IT_TICKET_IN_APP",
            eventKey: { startsWith: `it:ticket:${ticketId}:` },
        },
        orderBy: { id: "asc" },
    });
    return rows.map((row) => {
        const parsed: unknown = JSON.parse(row.payload);
        return {
            row,
            payload: parseITTicketNotificationPayload(parsed),
        };
    });
}

async function getTicketInbox(ticketId: number, userId?: number) {
    return prisma.notification.findMany({
        where: {
            type: "IT_TICKET",
            referenceId: String(ticketId),
            ...(userId === undefined ? {} : { userId }),
        },
        orderBy: { createdAt: "asc" },
    });
}

async function latestTicket(ticketId: number) {
    return prisma.iTTicket.findUniqueOrThrow({ where: { id: ticketId } });
}

describe.sequential("IT6 Ticket in-app notifications with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => cleanFixtures());

    afterAll(async () => {
        await cleanFixtures();
        await prisma.$disconnect();
    });

    it("atomically fans out creation intents and excludes an operator requester", async () => {
        const fixture = await createTicketFixture("create-audience");
        const operatorA = await createOperator(fixture, "create-operator-a");
        const operatorB = await createOperator(fixture, "create-operator-b");
        await grantOperator(fixture.requester);
        const idempotencyKey = nextFixtureKey("create-replay-key");
        const input = createTicketInput("create-audience");

        const created = await createITTicket(fixture.requester.context, input, {
            idempotencyKey,
        });
        trackedTicketIds.add(created.ticket.id);
        const rows = await getOutboxRows(created.ticket.id);

        expect(created.replayed).toBe(false);
        expect(rows.map(({ payload }) => payload.recipientUserId).sort()).toEqual(
            [operatorA.userId, operatorB.userId].sort(),
        );
        expect(rows.every(({ payload }) =>
            payload.event === "CREATED"
            && payload.audience === "OPERATOR_QUEUE"
            && payload.source.kind === "EVENT",
        )).toBe(true);
        for (const { row, payload } of rows) {
            const sourceId = payload.source.kind === "EVENT"
                ? payload.source.id
                : 0;
            expect(row.eventKey).toBe(
                `it:ticket:${created.ticket.id}:event:${sourceId}:user:${payload.recipientUserId}:in-app`,
            );
            expect(row.payload).not.toContain(input.description);
            expect(row.payload).not.toContain("attachment");
            expect(row.payload).not.toContain("capability");
        }

        const replay = await createITTicket(fixture.requester.context, input, {
            idempotencyKey,
        });
        expect(replay.replayed).toBe(true);
        expect(await getOutboxRows(created.ticket.id)).toHaveLength(2);
    });

    it("allows creation with no configured operator audience", async () => {
        const fixture = await createTicketFixture("empty-audience");

        const created = await createTicket(fixture.requester, "empty-audience");

        expect(created.ticket.status).toBe("OPEN");
        expect(await getOutboxRows(created.ticket.id)).toHaveLength(0);
    });

    it("converges concurrent same-key creation on one Ticket, event, and intent per recipient", async () => {
        const fixture = await createTicketFixture("create-concurrent");
        const operator = await createOperator(fixture, "create-concurrent-operator");
        const idempotencyKey = nextFixtureKey("create-concurrent-key");
        const input = createTicketInput("create-concurrent");

        const results = await Promise.all([
            createITTicket(fixture.requester.context, input, { idempotencyKey }),
            createITTicket(fixture.requester.context, input, { idempotencyKey }),
        ]);
        for (const result of results) trackedTicketIds.add(result.ticket.id);
        const ticketId = results[0]?.ticket.id;
        expect(ticketId).toBeDefined();
        expect(new Set(results.map((result) => result.ticket.id)).size).toBe(1);
        expect(await prisma.iTTicket.count({ where: { id: ticketId } })).toBe(1);
        expect(await prisma.iTTicketEvent.count({ where: { ticketId } })).toBe(1);
        expect(await prisma.iTTicketCreateIdempotency.count({
            where: { ticketId },
        })).toBe(1);
        expect((await getOutboxRows(ticketId ?? 0)).map(({ payload }) =>
            payload.recipientUserId,
        )).toEqual([operator.userId]);
    });

    it("uses a distinct generation for each assignment, omits self and unassignment intents", async () => {
        const fixture = await createTicketFixture("assignment-generations");
        const operatorA = await createOperator(fixture, "assignment-a");
        const operatorB = await createOperator(fixture, "assignment-b");
        const manager = await createOperator(fixture, "assignment-manager");
        const created = await createTicket(fixture.requester, "assignment-generations");

        let ticket = created.ticket;
        for (const assignee of [operatorA, operatorB, operatorA]) {
            const result = await assignITTicket(manager.context, {
                ticketId: ticket.id,
                expectedVersion: ticket.version,
                assigneeUserId: assignee.userId,
            });
            ticket = result.ticket;
        }
        const unassigned = await assignITTicket(manager.context, {
            ticketId: ticket.id,
            expectedVersion: ticket.version,
            assigneeUserId: null,
        });
        ticket = unassigned.ticket;
        expect(unassigned.changed).toBe(true);
        const repeatedUnassign = await assignITTicket(manager.context, {
            ticketId: ticket.id,
            expectedVersion: ticket.version,
            assigneeUserId: null,
        });
        expect(repeatedUnassign.changed).toBe(false);
        const selfAssignment = await assignITTicket(operatorA.context, {
            ticketId: ticket.id,
            expectedVersion: ticket.version,
            assigneeUserId: operatorA.userId,
        });
        expect(selfAssignment.changed).toBe(true);
        const repeatedSelfAssignment = await assignITTicket(operatorA.context, {
            ticketId: selfAssignment.ticket.id,
            expectedVersion: selfAssignment.ticket.version,
            assigneeUserId: operatorA.userId,
        });
        expect(repeatedSelfAssignment.changed).toBe(false);

        const assignmentRows = (await getOutboxRows(ticket.id))
            .filter(({ payload }) => payload.event === "ASSIGNED");
        expect(assignmentRows.map(({ payload }) => payload.recipientUserId)).toEqual([
            operatorA.userId,
            operatorB.userId,
            operatorA.userId,
        ]);
        expect(new Set(assignmentRows.map(({ payload }) =>
            payload.source.kind === "EVENT" ? payload.source.id : 0,
        )).size).toBe(3);
        expect(new Set(assignmentRows.map(({ row }) => row.eventKey)).size).toBe(3);
        expect(assignmentRows.some(({ payload }) =>
            payload.recipientUserId === manager.userId,
        )).toBe(false);
    });

    it("notifies the requester and assigned operator for comments, while queue comments fan out once", async () => {
        const fixture = await createTicketFixture("comments");
        const operatorA = await createOperator(fixture, "comments-a");
        const operatorB = await createOperator(fixture, "comments-b");
        const manager = await createOperator(fixture, "comments-manager");
        const created = await createTicket(fixture.requester, "comments");
        const assigned = await assignITTicket(manager.context, {
            ticketId: created.ticket.id,
            expectedVersion: created.ticket.version,
            assigneeUserId: operatorA.userId,
        });

        const operatorCommentKey = nextFixtureKey("operator-comment-key");
        const operatorBody = "เนื้อหาความเห็นของเจ้าหน้าที่";
        const operatorComment = await postITOperatorTicketComment(
            operatorA.context,
            { ticketId: created.ticket.id, body: operatorBody },
            { idempotencyKey: operatorCommentKey },
        );
        const operatorCommentReplay = await postITOperatorTicketComment(
            operatorA.context,
            { ticketId: created.ticket.id, body: operatorBody },
            { idempotencyKey: operatorCommentKey },
        );
        expect(operatorCommentReplay.replayed).toBe(true);
        expect(operatorCommentReplay.comment.id).toBe(operatorComment.comment.id);

        const requesterCommentKey = nextFixtureKey("requester-comment-key");
        const requesterBody = "ผู้ขอส่งรายละเอียดเพิ่มเติม";
        const requesterComment = await postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: created.ticket.id, body: requesterBody },
            { idempotencyKey: requesterCommentKey },
        );
        const rows = await getOutboxRows(created.ticket.id);
        const operatorIntent = rows.find(({ payload }) =>
            payload.event === "OPERATOR_COMMENTED",
        );
        const requesterIntent = rows.find(({ payload }) =>
            payload.event === "REQUESTER_COMMENTED",
        );
        expect(operatorIntent?.payload).toMatchObject({
            recipientUserId: fixture.requester.userId,
            audience: "REQUESTER",
            source: { kind: "COMMENT", id: operatorComment.comment.id },
        });
        expect(requesterIntent?.payload).toMatchObject({
            recipientUserId: operatorA.userId,
            audience: "ASSIGNEE",
            source: { kind: "COMMENT", id: requesterComment.comment.id },
        });
        expect(operatorIntent?.row.payload).not.toContain(operatorBody);
        expect(operatorIntent?.row.payload).not.toContain("attachments");
        expect(requesterIntent?.row.payload).not.toContain(requesterBody);
        expect(requesterIntent?.row.payload).not.toContain("storageKey");
        expect(await prisma.iTTicketComment.count({
            where: { ticketId: created.ticket.id },
        })).toBe(2);
        expect(assigned.ticket.assignedToUserId).toBe(operatorA.userId);

        const unassignedTicket = await createTicket(fixture.requester, "queue-comment");
        await grantOperator(fixture.requester);
        const queueBody = "ข้อความขณะยังไม่มีผู้รับผิดชอบ";
        const queueKey = nextFixtureKey("queue-comment-key");
        const concurrentQueueComments = await Promise.all([
            postITRequesterTicketComment(
                fixture.requester.context,
                { ticketId: unassignedTicket.ticket.id, body: queueBody },
                { idempotencyKey: queueKey },
            ),
            postITRequesterTicketComment(
                fixture.requester.context,
                { ticketId: unassignedTicket.ticket.id, body: queueBody },
                { idempotencyKey: queueKey },
            ),
        ]);
        expect(new Set(concurrentQueueComments.map((result) =>
            result.comment.id,
        )).size).toBe(1);
        expect(concurrentQueueComments.filter((result) => !result.replayed)).toHaveLength(1);
        expect(await prisma.iTTicketComment.count({
            where: { ticketId: unassignedTicket.ticket.id },
        })).toBe(1);
        const queueIntents = (await getOutboxRows(unassignedTicket.ticket.id))
            .filter(({ payload }) => payload.event === "REQUESTER_COMMENTED");
        expect(queueIntents.map(({ payload }) => payload.recipientUserId).sort()).toEqual(
            [operatorA.userId, operatorB.userId, manager.userId].sort(),
        );
        expect(queueIntents.every(({ payload }) =>
            payload.audience === "OPERATOR_QUEUE"
            && payload.recipientUserId !== fixture.requester.userId,
        )).toBe(true);
        expect(queueIntents).toHaveLength(3);
    });

    it("only notifies on waiting/resolved, supersedes stale waiting, and routes requester Inbox actions", async () => {
        const fixture = await createTicketFixture("status-events");
        const operator = await createOperator(fixture, "status-operator");
        const created = await createTicket(fixture.requester, "status-events");
        const started = await transitionITTicketStatus(operator.context, {
            ticketId: created.ticket.id,
            expectedVersion: created.ticket.version,
            targetStatus: "IN_PROGRESS",
        });
        const waiting = await transitionITTicketStatus(operator.context, {
            ticketId: started.ticket.id,
            expectedVersion: started.ticket.version,
            targetStatus: "WAITING_REQUESTER",
        });
        const waitingRow = (await getOutboxRows(created.ticket.id))
            .find(({ payload }) => payload.event === "WAITING_REQUESTER");
        expect(waitingRow).toBeDefined();

        const resumed = await transitionITTicketStatus(operator.context, {
            ticketId: waiting.ticket.id,
            expectedVersion: waiting.ticket.version,
            targetStatus: "IN_PROGRESS",
        });
        await expect(dispatchITTicketNotificationOutbox(
            waitingRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");

        const resolved = await transitionITTicketStatus(operator.context, {
            ticketId: resumed.ticket.id,
            expectedVersion: resumed.ticket.version,
            targetStatus: "RESOLVED",
        });
        expect(resolved.ticket.status).toBe("RESOLVED");
        const rows = (await getOutboxRows(created.ticket.id))
            .filter(({ payload }) => payload.event !== "CREATED");
        expect(rows.map(({ payload }) => payload.event)).toEqual([
            "WAITING_REQUESTER",
            "RESOLVED",
        ]);
        const resolvedRow = rows.find(({ payload }) => payload.event === "RESOLVED");
        expect(resolvedRow).toBeDefined();
        await expect(dispatchITTicketNotificationOutbox(
            resolvedRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SENT");

        const inbox = await getTicketInbox(created.ticket.id, fixture.requester.userId);
        expect(inbox).toHaveLength(1);
        expect(inbox[0]?.actionUrl).toBe(`/dashboard/it/${created.ticket.id}`);
        expect(inbox[0]?.type).toBe("IT_TICKET");
        expect(inbox[0]?.title).toBe("คำขอ IT ได้รับการแก้ไขแล้ว");
        expect(inbox[0]?.message).not.toContain("รายละเอียดส่วนตัว");
    });

    it("deduplicates Inbox retries, routes queue actions, and suppresses stale or ineligible operators", async () => {
        const fixture = await createTicketFixture("dispatch-revalidation");
        const operatorA = await createOperator(fixture, "dispatch-a");
        const operatorB = await createOperator(fixture, "dispatch-b");
        const operatorC = await createOperator(fixture, "dispatch-c");
        const operatorD = await createOperator(fixture, "dispatch-d");
        const manager = await createOperator(fixture, "dispatch-manager");
        const created = await createTicket(fixture.requester, "dispatch-revalidation");
        const createdRows = (await getOutboxRows(created.ticket.id))
            .filter(({ payload }) => payload.event === "CREATED");
        const rowForA = createdRows.find(({ payload }) =>
            payload.recipientUserId === operatorA.userId,
        );
        expect(rowForA).toBeDefined();
        await expect(dispatchITTicketNotificationOutbox(
            rowForA?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SENT");
        await expect(dispatchITTicketNotificationOutbox(
            rowForA?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SENT");
        const operatorInbox = await getTicketInbox(created.ticket.id, operatorA.userId);
        expect(operatorInbox).toHaveLength(1);
        expect(operatorInbox[0]?.actionUrl).toBe(
            `/dashboard/it/queue/${created.ticket.id}`,
        );
        expect(operatorInbox[0]?.dedupeKey).toBe(rowForA?.row.eventKey);

        const assignment = await assignITTicket(manager.context, {
            ticketId: created.ticket.id,
            expectedVersion: created.ticket.version,
            assigneeUserId: operatorA.userId,
        });
        const assignmentRow = (await getOutboxRows(created.ticket.id)).find(
            ({ payload }) => payload.event === "ASSIGNED",
        );
        const reassignment = await assignITTicket(manager.context, {
            ticketId: created.ticket.id,
            expectedVersion: assignment.ticket.version,
            assigneeUserId: operatorB.userId,
        });
        expect(reassignment.ticket.assignedToUserId).toBe(operatorB.userId);
        await expect(dispatchITTicketNotificationOutbox(
            assignmentRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");

        await prisma.userCapabilityGrant.deleteMany({
            where: { userId: operatorB.userId },
        });
        const unauthorizedRow = createdRows.find(({ payload }) =>
            payload.recipientUserId === operatorB.userId,
        );
        await expect(dispatchITTicketNotificationOutbox(
            unauthorizedRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");

        await prisma.employee.update({
            where: { id: operatorC.employeeId },
            data: { status: "INACTIVE" },
        });
        const inactiveRow = createdRows.find(({ payload }) =>
            payload.recipientUserId === operatorC.userId,
        );
        await expect(dispatchITTicketNotificationOutbox(
            inactiveRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");

        await prisma.user.update({
            where: { id: operatorD.userId },
            data: { isActive: false, deletedAt: new Date() },
        });
        const deletedRow = createdRows.find(({ payload }) =>
            payload.recipientUserId === operatorD.userId,
        );
        await expect(dispatchITTicketNotificationOutbox(
            deletedRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");
    });

    it("supersedes an earlier assignment when the Ticket returns to the same assignee", async () => {
        const fixture = await createTicketFixture("assignment-generations");
        const operatorA = await createOperator(fixture, "assignment-generation-a");
        const operatorB = await createOperator(fixture, "assignment-generation-b");
        const manager = await createOperator(fixture, "assignment-generation-manager");
        const created = await createTicket(fixture.requester, "assignment-generations");

        const firstAssignment = await assignITTicket(manager.context, {
            ticketId: created.ticket.id,
            expectedVersion: created.ticket.version,
            assigneeUserId: operatorA.userId,
        });
        const firstARow = (await getOutboxRows(created.ticket.id)).find(
            ({ payload }) => payload.event === "ASSIGNED"
                && payload.recipientUserId === operatorA.userId,
        );
        expect(firstARow).toBeDefined();

        const assignmentB = await assignITTicket(manager.context, {
            ticketId: created.ticket.id,
            expectedVersion: firstAssignment.ticket.version,
            assigneeUserId: operatorB.userId,
        });
        const latestAssignmentA = await assignITTicket(manager.context, {
            ticketId: created.ticket.id,
            expectedVersion: assignmentB.ticket.version,
            assigneeUserId: operatorA.userId,
        });
        expect(latestAssignmentA.ticket.assignedToUserId).toBe(operatorA.userId);

        const assignmentARows = (await getOutboxRows(created.ticket.id)).filter(
            ({ payload }) => payload.event === "ASSIGNED"
                && payload.recipientUserId === operatorA.userId,
        );
        expect(assignmentARows).toHaveLength(2);
        const latestARow = assignmentARows[1];
        expect(latestARow?.row.eventKey).not.toBe(firstARow?.row.eventKey);

        await expect(dispatchITTicketNotificationOutbox(
            firstARow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");
        await expect(dispatchITTicketNotificationOutbox(
            latestARow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SENT");

        const inbox = await getTicketInbox(created.ticket.id, operatorA.userId);
        expect(inbox).toHaveLength(1);
        expect(inbox[0]?.dedupeKey).toBe(latestARow?.row.eventKey);
    });

    it("supersedes an earlier WAITING_REQUESTER generation after the status returns", async () => {
        const fixture = await createTicketFixture("waiting-generations");
        const operator = await createOperator(fixture, "waiting-generation-operator");
        const created = await createTicket(fixture.requester, "waiting-generations");
        const started = await transitionITTicketStatus(operator.context, {
            ticketId: created.ticket.id,
            expectedVersion: created.ticket.version,
            targetStatus: "IN_PROGRESS",
        });
        const firstWaiting = await transitionITTicketStatus(operator.context, {
            ticketId: started.ticket.id,
            expectedVersion: started.ticket.version,
            targetStatus: "WAITING_REQUESTER",
        });
        const firstWaitingRow = (await getOutboxRows(created.ticket.id)).find(
            ({ payload }) => payload.event === "WAITING_REQUESTER",
        );
        expect(firstWaitingRow).toBeDefined();

        const resumed = await transitionITTicketStatus(operator.context, {
            ticketId: firstWaiting.ticket.id,
            expectedVersion: firstWaiting.ticket.version,
            targetStatus: "IN_PROGRESS",
        });
        const secondWaiting = await transitionITTicketStatus(operator.context, {
            ticketId: resumed.ticket.id,
            expectedVersion: resumed.ticket.version,
            targetStatus: "WAITING_REQUESTER",
        });
        expect(secondWaiting.ticket.status).toBe("WAITING_REQUESTER");

        const waitingRows = (await getOutboxRows(created.ticket.id)).filter(
            ({ payload }) => payload.event === "WAITING_REQUESTER",
        );
        expect(waitingRows).toHaveLength(2);
        const latestWaitingRow = waitingRows[1];
        expect(latestWaitingRow?.row.eventKey).not.toBe(firstWaitingRow?.row.eventKey);

        await expect(dispatchITTicketNotificationOutbox(
            firstWaitingRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");
        await expect(dispatchITTicketNotificationOutbox(
            latestWaitingRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SENT");

        const inbox = await getTicketInbox(created.ticket.id, fixture.requester.userId);
        expect(inbox).toHaveLength(1);
        expect(inbox[0]?.dedupeKey).toBe(latestWaitingRow?.row.eventKey);
    });

    it("rolls back Ticket, assignment, status, comment, and idempotency facts when outbox persistence fails", async () => {
        const fixture = await createTicketFixture("outbox-rollback");
        const operator = await createOperator(fixture, "rollback-operator");
        const assignee = await createOperator(fixture, "rollback-assignee");
        const createKey = nextFixtureKey("rollback-create-key");
        const input = createTicketInput("outbox-rollback");

        await createOutboxFailureTrigger();
        try {
            await expect(createITTicket(
                fixture.requester.context,
                input,
                { idempotencyKey: createKey },
            )).rejects.toThrow();
        } finally {
            await dropOutboxFailureTrigger();
        }
        expect(await prisma.iTTicket.count({
            where: { requesterUserId: fixture.requester.userId },
        })).toBe(0);
        expect(await prisma.iTTicketEvent.count({
            where: { actorUserId: fixture.requester.userId },
        })).toBe(0);
        expect(await prisma.iTTicketCreateIdempotency.count({
            where: { requesterUserId: fixture.requester.userId },
        })).toBe(0);

        const created = await createTicket(fixture.requester, "outbox-rollback-base");
        await createOutboxFailureTrigger();
        try {
            await expect(assignITTicket(operator.context, {
                ticketId: created.ticket.id,
                expectedVersion: created.ticket.version,
                assigneeUserId: assignee.userId,
            })).rejects.toThrow();
        } finally {
            await dropOutboxFailureTrigger();
        }
        expect(await latestTicket(created.ticket.id)).toMatchObject({
            assignedToUserId: null,
            version: created.ticket.version,
        });
        expect(await prisma.iTTicketEvent.count({
            where: { ticketId: created.ticket.id, kind: "ASSIGNED" },
        })).toBe(0);

        const started = await transitionITTicketStatus(operator.context, {
            ticketId: created.ticket.id,
            expectedVersion: created.ticket.version,
            targetStatus: "IN_PROGRESS",
        });
        await createOutboxFailureTrigger();
        try {
            await expect(transitionITTicketStatus(operator.context, {
                ticketId: created.ticket.id,
                expectedVersion: started.ticket.version,
                targetStatus: "WAITING_REQUESTER",
            })).rejects.toThrow();
        } finally {
            await dropOutboxFailureTrigger();
        }
        expect(await latestTicket(created.ticket.id)).toMatchObject({
            status: "IN_PROGRESS",
            version: started.ticket.version,
        });
        expect(await prisma.iTTicketEvent.count({
            where: {
                ticketId: created.ticket.id,
                kind: "STATUS_CHANGED",
                toStatus: "WAITING_REQUESTER",
            },
        })).toBe(0);

        const commentKey = nextFixtureKey("rollback-comment-key");
        await createOutboxFailureTrigger();
        try {
            await expect(postITOperatorTicketComment(
                operator.context,
                { ticketId: created.ticket.id, body: "ข้อความที่ต้อง rollback" },
                { idempotencyKey: commentKey },
            )).rejects.toThrow();
        } finally {
            await dropOutboxFailureTrigger();
        }
        expect(await prisma.iTTicketComment.count({
            where: { ticketId: created.ticket.id },
        })).toBe(0);
        expect(await prisma.iTTicketCommentIdempotency.count({
            where: { authorUserId: operator.userId, idempotencyKey: commentKey },
        })).toBe(0);
        expect((await latestTicket(created.ticket.id)).firstRespondedAt).toBeNull();
    });
});

function failMissingOutboxRow(): never {
    throw new Error("Expected IT Ticket notification outbox row");
}
