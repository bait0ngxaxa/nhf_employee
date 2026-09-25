import { Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    assignITTicket,
    buildITAuthorizationContext,
    createITTicket,
    getITOperatorTicketTimeline,
    getITRequesterTicketTimeline,
    ITCapabilityDeniedError,
    ITTicketCommentKind,
    ITTicketIdempotencyConflictError,
    ITTicketInputValidationError,
    ITTicketNotCommentableError,
    ITTicketNotFoundError,
    ITTicketStatus,
    postITOperatorTicketComment,
    postITRequesterTicketComment,
    setITTicketCategory,
    transitionITTicketStatus,
    IT_TICKET_COMMENT_MAX_LENGTH,
} from "@/modules/it";
import type { ITAuthorizationContext } from "@/modules/it";

const TEST_PREFIX = "it5a-ticket-conversation";
let fixtureSequence = 0;

interface WorkforceUser {
    readonly userId: number;
    readonly employeeId: number;
    readonly context: ITAuthorizationContext;
}

interface Fixture {
    readonly departmentId: number;
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

async function cleanFixtures(): Promise<void> {
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
    await prisma.iTTicketCategory.deleteMany({
        where: { key: { startsWith: `${TEST_PREFIX}-` } },
    });
    await prisma.userCapabilityGrant.deleteMany({
        where: { user: { email: { startsWith: `${TEST_PREFIX}-` } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: `${TEST_PREFIX}-` } } });
    await prisma.employee.deleteMany({ where: { email: { startsWith: `${TEST_PREFIX}-` } } });
    await prisma.department.deleteMany({ where: { code: { startsWith: `${TEST_PREFIX}-` } } });
}

async function createDepartment(label: string): Promise<number> {
    const key = nextFixtureKey(label);
    return (await prisma.department.create({
        data: { name: `${TEST_PREFIX} ${label} ${fixtureSequence}`, code: key },
        select: { id: true },
    })).id;
}

async function createWorkforceUser(
    label: string,
    departmentId: number,
    role: Role = Role.USER,
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
            role,
            employeeId: employee.id,
        },
        select: { id: true, role: true },
    });
    return {
        userId: user.id,
        employeeId: employee.id,
        context: buildITAuthorizationContext({ id: user.id, role: user.role }, employee.id),
    };
}

async function grant(userId: number, capabilityKey: string, scope = "ALL"): Promise<void> {
    await prisma.userCapabilityGrant.create({
        data: { userId, capabilityKey, scope },
    });
}

async function createFixture(label: string, manage = false): Promise<Fixture> {
    const departmentId = await createDepartment(label);
    const requester = await createWorkforceUser(`${label}-requester`, departmentId);
    const operator = await createWorkforceUser(`${label}-operator`, departmentId);
    await grant(operator.userId, "it.ticket.read");
    await grant(operator.userId, "it.ticket.comment");
    if (manage) await grant(operator.userId, "it.ticket.manage");
    return { departmentId, requester, operator };
}

async function createTicket(requester: WorkforceUser, label: string) {
    return createITTicket(requester.context, {
        type: "INCIDENT",
        title: `Ticket ${label}`,
        description: `รายละเอียด ${label}`,
    }, { idempotencyKey: nextFixtureKey(`${label}-create`) });
}

async function eventsFor(ticketId: number) {
    return prisma.iTTicketEvent.findMany({
        where: { ticketId },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
}

describe.sequential("IT5A Ticket conversation with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => cleanFixtures());

    afterAll(async () => {
        await cleanFixtures();
        await prisma.$disconnect();
    });

    it("stores requester/operator messages once, keeps shared event history, and sets first response only on operator reply", async () => {
        const fixture = await createFixture("shared-history");
        const created = await createTicket(fixture.requester, "shared-history");
        const firstBody = `ช่วยตรวจสอบข้อความ ${created.ticket.id} ค่ะ`;
        const noOutboxBefore = await prisma.notificationOutbox.count({
            where: { type: "TICKET_COMMENT_IN_APP" },
        });
        const noNotificationBefore = await prisma.notification.count({
            where: { type: "NEW_COMMENT", referenceId: String(created.ticket.id) },
        });

        const requesterComment = await postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: created.ticket.id, body: `  ${firstBody}  ` },
            { idempotencyKey: nextFixtureKey("requester-comment") },
        );
        expect(requesterComment.comment).toMatchObject({
            authorSide: ITTicketCommentKind.REQUESTER,
            body: firstBody,
        });
        await expect(prisma.iTTicket.findUniqueOrThrow({ where: { id: created.ticket.id } }))
            .resolves.toMatchObject({ firstRespondedAt: null, status: "OPEN", version: 1 });

        const firstOperatorKey = nextFixtureKey("operator-comment");
        const firstOperatorComment = await postITOperatorTicketComment(
            fixture.operator.context,
            { ticketId: created.ticket.id, body: "  กำลังตรวจสอบให้ค่ะ  " },
            { idempotencyKey: firstOperatorKey },
        );
        const firstRespondedAt = (await prisma.iTTicket.findUniqueOrThrow({
            where: { id: created.ticket.id },
        })).firstRespondedAt;
        expect(firstRespondedAt).toEqual(new Date(firstOperatorComment.comment.createdAt));

        await postITOperatorTicketComment(
            fixture.operator.context,
            { ticketId: created.ticket.id, body: "พบสาเหตุแล้วค่ะ" },
            { idempotencyKey: nextFixtureKey("second-operator-comment") },
        );
        const replay = await postITOperatorTicketComment(
            fixture.operator.context,
            { ticketId: created.ticket.id, body: "กำลังตรวจสอบให้ค่ะ" },
            { idempotencyKey: firstOperatorKey },
        );
        expect(replay.replayed).toBe(true);
        expect(replay.comment.id).toBe(firstOperatorComment.comment.id);
        await expect(prisma.iTTicket.findUniqueOrThrow({ where: { id: created.ticket.id } }))
            .resolves.toMatchObject({ firstRespondedAt });
        expect(await prisma.iTTicketComment.count({ where: { ticketId: created.ticket.id } })).toBe(3);
        expect(await prisma.iTTicketCommentIdempotency.count({
            where: { comment: { ticketId: created.ticket.id } },
        })).toBe(3);
        expect((await eventsFor(created.ticket.id)).map((event) => event.kind)).toEqual(["CREATED"]);

        const timeline = await getITRequesterTicketTimeline(fixture.requester.context, created.ticket.id);
        expect(timeline.items.map((item) => item.type)).toEqual([
            "CREATED", "COMMENT", "COMMENT", "COMMENT",
        ]);
        expect(timeline.items.filter((item) => item.type === "COMMENT")).toHaveLength(3);
        expect(await prisma.notificationOutbox.count({
            where: { type: "TICKET_COMMENT_IN_APP" },
        })).toBe(noOutboxBefore);
        expect(await prisma.notification.count({
            where: { type: "NEW_COMMENT", referenceId: String(created.ticket.id) },
        })).toBe(noNotificationBefore);
        expect(await prisma.auditLog.count({
            where: {
                entityType: "ITTicket",
                entityId: created.ticket.id,
                action: "TICKET_COMMENT",
            },
        })).toBe(0);
    });

    it("replays a same-key canonical request and conflicts on body, Ticket, or requester/operator semantics", async () => {
        const fixture = await createFixture("idempotency");
        const first = await createTicket(fixture.requester, "idempotency-a");
        const second = await createTicket(fixture.requester, "idempotency-b");
        const key = nextFixtureKey("comment-key");
        const body = "ข้อความเดิมค่ะ";
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: first.ticket.id, body },
            { idempotencyKey: " " },
        )).rejects.toBeInstanceOf(ITTicketInputValidationError);
        const created = await postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: first.ticket.id, body: ` ${body} ` },
            { idempotencyKey: key },
        );
        const replay = await postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: first.ticket.id, body },
            { idempotencyKey: key },
        );
        expect(replay).toMatchObject({ replayed: true, comment: { id: created.comment.id } });
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: first.ticket.id, body: "เนื้อหาใหม่" },
            { idempotencyKey: key },
        )).rejects.toBeInstanceOf(ITTicketIdempotencyConflictError);
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: second.ticket.id, body },
            { idempotencyKey: key },
        )).rejects.toBeInstanceOf(ITTicketIdempotencyConflictError);

        await grant(fixture.requester.userId, "it.ticket.read");
        await grant(fixture.requester.userId, "it.ticket.comment");
        await expect(postITOperatorTicketComment(
            fixture.requester.context,
            { ticketId: first.ticket.id, body },
            { idempotencyKey: key },
        )).rejects.toBeInstanceOf(ITTicketIdempotencyConflictError);

        expect(await prisma.iTTicketComment.count({ where: { ticketId: first.ticket.id } })).toBe(1);
        expect(await prisma.iTTicketComment.count({ where: { ticketId: second.ticket.id } })).toBe(0);
        expect((await getITRequesterTicketTimeline(fixture.requester.context, first.ticket.id))
            .items.filter((item) => item.type === "COMMENT")).toHaveLength(1);
    });

    it("serializes concurrent same-key requester submissions to one durable timeline item", async () => {
        const fixture = await createFixture("same-key-race");
        const ticket = await createTicket(fixture.requester, "same-key-race");
        const key = nextFixtureKey("same-comment-key");
        const input = { ticketId: ticket.ticket.id, body: "ข้อความเดียวกันค่ะ" };

        const results = await Promise.all([
            postITRequesterTicketComment(fixture.requester.context, input, { idempotencyKey: key }),
            postITRequesterTicketComment(fixture.requester.context, input, { idempotencyKey: key }),
        ]);

        expect(new Set(results.map((result) => result.comment.id)).size).toBe(1);
        expect(results.filter((result) => result.replayed)).toHaveLength(1);
        expect(await prisma.iTTicketComment.count({ where: { ticketId: ticket.ticket.id } })).toBe(1);
        expect(await prisma.iTTicketCommentIdempotency.count({
            where: { comment: { ticketId: ticket.ticket.id } },
        })).toBe(1);
        const timeline = await getITRequesterTicketTimeline(fixture.requester.context, ticket.ticket.id);
        expect(timeline.items.filter((item) => item.type === "COMMENT")).toHaveLength(1);
    });

    it("enforces requester ownership even with ALL authority and hides foreign/absent resource existence", async () => {
        const fixture = await createFixture("requester-boundary");
        const ownTicket = await createTicket(fixture.requester, "requester-own");
        const foreignRequester = await createWorkforceUser("foreign-requester", fixture.departmentId);
        const foreignTicket = await createTicket(foreignRequester, "requester-foreign");
        await grant(fixture.requester.userId, "it.ticket.read");
        await grant(fixture.requester.userId, "it.ticket.comment");

        await expect(getITRequesterTicketTimeline(fixture.requester.context, ownTicket.ticket.id))
            .resolves.toMatchObject({ items: [expect.objectContaining({ type: "CREATED" })] });
        await expect(getITRequesterTicketTimeline(fixture.requester.context, foreignTicket.ticket.id))
            .rejects.toBeInstanceOf(ITTicketNotFoundError);
        await expect(getITRequesterTicketTimeline(fixture.requester.context, 2_000_000_000))
            .rejects.toBeInstanceOf(ITTicketNotFoundError);
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: foreignTicket.ticket.id, body: "ข้อความ" },
            { idempotencyKey: nextFixtureKey("foreign-comment") },
        )).rejects.toBeInstanceOf(ITTicketNotFoundError);

        await prisma.employee.update({
            where: { id: fixture.requester.employeeId },
            data: { status: "INACTIVE" },
        });
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ownTicket.ticket.id, body: "พนักงานถูกปิดแล้ว" },
            { idempotencyKey: nextFixtureKey("inactive-requester-comment") },
        )).rejects.toMatchObject({ code: "WORKFORCE_DENIED" });
    });

    it("requires read ALL and comment ALL independently and rechecks current authority and workforce", async () => {
        const fixture = await createFixture("operator-boundary");
        const ticket = await createTicket(fixture.requester, "operator-boundary");
        const defaultOnly = await createWorkforceUser("default-only", fixture.departmentId, Role.ADMIN);
        await expect(getITOperatorTicketTimeline(defaultOnly.context, ticket.ticket.id))
            .rejects.toBeInstanceOf(ITCapabilityDeniedError);

        const readOnly = await createWorkforceUser("read-only", fixture.departmentId);
        await grant(readOnly.userId, "it.ticket.read");
        await expect(getITOperatorTicketTimeline(readOnly.context, ticket.ticket.id))
            .resolves.toMatchObject({ items: [expect.objectContaining({ type: "CREATED" })] });
        await expect(postITOperatorTicketComment(
            readOnly.context,
            { ticketId: ticket.ticket.id, body: "ไม่มีสิทธิ์ตอบ" },
            { idempotencyKey: nextFixtureKey("read-only-comment") },
        )).rejects.toMatchObject({ capability: "it.ticket.comment" });

        const commentOnly = await createWorkforceUser("comment-only", fixture.departmentId);
        await grant(commentOnly.userId, "it.ticket.comment");
        await expect(getITOperatorTicketTimeline(commentOnly.context, ticket.ticket.id))
            .rejects.toMatchObject({ capability: "it.ticket.read" });
        await expect(postITOperatorTicketComment(
            commentOnly.context,
            { ticketId: ticket.ticket.id, body: "ไม่มีสิทธิ์อ่านคิว" },
            { idempotencyKey: nextFixtureKey("comment-without-read") },
        )).rejects.toMatchObject({ capability: "it.ticket.read" });

        const manageOnly = await createWorkforceUser("manage-only", fixture.departmentId);
        await grant(manageOnly.userId, "it.ticket.read");
        await grant(manageOnly.userId, "it.ticket.manage");
        await expect(postITOperatorTicketComment(
            manageOnly.context,
            { ticketId: ticket.ticket.id, body: "มีแค่ manage" },
            { idempotencyKey: nextFixtureKey("manage-only-comment") },
        )).rejects.toMatchObject({ capability: "it.ticket.comment" });

        await prisma.userCapabilityGrant.delete({
            where: { userId_capabilityKey_scope: {
                userId: fixture.operator.userId,
                capabilityKey: "it.ticket.comment",
                scope: "ALL",
            } },
        });
        await expect(postITOperatorTicketComment(
            fixture.operator.context,
            { ticketId: ticket.ticket.id, body: "สิทธิ์ถูกถอนแล้ว" },
            { idempotencyKey: nextFixtureKey("revoked-comment") },
        )).rejects.toMatchObject({ capability: "it.ticket.comment" });
        expect(await prisma.iTTicketComment.count({ where: { ticketId: ticket.ticket.id } })).toBe(0);

        await grant(fixture.operator.userId, "it.ticket.comment");
        await prisma.employee.update({
            where: { id: fixture.operator.employeeId },
            data: { status: "INACTIVE" },
        });
        await expect(postITOperatorTicketComment(
            fixture.operator.context,
            { ticketId: ticket.ticket.id, body: "พนักงานถูกปิดแล้ว" },
            { idempotencyKey: nextFixtureKey("inactive-comment") },
        )).rejects.toMatchObject({ code: "WORKFORCE_DENIED" });
    });

    it("does not auto-resume WAITING_REQUESTER and rejects resolved or terminal comments", async () => {
        const fixture = await createFixture("commentable-states", true);
        const waiting = await createTicket(fixture.requester, "waiting-state");
        const inProgress = await transitionITTicketStatus(fixture.operator.context, {
            ticketId: waiting.ticket.id,
            targetStatus: ITTicketStatus.IN_PROGRESS,
            expectedVersion: 1,
        });
        await postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: waiting.ticket.id, body: "รายละเอียดเพิ่มเติมระหว่างดำเนินการค่ะ" },
            { idempotencyKey: nextFixtureKey("in-progress-reply") },
        );
        await transitionITTicketStatus(fixture.operator.context, {
            ticketId: waiting.ticket.id,
            targetStatus: ITTicketStatus.WAITING_REQUESTER,
            expectedVersion: inProgress.ticket.version,
        });
        const before = await prisma.iTTicket.findUniqueOrThrow({ where: { id: waiting.ticket.id } });
        await postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: waiting.ticket.id, body: "ส่งข้อมูลเพิ่มเติมค่ะ" },
            { idempotencyKey: nextFixtureKey("waiting-reply") },
        );
        await expect(prisma.iTTicket.findUniqueOrThrow({ where: { id: waiting.ticket.id } }))
            .resolves.toMatchObject({ status: "WAITING_REQUESTER", version: before.version });

        for (const status of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
            const ticket = await createTicket(fixture.requester, `closed-${status}`);
            await prisma.iTTicket.update({ where: { id: ticket.ticket.id }, data: { status } });
            await expect(postITRequesterTicketComment(
                fixture.requester.context,
                { ticketId: ticket.ticket.id, body: "ข้อความหลังปิดงาน" },
                { idempotencyKey: nextFixtureKey(`${status}-comment`) },
            )).rejects.toBeInstanceOf(ITTicketNotCommentableError);
            expect(await prisma.iTTicketComment.count({ where: { ticketId: ticket.ticket.id } })).toBe(0);
        }

        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: waiting.ticket.id, body: "x".repeat(IT_TICKET_COMMENT_MAX_LENGTH + 1) },
            { idempotencyKey: nextFixtureKey("oversized-comment") },
        )).rejects.toBeInstanceOf(ITTicketInputValidationError);
    });

    it("keeps first response null through workflow writes and stable across competing operator replies", async () => {
        const fixture = await createFixture("first-response", true);
        const ticket = await createTicket(fixture.requester, "first-response");
        await postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "เริ่มสนทนาค่ะ" },
            { idempotencyKey: nextFixtureKey("first-requester-comment") },
        );
        await expect(prisma.iTTicket.findUniqueOrThrow({ where: { id: ticket.ticket.id } }))
            .resolves.toMatchObject({ firstRespondedAt: null });

        const inProgress = await transitionITTicketStatus(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            targetStatus: ITTicketStatus.IN_PROGRESS,
            expectedVersion: 1,
        });
        await assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: fixture.operator.userId,
            expectedVersion: inProgress.ticket.version,
        });
        const category = await prisma.iTTicketCategory.create({
            data: { key: nextFixtureKey("category"), name: "ระบบเครือข่าย" },
            select: { id: true },
        });
        const current = await prisma.iTTicket.findUniqueOrThrow({ where: { id: ticket.ticket.id } });
        await setITTicketCategory(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            categoryId: category.id,
            expectedVersion: current.version,
        });
        await expect(prisma.iTTicket.findUniqueOrThrow({ where: { id: ticket.ticket.id } }))
            .resolves.toMatchObject({ firstRespondedAt: null });

        const results = await Promise.all([
            postITOperatorTicketComment(
                fixture.operator.context,
                { ticketId: ticket.ticket.id, body: "ตอบกลับหนึ่งค่ะ" },
                { idempotencyKey: nextFixtureKey("first-operator-one") },
            ),
            postITOperatorTicketComment(
                fixture.operator.context,
                { ticketId: ticket.ticket.id, body: "ตอบกลับสองค่ะ" },
                { idempotencyKey: nextFixtureKey("first-operator-two") },
            ),
        ]);
        const firstRespondedAt = (await prisma.iTTicket.findUniqueOrThrow({
            where: { id: ticket.ticket.id },
        })).firstRespondedAt;
        const operatorComments = await prisma.iTTicketComment.findMany({
            where: { ticketId: ticket.ticket.id, kind: ITTicketCommentKind.OPERATOR },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true, createdAt: true },
        });
        expect(results).toHaveLength(2);
        expect(firstRespondedAt).not.toBeNull();
        expect(operatorComments.map((comment) => comment.id)).toEqual(
            expect.arrayContaining(results.map((result) => result.comment.id)),
        );
        expect(operatorComments.some((comment) => comment.createdAt.getTime() === firstRespondedAt?.getTime()))
            .toBe(true);

        const savedFirstResponse = firstRespondedAt;
        await postITOperatorTicketComment(
            fixture.operator.context,
            { ticketId: ticket.ticket.id, body: "ตอบกลับสามค่ะ" },
            { idempotencyKey: nextFixtureKey("later-operator-comment") },
        );
        await expect(prisma.iTTicket.findUniqueOrThrow({ where: { id: ticket.ticket.id } }))
            .resolves.toMatchObject({ firstRespondedAt: savedFirstResponse });
    });

    it("paginates the merged timeline without skipping or duplicating equal-timestamp rows", async () => {
        const fixture = await createFixture("timeline-pagination");
        const ticket = await createTicket(fixture.requester, "timeline-pagination");
        for (let index = 0; index < 4; index += 1) {
            await postITRequesterTicketComment(
                fixture.requester.context,
                { ticketId: ticket.ticket.id, body: `ข้อความ ${index}` },
                { idempotencyKey: nextFixtureKey(`timeline-comment-${index}`) },
            );
        }
        const tiedAt = new Date("2026-09-01T12:00:00.000Z");
        await prisma.iTTicketEvent.updateMany({
            where: { ticketId: ticket.ticket.id },
            data: { occurredAt: tiedAt },
        });
        await prisma.iTTicketComment.updateMany({
            where: { ticketId: ticket.ticket.id },
            data: { createdAt: tiedAt },
        });

        const allItems: string[] = [];
        let cursor: string | undefined;
        let hasMore = true;
        while (hasMore) {
            const page = await getITRequesterTicketTimeline(fixture.requester.context, ticket.ticket.id, {
                limit: 2,
                ...(cursor === undefined ? {} : { cursor }),
            });
            allItems.unshift(...page.items.map((item) => `${item.type}:${item.id}`));
            cursor = page.olderCursor ?? undefined;
            hasMore = page.hasMore;
        }

        const eventIds = await prisma.iTTicketEvent.findMany({
            where: { ticketId: ticket.ticket.id },
            select: { id: true },
            orderBy: { id: "asc" },
        });
        const commentIds = await prisma.iTTicketComment.findMany({
            where: { ticketId: ticket.ticket.id },
            select: { id: true },
            orderBy: { id: "asc" },
        });
        const expected = [
            ...eventIds.map((event) => `CREATED:${event.id}`),
            ...commentIds.map((comment) => `COMMENT:${comment.id}`),
        ];
        expect(allItems).toEqual(expected);
        expect(new Set(allItems).size).toBe(expected.length);
    });

    it("renders every existing business event with names from retained current identities", async () => {
        const fixture = await createFixture("event-projection", true);
        const ticket = await createTicket(fixture.requester, "event-projection");
        const inProgress = await transitionITTicketStatus(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            targetStatus: ITTicketStatus.IN_PROGRESS,
            expectedVersion: 1,
        });
        const assigned = await assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: fixture.operator.userId,
            expectedVersion: inProgress.ticket.version,
        });
        const category = await prisma.iTTicketCategory.create({
            data: { key: nextFixtureKey("event-category"), name: "เครือข่าย" },
            select: { id: true },
        });
        const categorized = await setITTicketCategory(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            categoryId: category.id,
            expectedVersion: assigned.ticket.version,
        });
        await assignITTicket(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            assigneeUserId: null,
            expectedVersion: categorized.ticket.version,
        });
        await prisma.employee.update({
            where: { id: fixture.operator.employeeId },
            data: { status: "INACTIVE" },
        });

        const timeline = await getITRequesterTicketTimeline(fixture.requester.context, ticket.ticket.id);
        expect(timeline.items.map((item) => item.type)).toEqual([
            "CREATED", "STATUS_CHANGED", "ASSIGNED", "CATEGORY_CHANGED", "UNASSIGNED",
        ]);
        expect(timeline.items).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: "CREATED", actorDisplayName: "พนักงาน event-projection-requester" }),
            expect.objectContaining({
                type: "STATUS_CHANGED",
                fromStatus: "OPEN",
                toStatus: "IN_PROGRESS",
            }),
            expect.objectContaining({
                type: "ASSIGNED",
                fromAssigneeDisplayName: null,
                toAssigneeDisplayName: "พนักงาน event-projection-operator",
            }),
            expect.objectContaining({
                type: "CATEGORY_CHANGED",
                fromCategoryName: null,
                toCategoryName: "เครือข่าย",
            }),
            expect.objectContaining({
                type: "UNASSIGNED",
                fromAssigneeDisplayName: "พนักงาน event-projection-operator",
                toAssigneeDisplayName: null,
            }),
        ]));
        expect(JSON.stringify(timeline)).not.toContain("@integration.test");
        expect(JSON.stringify(timeline)).not.toContain("password");
    });

    it("rejects deletion of retained comments and their referenced users", async () => {
        const fixture = await createFixture("retention");
        const ticket = await createTicket(fixture.requester, "retention");
        const result = await postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "ประวัติต้องคงอยู่" },
            { idempotencyKey: nextFixtureKey("retained-comment") },
        );

        await expect(prisma.iTTicketComment.delete({ where: { id: result.comment.id } }))
            .rejects.toMatchObject({ code: "P2003" });
        await expect(prisma.user.delete({ where: { id: fixture.requester.userId } }))
            .rejects.toMatchObject({ code: "P2003" });
        await expect(prisma.iTTicketComment.findUniqueOrThrow({
            where: { id: result.comment.id },
        })).resolves.toMatchObject({ body: "ประวัติต้องคงอยู่" });
    });
});
