import { Role } from "@prisma/client";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const lineTransport = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@/lib/line/app-notification", () => ({
    sendAppLineNotification: lineTransport.send,
}));

import { prisma } from "@/lib/db/prisma";
import {
    assignITTicket,
    buildITAuthorizationContext,
    createITTicket,
    dispatchITTicketNotificationOutbox,
    postITOperatorTicketComment,
    postITRequesterTicketComment,
    setITTicketPriority,
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
                type: { in: ["IT_TICKET_IN_APP", "IT_TICKET_EMAIL", "IT_TICKET_LINE"] },
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
    await prisma.auditLog.deleteMany({
        where: { user: { email: { startsWith: `${TEST_PREFIX}-` } } },
    });
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

async function getLineOutboxRows(ticketId: number): Promise<ParsedOutboxRow[]> {
    const rows = await prisma.notificationOutbox.findMany({
        where: {
            type: "IT_TICKET_LINE",
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

async function getTicketChannelOutboxIdentity(ticketId: number) {
    return prisma.notificationOutbox.findMany({
        where: {
            type: { in: ["IT_TICKET_IN_APP", "IT_TICKET_EMAIL", "IT_TICKET_LINE"] },
            eventKey: { startsWith: `it:ticket:${ticketId}:` },
        },
        select: { id: true, type: true, eventKey: true },
        orderBy: { id: "asc" },
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

describe.sequential("IT6/IT9D Ticket notifications with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-integration-liff-id");
        await prisma.$connect();
    });

    beforeEach(async () => {
        await cleanFixtures();
        vi.clearAllMocks();
        lineTransport.send.mockResolvedValue({ status: "SENT" });
    });

    afterAll(async () => {
        await cleanFixtures();
        vi.unstubAllEnvs();
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
        const emailRows = await prisma.notificationOutbox.findMany({
            where: {
                type: "IT_TICKET_EMAIL",
                eventKey: { startsWith: `it:ticket:${created.ticket.id}:` },
            },
        });
        const lineRows = await getLineOutboxRows(created.ticket.id);

        expect(created.replayed).toBe(false);
        expect(emailRows).toHaveLength(2);
        expect(lineRows).toHaveLength(2);
        expect(emailRows.map(({ payload }) => payload).sort()).toEqual(
            rows.map(({ row }) => row.payload).sort(),
        );
        expect(lineRows.map(({ row }) => row.payload).sort()).toEqual(
            rows.map(({ row }) => row.payload).sort(),
        );
        expect(lineTransport.send).not.toHaveBeenCalled();
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
        expect(await getLineOutboxRows(created.ticket.id)).toHaveLength(2);
        expect(lineTransport.send).not.toHaveBeenCalled();
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
        const assignmentLineRows = (await getLineOutboxRows(ticket.id))
            .filter(({ payload }) => payload.event === "ASSIGNED");
        expect(assignmentLineRows).toHaveLength(3);
        expect(assignmentLineRows.map(({ payload }) => payload.recipientUserId)).toEqual(
            assignmentRows.map(({ payload }) => payload.recipientUserId),
        );
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
        const lineRows = (await getLineOutboxRows(created.ticket.id)).filter(
            ({ payload }) => payload.event === "OPERATOR_COMMENTED"
                || payload.event === "REQUESTER_COMMENTED",
        );
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
        const operatorLineIntent = lineRows.find(({ payload }) =>
            payload.event === "OPERATOR_COMMENTED",
        );
        const requesterLineIntent = lineRows.find(({ payload }) =>
            payload.event === "REQUESTER_COMMENTED",
        );
        expect(operatorLineIntent?.payload).toEqual(operatorIntent?.payload);
        expect(operatorLineIntent?.row.payload).toBe(operatorIntent?.row.payload);
        expect(operatorLineIntent?.row.eventKey).toBe(
            `it:ticket:${created.ticket.id}:comment:${operatorComment.comment.id}:user:${fixture.requester.userId}:line`,
        );
        expect(operatorLineIntent?.row.eventKey).not.toBe(operatorIntent?.row.eventKey);
        expect(requesterLineIntent?.payload).toEqual(requesterIntent?.payload);
        expect(requesterLineIntent?.row.eventKey).toBe(
            `it:ticket:${created.ticket.id}:comment:${requesterComment.comment.id}:user:${operatorA.userId}:line`,
        );
        expect(lineRows.map(({ payload }) => payload.event)).toEqual([
            "OPERATOR_COMMENTED",
            "REQUESTER_COMMENTED",
        ]);
        expect(lineRows).toHaveLength(2);
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
        expect((await getLineOutboxRows(unassignedTicket.ticket.id)).filter(
            ({ payload }) => payload.event === "REQUESTER_COMMENTED",
        )).toHaveLength(3);
        expect(lineTransport.send).not.toHaveBeenCalled();
    });

    it("notifies only eligible operators for actual P1/P0 escalations and deduplicates delivery", async () => {
        const fixture = await createTicketFixture("priority-escalations");
        const actor = await createOperator(fixture, "priority-actor");
        const assignee = await createOperator(fixture, "priority-assignee");
        const peer = await createOperator(fixture, "priority-peer");
        const outsider = await createWorkforceUser("priority-outsider", fixture.departmentId);
        const created = await createTicket(fixture.requester, "priority-escalations");
        const assigned = await assignITTicket(actor.context, {
            ticketId: created.ticket.id,
            expectedVersion: created.ticket.version,
            assigneeUserId: assignee.userId,
        });
        const triaged = await setITTicketPriority(actor.context, {
            ticketId: created.ticket.id,
            priority: "P2",
            expectedVersion: assigned.ticket.version,
        });
        expect(triaged.changed).toBe(true);
        expect(await getOutboxRows(created.ticket.id).then((rows) =>
            rows.filter(({ payload }) => payload.event === "PRIORITY_ESCALATED"),
        )).toHaveLength(0);

        const p1 = await setITTicketPriority(actor.context, {
            ticketId: created.ticket.id,
            priority: "P1",
            reason: "กระทบบริการสำคัญหลายคน",
            expectedVersion: triaged.ticket.version,
        });
        const p1Rows = (await getOutboxRows(created.ticket.id)).filter(
            ({ payload }) => payload.event === "PRIORITY_ESCALATED" && payload.priority === "P1",
        );
        expect(p1Rows.map(({ payload }) => payload.recipientUserId)).toEqual([assignee.userId]);
        expect(p1Rows[0]?.payload.audience).toBe("ASSIGNEE");
        expect(p1.notificationIntentsEnqueued).toBe(true);
        const p1InApp = p1Rows[0];
        if (!p1InApp) throw new Error("Expected P1 escalation Inbox intent");
        // Deduplicated delivery while the P1 alert is still the current generation.
        await expect(dispatchITTicketNotificationOutbox(p1InApp.row)).resolves.toBe("SENT");
        await expect(dispatchITTicketNotificationOutbox(p1InApp.row)).resolves.toBe("SENT");
        expect(await prisma.notification.count({
            where: { userId: assignee.userId, dedupeKey: p1InApp.row.eventKey },
        })).toBe(1);

        const p0 = await setITTicketPriority(actor.context, {
            ticketId: created.ticket.id,
            priority: "P0",
            reason: "เกิดเหตุขัดข้องระดับองค์กร",
            expectedVersion: p1.ticket.version,
        });
        const p0Rows = (await getOutboxRows(created.ticket.id)).filter(
            ({ payload }) => payload.event === "PRIORITY_ESCALATED" && payload.priority === "P0",
        );
        expect(p0Rows.map(({ payload }) => payload.recipientUserId).sort())
            .toEqual([assignee.userId, peer.userId].sort());
        expect(p0Rows.every(({ payload }) => payload.audience === "OPERATOR_QUEUE"))
            .toBe(true);
        expect(p0Rows.some(({ payload }) => payload.recipientUserId === actor.userId
            || payload.recipientUserId === outsider.userId)).toBe(false);

        const noOpP0 = await setITTicketPriority(actor.context, {
            ticketId: created.ticket.id,
            priority: "P0",
            expectedVersion: p0.ticket.version,
        });
        const downgrade = await setITTicketPriority(actor.context, {
            ticketId: created.ticket.id,
            priority: "P1",
            reason: "ลด Priority หลังสถานการณ์คลี่คลาย",
            expectedVersion: noOpP0.ticket.version,
        });
        const noOpP1 = await setITTicketPriority(actor.context, {
            ticketId: created.ticket.id,
            priority: "P1",
            expectedVersion: downgrade.ticket.version,
        });
        expect(noOpP0.changed).toBe(false);
        expect(downgrade.changed).toBe(true);
        expect(noOpP1.changed).toBe(false);
        expect(noOpP0.notificationIntentsEnqueued).toBeUndefined();
        expect(downgrade.notificationIntentsEnqueued).toBe(false);

        const allEscalations = (await getOutboxRows(created.ticket.id)).filter(
            ({ payload }) => payload.event === "PRIORITY_ESCALATED",
        );
        expect(allEscalations).toHaveLength(3);
        // P1 -> P0 -> P1 created newer priority generations, so neither earlier
        // alert is current any more; a retry cannot resend them.
        await expect(dispatchITTicketNotificationOutbox(p1InApp.row)).resolves.toBe("SUPERSEDED");
        for (const { row } of p0Rows) {
            await expect(dispatchITTicketNotificationOutbox(row)).resolves.toBe("SUPERSEDED");
        }

        const channelRows = await getTicketChannelOutboxIdentity(created.ticket.id);
        const sourceIds = new Set(allEscalations.map(({ payload }) =>
            payload.source.kind === "EVENT" ? payload.source.id : -1,
        ));
        const escalationChannelRows = channelRows.filter(({ eventKey }) =>
            eventKey !== null
                && [...sourceIds].some((sourceId) => eventKey.includes(`:event:${sourceId}:`)),
        );
        expect(escalationChannelRows).toHaveLength(9);
        expect(new Set(escalationChannelRows.map(({ eventKey }) => eventKey)).size)
            .toBe(escalationChannelRows.length);

        const unassignedTicket = await createTicket(
            fixture.requester,
            "priority-p1-unassigned",
        );
        await setITTicketPriority(actor.context, {
            ticketId: unassignedTicket.ticket.id,
            priority: "P1",
            reason: "มีผลกระทบหลายผู้ใช้และยังไม่มีผู้รับผิดชอบ",
            expectedVersion: unassignedTicket.ticket.version,
        });
        const unassignedP1Rows = (await getOutboxRows(unassignedTicket.ticket.id)).filter(
            ({ payload }) => payload.event === "PRIORITY_ESCALATED",
        );
        expect(unassignedP1Rows.map(({ payload }) => payload.recipientUserId).sort())
            .toEqual([assignee.userId, peer.userId].sort());
        expect(unassignedP1Rows.every(({ payload }) => payload.audience === "OPERATOR_QUEUE"))
            .toBe(true);
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
        const waitingLineRow = (await getLineOutboxRows(created.ticket.id))
            .find(({ payload }) => payload.event === "WAITING_REQUESTER");
        expect(waitingRow).toBeDefined();
        expect(waitingLineRow?.payload).toEqual(waitingRow?.payload);

        const resumed = await transitionITTicketStatus(operator.context, {
            ticketId: waiting.ticket.id,
            expectedVersion: waiting.ticket.version,
            targetStatus: "IN_PROGRESS",
        });
        await expect(dispatchITTicketNotificationOutbox(
            waitingRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");
        await expect(dispatchITTicketNotificationOutbox(
            waitingLineRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");
        expect(lineTransport.send).not.toHaveBeenCalled();

        const resolved = await transitionITTicketStatus(operator.context, {
            ticketId: resumed.ticket.id,
            expectedVersion: resumed.ticket.version,
            targetStatus: "RESOLVED",
        });
        expect(resolved.ticket.status).toBe("RESOLVED");
        const rows = (await getOutboxRows(created.ticket.id))
            .filter(({ payload }) => payload.event !== "CREATED");
        const resolvedLineRow = (await getLineOutboxRows(created.ticket.id))
            .find(({ payload }) => payload.event === "RESOLVED");
        expect(rows.map(({ payload }) => payload.event)).toEqual([
            "WAITING_REQUESTER",
            "RESOLVED",
        ]);
        const resolvedRow = rows.find(({ payload }) => payload.event === "RESOLVED");
        expect(resolvedRow).toBeDefined();
        expect(resolvedLineRow?.payload).toEqual(resolvedRow?.payload);
        expect(lineTransport.send).not.toHaveBeenCalled();
        await expect(dispatchITTicketNotificationOutbox(
            resolvedRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SENT");
        await expect(dispatchITTicketNotificationOutbox(
            resolvedLineRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SENT");
        expect(lineTransport.send).toHaveBeenCalledOnce();
        expect(lineTransport.send).toHaveBeenCalledWith(expect.objectContaining({
            userId: fixture.requester.userId,
            message: expect.objectContaining({ type: "flex" }),
        }));

        const inbox = await getTicketInbox(created.ticket.id, fixture.requester.userId);
        expect(inbox).toHaveLength(1);
        expect(inbox[0]?.actionUrl).toBe(`/dashboard/it/${created.ticket.id}`);
        expect(inbox[0]?.type).toBe("IT_TICKET");
        expect(inbox[0]?.title).toBe("Ticket IT ได้รับการแก้ไขแล้ว");
        expect(inbox[0]?.message).not.toContain("รายละเอียดส่วนตัว");
    });

    it("does not notify cancellation and supersedes a pending waiting delivery", async () => {
        const fixture = await createTicketFixture("cancel-status");
        const operator = await createOperator(fixture, "cancel-status-operator");
        const created = await createTicket(fixture.requester, "cancel-status");
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
        const waitingLineRow = (await getLineOutboxRows(created.ticket.id))
            .find(({ payload }) => payload.event === "WAITING_REQUESTER");

        const cancelled = await transitionITTicketStatus(operator.context, {
            ticketId: waiting.ticket.id,
            expectedVersion: waiting.ticket.version,
            targetStatus: "CANCELLED",
        });
        expect(cancelled.ticket.status).toBe("CANCELLED");
        expect((await getOutboxRows(created.ticket.id))
            .filter(({ payload }) => payload.event !== "CREATED")
            .map(({ payload }) => payload.event)).toEqual(["WAITING_REQUESTER"]);
        expect((await getLineOutboxRows(created.ticket.id))
            .filter(({ payload }) => payload.event !== "CREATED")
            .map(({ payload }) => payload.event)).toEqual(["WAITING_REQUESTER"]);

        await expect(dispatchITTicketNotificationOutbox(
            waitingRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");
        await expect(dispatchITTicketNotificationOutbox(
            waitingLineRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");
        expect(lineTransport.send).not.toHaveBeenCalled();
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
        const firstWaitingLineRow = (await getLineOutboxRows(created.ticket.id)).find(
            ({ payload }) => payload.event === "WAITING_REQUESTER",
        );
        expect(firstWaitingRow).toBeDefined();
        expect(firstWaitingLineRow?.payload).toEqual(firstWaitingRow?.payload);

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
        const waitingLineRows = (await getLineOutboxRows(created.ticket.id)).filter(
            ({ payload }) => payload.event === "WAITING_REQUESTER",
        );
        expect(waitingRows).toHaveLength(2);
        expect(waitingLineRows).toHaveLength(2);
        const latestWaitingRow = waitingRows[1];
        const latestWaitingLineRow = waitingLineRows[1];
        expect(latestWaitingRow?.row.eventKey).not.toBe(firstWaitingRow?.row.eventKey);
        expect(latestWaitingLineRow?.row.eventKey).not.toBe(
            firstWaitingLineRow?.row.eventKey,
        );

        await expect(dispatchITTicketNotificationOutbox(
            firstWaitingRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");
        await expect(dispatchITTicketNotificationOutbox(
            firstWaitingLineRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SUPERSEDED");
        await expect(dispatchITTicketNotificationOutbox(
            latestWaitingRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SENT");
        await expect(dispatchITTicketNotificationOutbox(
            latestWaitingLineRow?.row ?? failMissingOutboxRow(),
        )).resolves.toBe("SENT");
        expect(lineTransport.send).toHaveBeenCalledOnce();

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
        const initialChannelRows = await getTicketChannelOutboxIdentity(
            created.ticket.id,
        );
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

        await createOutboxFailureTrigger();
        try {
            await expect(setITTicketPriority(operator.context, {
                ticketId: created.ticket.id,
                priority: "P1",
                reason: "ต้อง rollback เมื่อ outbox เขียนไม่ได้",
                expectedVersion: started.ticket.version,
            })).rejects.toThrow();
        } finally {
            await dropOutboxFailureTrigger();
        }
        expect(await latestTicket(created.ticket.id)).toMatchObject({
            priority: "P2",
            triagedAt: null,
            version: started.ticket.version,
        });
        expect(await prisma.iTTicketEvent.count({
            where: { ticketId: created.ticket.id, kind: "PRIORITY_CHANGED" },
        })).toBe(0);
        expect(await prisma.auditLog.count({
            where: {
                entityType: "ITTicket",
                entityId: created.ticket.id,
                action: "TICKET_UPDATE",
            },
        })).toBe(0);
        expect(await getTicketChannelOutboxIdentity(created.ticket.id))
            .toEqual(initialChannelRows);
    });

    it("falls back to the eligible queue when a P1 assignee is inactive or loses operator grants", async () => {
        const fixture = await createTicketFixture("priority-fallback");
        const actor = await createOperator(fixture, "fallback-actor");
        const inactiveAssignee = await createOperator(fixture, "fallback-inactive");
        const revokedAssignee = await createOperator(fixture, "fallback-revoked");
        const peer = await createOperator(fixture, "fallback-peer");

        const inactiveTicket = await createTicket(fixture.requester, "fallback-inactive");
        const assignedInactive = await assignITTicket(actor.context, {
            ticketId: inactiveTicket.ticket.id,
            expectedVersion: inactiveTicket.ticket.version,
            assigneeUserId: inactiveAssignee.userId,
        });
        const revokedTicket = await createTicket(fixture.requester, "fallback-revoked");
        const assignedRevoked = await assignITTicket(actor.context, {
            ticketId: revokedTicket.ticket.id,
            expectedVersion: revokedTicket.ticket.version,
            assigneeUserId: revokedAssignee.userId,
        });
        await prisma.user.update({
            where: { id: inactiveAssignee.userId },
            data: { isActive: false },
        });
        await prisma.userCapabilityGrant.deleteMany({
            where: { userId: revokedAssignee.userId, capabilityKey: "it.ticket.manage" },
        });

        const cases = [
            { created: inactiveTicket, version: assignedInactive.ticket.version, assignee: inactiveAssignee.userId },
            { created: revokedTicket, version: assignedRevoked.ticket.version, assignee: revokedAssignee.userId },
        ];
        for (const { created, version, assignee } of cases) {
            const escalated = await setITTicketPriority(actor.context, {
                ticketId: created.ticket.id,
                priority: "P1",
                reason: "ผู้รับผิดชอบเดิมไม่สามารถรับงานได้",
                expectedVersion: version,
            });
            expect(escalated.notificationIntentsEnqueued).toBe(true);
            expect(escalated.ticket.assignedToUserId).toBe(assignee);
            const rows = (await getOutboxRows(created.ticket.id)).filter(
                ({ payload }) => payload.event === "PRIORITY_ESCALATED",
            );
            expect(rows.map(({ payload }) => payload.recipientUserId)).toEqual([peer.userId]);
            expect(rows.every(({ payload }) => payload.audience === "OPERATOR_QUEUE")).toBe(true);
            const queueRow = rows[0] ?? failMissingOutboxRow();
            await expect(dispatchITTicketNotificationOutbox(queueRow.row)).resolves.toBe("SENT");
        }
    });

    it("commits an escalation without intents when no eligible recipient remains", async () => {
        const fixture = await createTicketFixture("priority-no-recipient");
        const actor = await createOperator(fixture, "no-recipient-actor");
        const created = await createTicket(fixture.requester, "priority-no-recipient");
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        try {
            const escalated = await setITTicketPriority(actor.context, {
                ticketId: created.ticket.id,
                priority: "P0",
                reason: "ระบบหลักล่ม",
                expectedVersion: created.ticket.version,
            });
            expect(escalated.changed).toBe(true);
            expect(escalated.notificationIntentsEnqueued).toBe(false);
            expect(warn).toHaveBeenCalledWith(
                "IT Ticket priority escalation has no eligible recipient",
                { ticketId: created.ticket.id, priority: "P0", audience: "OPERATOR_QUEUE" },
            );
        } finally {
            warn.mockRestore();
        }
        expect((await latestTicket(created.ticket.id)).priority).toBe("P0");
        expect(await prisma.iTTicketEvent.count({
            where: { ticketId: created.ticket.id, kind: "PRIORITY_CHANGED" },
        })).toBe(1);
        expect(await prisma.auditLog.count({
            where: { entityType: "ITTicket", entityId: created.ticket.id, action: "TICKET_UPDATE" },
        })).toBe(1);
        expect((await getOutboxRows(created.ticket.id)).filter(
            ({ payload }) => payload.event === "PRIORITY_ESCALATED",
        )).toHaveLength(0);
    });

    it("supersedes escalation alerts that are stale by priority generation, lifecycle, or recipient", async () => {
        const fixture = await createTicketFixture("priority-stale");
        const actor = await createOperator(fixture, "stale-actor");
        const peer = await createOperator(fixture, "stale-peer");
        const reason = "ปรับระดับตามสถานการณ์";

        const escalationRowsFor = (ticketId: number, sourceEventId: number) =>
            prisma.notificationOutbox.findMany({
                where: {
                    type: { in: ["IT_TICKET_IN_APP", "IT_TICKET_EMAIL", "IT_TICKET_LINE"] },
                    eventKey: { startsWith: `it:ticket:${ticketId}:event:${sourceEventId}:` },
                },
                orderBy: { id: "asc" },
            });
        const latestPriorityEventId = async (ticketId: number): Promise<number> =>
            (await prisma.iTTicketEvent.findFirstOrThrow({
                where: { ticketId, kind: "PRIORITY_CHANGED" },
                orderBy: { id: "desc" },
                select: { id: true },
            })).id;
        const changePriority = async (
            ticketId: number,
            version: number,
            priority: "P0" | "P1" | "P2" | "P3",
        ): Promise<{ readonly version: number; readonly eventId: number }> => {
            const result = await setITTicketPriority(actor.context, {
                ticketId, priority, reason, expectedVersion: version,
            });
            return { version: result.ticket.version, eventId: await latestPriorityEventId(ticketId) };
        };
        const expectRows = async (
            ticketId: number,
            eventId: number,
            outcome: "SENT" | "SUPERSEDED",
        ): Promise<void> => {
            const rows = await escalationRowsFor(ticketId, eventId);
            expect(rows.map(({ type }) => type).sort())
                .toEqual(["IT_TICKET_EMAIL", "IT_TICKET_IN_APP", "IT_TICKET_LINE"]);
            for (const row of rows) {
                // A valid Email row would use real SMTP; it shares the validation
                // path exercised here by Inbox and LINE.
                if (outcome === "SENT" && row.type === "IT_TICKET_EMAIL") continue;
                await expect(dispatchITTicketNotificationOutbox(row), row.type).resolves.toBe(outcome);
            }
        };

        // P2 -> P0 -> P2
        const a = await createTicket(fixture.requester, "stale-p0-p2");
        const a1 = await changePriority(a.ticket.id, a.ticket.version, "P0");
        await changePriority(a.ticket.id, a1.version, "P2");
        await expectRows(a.ticket.id, a1.eventId, "SUPERSEDED");

        // P2 -> P1 -> P3
        const b = await createTicket(fixture.requester, "stale-p1-p3");
        const b1 = await changePriority(b.ticket.id, b.ticket.version, "P1");
        await changePriority(b.ticket.id, b1.version, "P3");
        await expectRows(b.ticket.id, b1.eventId, "SUPERSEDED");

        // P2 -> P1 -> P0
        const c = await createTicket(fixture.requester, "stale-p1-p0");
        const c1 = await changePriority(c.ticket.id, c.ticket.version, "P1");
        const c2 = await changePriority(c.ticket.id, c1.version, "P0");
        await expectRows(c.ticket.id, c1.eventId, "SUPERSEDED");
        await expectRows(c.ticket.id, c2.eventId, "SENT");

        // P2 -> P0 -> P1: the downgrade creates no alert and supersedes P0.
        const d = await createTicket(fixture.requester, "stale-p0-p1");
        const d1 = await changePriority(d.ticket.id, d.ticket.version, "P0");
        const d2 = await changePriority(d.ticket.id, d1.version, "P1");
        expect(await escalationRowsFor(d.ticket.id, d2.eventId)).toHaveLength(0);
        await expectRows(d.ticket.id, d1.eventId, "SUPERSEDED");

        // P2 -> P1 -> P2 -> P1: same priority value, newer durable generation.
        const e = await createTicket(fixture.requester, "stale-p1-repeat");
        const e1 = await changePriority(e.ticket.id, e.ticket.version, "P1");
        const e2 = await changePriority(e.ticket.id, e1.version, "P2");
        const e3 = await changePriority(e.ticket.id, e2.version, "P1");
        await expectRows(e.ticket.id, e1.eventId, "SUPERSEDED");
        await expectRows(e.ticket.id, e3.eventId, "SENT");
        expect(await prisma.iTTicketEvent.findMany({
            where: { ticketId: e.ticket.id, kind: "PRIORITY_CHANGED" },
            orderBy: { id: "asc" },
            select: { fromPriority: true, toPriority: true },
        })).toEqual([
            { fromPriority: "P2", toPriority: "P1" },
            { fromPriority: "P1", toPriority: "P2" },
            { fromPriority: "P2", toPriority: "P1" },
        ]);

        // P0 escalation followed by closure.
        const f = await createTicket(fixture.requester, "stale-closed");
        const f1 = await changePriority(f.ticket.id, f.ticket.version, "P0");
        let fVersion = f1.version;
        for (const targetStatus of ["IN_PROGRESS", "RESOLVED", "CLOSED"] as const) {
            fVersion = (await transitionITTicketStatus(actor.context, {
                ticketId: f.ticket.id, expectedVersion: fVersion, targetStatus,
            })).ticket.version;
        }
        await expectRows(f.ticket.id, f1.eventId, "SUPERSEDED");
        expect(await getTicketInbox(f.ticket.id, peer.userId)).toHaveLength(0);

        // Escalating a RESOLVED Ticket is not active work and enqueues nothing.
        const g = await createTicket(fixture.requester, "resolved-escalation");
        let gVersion = g.ticket.version;
        for (const targetStatus of ["IN_PROGRESS", "RESOLVED"] as const) {
            gVersion = (await transitionITTicketStatus(actor.context, {
                ticketId: g.ticket.id, expectedVersion: gVersion, targetStatus,
            })).ticket.version;
        }
        const resolvedEscalation = await setITTicketPriority(actor.context, {
            ticketId: g.ticket.id, priority: "P0", reason, expectedVersion: gVersion,
        });
        expect(resolvedEscalation.changed).toBe(true);
        expect(resolvedEscalation.notificationIntentsEnqueued).toBe(false);
        expect(await escalationRowsFor(g.ticket.id, await latestPriorityEventId(g.ticket.id)))
            .toHaveLength(0);

        // A valid unchanged alert whose recipient loses authority before dispatch.
        const h = await createTicket(fixture.requester, "stale-recipient");
        const h1 = await changePriority(h.ticket.id, h.ticket.version, "P0");
        await prisma.userCapabilityGrant.deleteMany({
            where: { userId: peer.userId, capabilityKey: "it.ticket.read" },
        });
        await expectRows(h.ticket.id, h1.eventId, "SUPERSEDED");

        // Only the two still-current alerts (c2, e3) reached the LINE transport.
        expect(lineTransport.send).toHaveBeenCalledTimes(2);
        expect(await getTicketInbox(c.ticket.id, peer.userId)).toHaveLength(1);
        expect(await getTicketInbox(e.ticket.id, peer.userId)).toHaveLength(1);
    });
});

function failMissingOutboxRow(): never {
    throw new Error("Expected IT Ticket notification outbox row");
}
