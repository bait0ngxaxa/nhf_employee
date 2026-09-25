import { createHash } from "node:crypto";

import { Role } from "@prisma/client";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    buildITAuthorizationContext,
    createITTicket,
    getITRequesterTicketTimeline,
    getITTicketAttachmentForDownload,
    ITTicketAttachmentValidationError,
    ITTicketCommentKind,
    ITTicketIdempotencyConflictError,
    ITTicketInputValidationError,
    ITTicketNotCommentableError,
    ITTicketNotFoundError,
    ITTicketStatus,
    postITOperatorTicketComment,
    postITRequesterTicketComment,
    transitionITTicketStatus,
} from "@/modules/it";
import type { ITAuthorizationContext, ITTicketAttachmentSource } from "@/modules/it";
import {
    deleteITTicketAttachmentFile,
    listITTicketAttachmentFiles,
    readITTicketAttachment,
} from "../../infrastructure/attachments/storage";

const TEST_PREFIX = "it5b-ticket-attachment";
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
    const tickets = await prisma.iTTicket.findMany({
        where: { requester: { email: { startsWith: `${TEST_PREFIX}-` } } },
        select: { id: true },
    });
    const ticketIds = tickets.map((ticket) => ticket.id);
    const attachments = await prisma.iTTicketAttachment.findMany({
        where: { ticketId: { in: ticketIds } },
        select: { storageKey: true },
    });
    await Promise.allSettled(attachments.map(({ storageKey }) =>
        deleteITTicketAttachmentFile(storageKey),
    ));
    if (ticketIds.length > 0) {
        const candidates = await listITTicketAttachmentFiles();
        const ticketSet = new Set(ticketIds);
        await Promise.allSettled(candidates
            .filter(({ storageKey }) => {
                const ticketId = Number(storageKey.split("/")[1]);
                return ticketSet.has(ticketId);
            })
            .map(({ storageKey }) => deleteITTicketAttachmentFile(storageKey)));
    }

    await prisma.iTTicketAttachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
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
    await prisma.iTTicketCategory.deleteMany({ where: { key: { startsWith: `${TEST_PREFIX}-` } } });
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
    await prisma.userCapabilityGrant.create({ data: { userId, capabilityKey, scope } });
}

async function createFixture(label: string, operatorGrants = true): Promise<Fixture> {
    const departmentId = await createDepartment(label);
    const requester = await createWorkforceUser(`${label}-requester`, departmentId);
    const operator = await createWorkforceUser(`${label}-operator`, departmentId);
    if (operatorGrants) {
        await grant(operator.userId, "it.ticket.read");
        await grant(operator.userId, "it.ticket.comment");
    }
    return { departmentId, requester, operator };
}

async function createTicket(requester: WorkforceUser, label: string) {
    return createITTicket(requester.context, {
        type: "INCIDENT",
        title: `Ticket ${label}`,
        description: `รายละเอียด ${label}`,
    }, { idempotencyKey: nextFixtureKey(`${label}-create`) });
}

async function imageSource(
    name: string,
    background: { readonly r: number; readonly g: number; readonly b: number },
    format: "jpeg" | "png" | "webp" = "png",
): Promise<ITTicketAttachmentSource> {
    const image = await sharp({
        create: { width: 32, height: 24, channels: 3, background },
    })[format]().toBuffer();
    const type = format === "jpeg" ? "image/jpeg" : `image/${format}`;
    return {
        name,
        type,
        size: image.byteLength,
        arrayBuffer: async () => Uint8Array.from(image).buffer,
    };
}

function sourceWithBytes(name: string, type: string, bytes: Buffer): ITTicketAttachmentSource {
    return {
        name,
        type,
        size: bytes.byteLength,
        arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    };
}

async function filesForTicket(ticketId: number): Promise<readonly string[]> {
    const candidates = await listITTicketAttachmentFiles();
    return candidates
        .filter((candidate) => candidate.storageKey.startsWith(`it/${ticketId}/`))
        .map((candidate) => candidate.storageKey);
}

describe.sequential("IT5B private Ticket attachments with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => cleanFixtures());

    afterAll(async () => {
        await cleanFixtures();
        await prisma.$disconnect();
    });

    it("stores requester images under their own comment with deterministic metadata and private bytes", async () => {
        const fixture = await createFixture("requester-upload");
        await grant(fixture.operator.userId, "it.ticket.manage");
        const ticket = await createTicket(fixture.requester, "requester-upload");
        await transitionITTicketStatus(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            targetStatus: ITTicketStatus.IN_PROGRESS,
            expectedVersion: 1,
        });
        await transitionITTicketStatus(fixture.operator.context, {
            ticketId: ticket.ticket.id,
            targetStatus: ITTicketStatus.WAITING_REQUESTER,
            expectedVersion: 2,
        });
        const imageOne = await imageSource("หลักฐานภาพ.jpg", { r: 20, g: 50, b: 90 }, "jpeg");
        const imageTwo = await imageSource("หน้าจอ.png", { r: 90, g: 50, b: 20 });
        const result = await postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "แนบภาพประกอบค่ะ" },
            { idempotencyKey: nextFixtureKey("requester-upload-comment"), attachments: [imageOne, imageTwo] },
        );

        expect(result.comment.attachments).toHaveLength(2);
        expect(result.comment.attachments.map((attachment) => attachment.position)).toEqual([0, 1]);
        expect(result.comment.attachments.map((attachment) => attachment.contentType)).toEqual([
            "image/webp", "image/webp",
        ]);
        expect(JSON.stringify(result)).not.toMatch(/storageKey|contentSha256|uploaderUserId/);

        const rows = await prisma.iTTicketAttachment.findMany({
            where: { commentId: result.comment.id },
            orderBy: { position: "asc" },
        });
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.position)).toEqual([0, 1]);
        expect(new Set(rows.map((row) => row.storageKey)).size).toBe(2);
        for (const [position, row] of rows.entries()) {
            expect(row).toMatchObject({
                ticketId: ticket.ticket.id,
                commentId: result.comment.id,
                uploaderUserId: fixture.requester.userId,
                position,
                contentType: "image/webp",
            });
            expect(row.contentSha256).toMatch(/^[a-f0-9]{64}$/);
            const stored = await readITTicketAttachment(row.storageKey, ticket.ticket.id);
            expect((await sharp(stored).metadata()).format).toBe("webp");
            expect(stored.byteLength).toBe(row.sizeBytes);
        }

        const timeline = await getITRequesterTicketTimeline(fixture.requester.context, ticket.ticket.id);
        expect(timeline.items.find((item) => item.type === "COMMENT")).toMatchObject({
            id: result.comment.id,
            attachments: result.comment.attachments,
        });
        await expect(prisma.iTTicket.findUniqueOrThrow({ where: { id: ticket.ticket.id } }))
            .resolves.toMatchObject({ status: ITTicketStatus.WAITING_REQUESTER, version: 3 });
        expect((await filesForTicket(ticket.ticket.id))).toHaveLength(2);
    });

    it("replays legacy body-only IT5A hashes without adding an empty attachment field", async () => {
        const fixture = await createFixture("legacy-body-replay");
        const ticket = await createTicket(fixture.requester, "legacy-body-replay");
        const body = "ข้อความจาก IT5A";
        const key = nextFixtureKey("legacy-idempotency");
        const legacyComment = await prisma.iTTicketComment.create({
            data: {
                ticketId: ticket.ticket.id,
                authorUserId: fixture.requester.userId,
                kind: ITTicketCommentKind.REQUESTER,
                body,
            },
            select: { id: true },
        });
        const requestHash = createHash("sha256").update(JSON.stringify({
            ticketId: ticket.ticket.id,
            authorSide: ITTicketCommentKind.REQUESTER,
            body,
        })).digest("hex");
        await prisma.iTTicketCommentIdempotency.create({
            data: {
                authorUserId: fixture.requester.userId,
                idempotencyKey: key,
                requestHash,
                commentId: legacyComment.id,
            },
        });

        const replay = await postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body },
            { idempotencyKey: key },
        );
        expect(replay).toMatchObject({
            replayed: true,
            comment: { id: legacyComment.id, attachments: [] },
        });
    });

    it("replays the same attachment request once and conflicts on content, count, order, or sanitized name", async () => {
        const fixture = await createFixture("attachment-idempotency");
        const ticket = await createTicket(fixture.requester, "attachment-idempotency");
        const key = nextFixtureKey("attachment-comment-key");
        const firstImage = await imageSource("หลักฐาน.png", { r: 10, g: 30, b: 60 });
        const secondImage = await imageSource("อีกภาพ.png", { r: 80, g: 40, b: 20 });
        const create = () => postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "แนบภาพค่ะ" },
            { idempotencyKey: key, attachments: [firstImage, secondImage] },
        );
        const first = await create();
        const replay = await create();
        expect(replay.replayed).toBe(true);
        expect(replay.comment.id).toBe(first.comment.id);
        expect(replay.comment.attachments).toEqual(first.comment.attachments);
        expect(await prisma.iTTicketComment.count({ where: { ticketId: ticket.ticket.id } })).toBe(1);
        expect(await prisma.iTTicketAttachment.count({ where: { commentId: first.comment.id } })).toBe(2);
        expect(await filesForTicket(ticket.ticket.id)).toHaveLength(2);

        const changedContent = await imageSource("หลักฐาน.png", { r: 40, g: 70, b: 100 });
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "แนบภาพค่ะ" },
            { idempotencyKey: key, attachments: [changedContent, secondImage] },
        )).rejects.toBeInstanceOf(ITTicketIdempotencyConflictError);
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "แนบภาพค่ะ" },
            { idempotencyKey: key, attachments: [firstImage] },
        )).rejects.toBeInstanceOf(ITTicketIdempotencyConflictError);
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "แนบภาพค่ะ" },
            { idempotencyKey: key, attachments: [secondImage, firstImage] },
        )).rejects.toBeInstanceOf(ITTicketIdempotencyConflictError);
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "ข้อความเปลี่ยน" },
            { idempotencyKey: key, attachments: [firstImage, secondImage] },
        )).rejects.toBeInstanceOf(ITTicketIdempotencyConflictError);
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "แนบภาพค่ะ" },
            {
                idempotencyKey: key,
                attachments: [sourceWithBytes("changed.png", firstImage.type, Buffer.from(await firstImage.arrayBuffer())), secondImage],
            },
        )).rejects.toBeInstanceOf(ITTicketIdempotencyConflictError);

        const otherTicket = await createTicket(fixture.requester, "attachment-idempotency-other-ticket");
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: otherTicket.ticket.id, body: "แนบภาพค่ะ" },
            { idempotencyKey: key, attachments: [firstImage, secondImage] },
        )).rejects.toBeInstanceOf(ITTicketIdempotencyConflictError);
        await grant(fixture.requester.userId, "it.ticket.read");
        await grant(fixture.requester.userId, "it.ticket.comment");
        await expect(postITOperatorTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "แนบภาพค่ะ" },
            { idempotencyKey: key, attachments: [firstImage, secondImage] },
        )).rejects.toBeInstanceOf(ITTicketIdempotencyConflictError);
        expect(await filesForTicket(ticket.ticket.id)).toHaveLength(2);
    });

    it("denies foreign, inactive, revoked, and terminal requester uploads before writing files", async () => {
        const fixture = await createFixture("requester-denied");
        const ownTicket = await createTicket(fixture.requester, "requester-own");
        const foreignRequester = await createWorkforceUser("foreign-requester", fixture.departmentId);
        const foreignTicket = await createTicket(foreignRequester, "requester-foreign");
        const proof = await imageSource("proof.png", { r: 1, g: 2, b: 3 });

        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: foreignTicket.ticket.id, body: "ข้อมูล" },
            { idempotencyKey: nextFixtureKey("foreign-upload"), attachments: [proof] },
        )).rejects.toBeInstanceOf(ITTicketNotFoundError);
        expect(await filesForTicket(foreignTicket.ticket.id)).toHaveLength(0);

        await grant(fixture.requester.userId, "it.ticket.read");
        await grant(fixture.requester.userId, "it.ticket.comment");
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: foreignTicket.ticket.id, body: "ALL ยังต้องเป็น requester endpoint" },
            { idempotencyKey: nextFixtureKey("foreign-all-upload"), attachments: [proof] },
        )).rejects.toBeInstanceOf(ITTicketNotFoundError);

        await prisma.iTTicket.update({ where: { id: ownTicket.ticket.id }, data: { status: ITTicketStatus.CLOSED } });
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ownTicket.ticket.id, body: "หลังปิดงาน" },
            { idempotencyKey: nextFixtureKey("terminal-upload"), attachments: [proof] },
        )).rejects.toBeInstanceOf(ITTicketNotCommentableError);
        expect(await filesForTicket(ownTicket.ticket.id)).toHaveLength(0);

        await prisma.employee.update({ where: { id: fixture.requester.employeeId }, data: { status: "INACTIVE" } });
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ownTicket.ticket.id, body: "พนักงาน inactive" },
            { idempotencyKey: nextFixtureKey("inactive-upload"), attachments: [proof] },
        )).rejects.toMatchObject({ code: "WORKFORCE_DENIED" });
        expect(await filesForTicket(ownTicket.ticket.id)).toHaveLength(0);
    });

    it("requires independent operator read and comment ALL upload authority", async () => {
        const fixture = await createFixture("operator-permissions");
        const ticket = await createTicket(fixture.requester, "operator-permissions");
        const proof = await imageSource("operator.png", { r: 20, g: 30, b: 40 });
        const readOnly = await createWorkforceUser("read-only", fixture.departmentId);
        await grant(readOnly.userId, "it.ticket.read");
        await expect(postITOperatorTicketComment(
            readOnly.context,
            { ticketId: ticket.ticket.id, body: "read only" },
            { idempotencyKey: nextFixtureKey("read-only"), attachments: [proof] },
        )).rejects.toMatchObject({ capability: "it.ticket.comment" });

        const commentOnly = await createWorkforceUser("comment-only", fixture.departmentId);
        await grant(commentOnly.userId, "it.ticket.comment");
        await expect(postITOperatorTicketComment(
            commentOnly.context,
            { ticketId: ticket.ticket.id, body: "comment only" },
            { idempotencyKey: nextFixtureKey("comment-only"), attachments: [proof] },
        )).rejects.toMatchObject({ capability: "it.ticket.read" });

        const manageOnly = await createWorkforceUser("manage-only", fixture.departmentId);
        await grant(manageOnly.userId, "it.ticket.manage");
        await expect(postITOperatorTicketComment(
            manageOnly.context,
            { ticketId: ticket.ticket.id, body: "manage only" },
            { idempotencyKey: nextFixtureKey("manage-only"), attachments: [proof] },
        )).rejects.toMatchObject({ capability: "it.ticket.read" });
        expect(await prisma.iTTicketAttachment.count({ where: { ticketId: ticket.ticket.id } })).toBe(0);

        const accepted = await postITOperatorTicketComment(
            fixture.operator.context,
            { ticketId: ticket.ticket.id, body: "ตอบพร้อมภาพ" },
            { idempotencyKey: nextFixtureKey("operator-upload"), attachments: [proof] },
        );
        expect(accepted.comment.attachments).toHaveLength(1);
        await prisma.userCapabilityGrant.delete({
            where: { userId_capabilityKey_scope: {
                userId: fixture.operator.userId,
                capabilityKey: "it.ticket.read",
                scope: "ALL",
            } },
        });
        await expect(getITTicketAttachmentForDownload(
            fixture.operator.context,
            accepted.comment.attachments[0]?.id,
        )).rejects.toBeInstanceOf(ITTicketNotFoundError);
    });

    it("authorizes requester downloads by own Ticket and operators by current read ALL", async () => {
        const fixture = await createFixture("download-boundary");
        const ownTicket = await createTicket(fixture.requester, "download-own");
        const ownImage = await imageSource("own.png", { r: 11, g: 22, b: 33 });
        const ownComment = await postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ownTicket.ticket.id, body: "ภาพของฉัน" },
            { idempotencyKey: nextFixtureKey("download-own"), attachments: [ownImage] },
        );
        const ownAttachmentId = ownComment.comment.attachments[0]?.id;
        expect(ownAttachmentId).toBeDefined();
        await expect(getITTicketAttachmentForDownload(
            fixture.requester.context,
            ownAttachmentId,
        )).resolves.toMatchObject({ ticketId: ownTicket.ticket.id, contentType: "image/webp" });

        const foreignRequester = await createWorkforceUser("download-foreign", fixture.departmentId);
        const foreignTicket = await createTicket(foreignRequester, "download-foreign");
        const foreignComment = await postITRequesterTicketComment(
            foreignRequester.context,
            { ticketId: foreignTicket.ticket.id, body: "ภาพคนอื่น" },
            { idempotencyKey: nextFixtureKey("download-foreign"), attachments: [ownImage] },
        );
        const foreignAttachmentId = foreignComment.comment.attachments[0]?.id;
        await expect(getITTicketAttachmentForDownload(
            fixture.requester.context,
            foreignAttachmentId,
        )).rejects.toBeInstanceOf(ITTicketNotFoundError);
        await expect(getITTicketAttachmentForDownload(
            fixture.requester.context,
            "f".repeat(32),
        )).rejects.toBeInstanceOf(ITTicketNotFoundError);

        const readerWithoutAll = await createWorkforceUser("reader-own-only", fixture.departmentId);
        await expect(getITTicketAttachmentForDownload(
            readerWithoutAll.context,
            foreignAttachmentId,
        )).rejects.toBeInstanceOf(ITTicketNotFoundError);

        const commentOnlyReader = await createWorkforceUser("comment-only-reader", fixture.departmentId);
        await grant(commentOnlyReader.userId, "it.ticket.comment");
        await expect(getITTicketAttachmentForDownload(
            commentOnlyReader.context,
            foreignAttachmentId,
        )).rejects.toBeInstanceOf(ITTicketNotFoundError);

        const manageOnlyReader = await createWorkforceUser("manage-only-reader", fixture.departmentId);
        await grant(manageOnlyReader.userId, "it.ticket.manage");
        await expect(getITTicketAttachmentForDownload(
            manageOnlyReader.context,
            foreignAttachmentId,
        )).rejects.toBeInstanceOf(ITTicketNotFoundError);
        await expect(getITTicketAttachmentForDownload(
            fixture.operator.context,
            foreignAttachmentId,
        )).resolves.toMatchObject({ ticketId: foreignTicket.ticket.id, contentType: "image/webp" });

        await prisma.employee.update({ where: { id: fixture.requester.employeeId }, data: { status: "INACTIVE" } });
        await expect(getITTicketAttachmentForDownload(
            fixture.requester.context,
            ownAttachmentId,
        )).rejects.toMatchObject({ code: "WORKFORCE_DENIED" });
    });

    it("keeps firstRespondedAt stable through same-key concurrent operator attachment posts", async () => {
        const fixture = await createFixture("attachment-race");
        const ticket = await createTicket(fixture.requester, "attachment-race");
        const proof = await imageSource("race.png", { r: 50, g: 60, b: 70 });
        const key = nextFixtureKey("same-key-attachment-race");
        const submit = () => postITOperatorTicketComment(
            fixture.operator.context,
            { ticketId: ticket.ticket.id, body: "ตอบกลับพร้อมหลักฐาน" },
            { idempotencyKey: key, attachments: [proof] },
        );
        const results = await Promise.all([submit(), submit()]);
        const firstResult = results[0];
        if (firstResult === undefined) throw new Error("Concurrent comment result is missing");
        expect(new Set(results.map((result) => result.comment.id)).size).toBe(1);
        expect(results.filter((result) => result.replayed)).toHaveLength(1);
        expect(results[0]?.comment.attachments).toHaveLength(1);
        expect(results[1]?.comment.attachments).toHaveLength(1);
        expect(await prisma.iTTicketComment.count({ where: { ticketId: ticket.ticket.id } })).toBe(1);
        expect(await prisma.iTTicketAttachment.count({ where: { ticketId: ticket.ticket.id } })).toBe(1);
        expect(await filesForTicket(ticket.ticket.id)).toHaveLength(1);
        const firstRespondedAt = (await prisma.iTTicket.findUniqueOrThrow({
            where: { id: ticket.ticket.id },
        })).firstRespondedAt;
        expect(firstRespondedAt).toEqual(new Date(firstResult.comment.createdAt));
        await submit();
        await expect(prisma.iTTicket.findUniqueOrThrow({ where: { id: ticket.ticket.id } }))
            .resolves.toMatchObject({ firstRespondedAt });
    });

    it("rejects inconsistent, duplicate-position, and restrictive history deletion", async () => {
        const fixture = await createFixture("attachment-integrity");
        const ticket = await createTicket(fixture.requester, "attachment-integrity");
        const proof = await imageSource("history.png", { r: 91, g: 82, b: 73 });
        const result = await postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "ประวัติพร้อมรูป" },
            { idempotencyKey: nextFixtureKey("attachment-history"), attachments: [proof] },
        );
        const stored = await prisma.iTTicketAttachment.findFirstOrThrow({
            where: { commentId: result.comment.id },
        });
        await expect(prisma.iTTicketAttachment.create({
            data: {
                id: "d".repeat(32),
                ticketId: ticket.ticket.id + 1,
                commentId: result.comment.id,
                uploaderUserId: fixture.requester.userId,
                position: 1,
                storageKey: `it/${ticket.ticket.id + 1}/${"e".repeat(32)}.webp`,
                originalName: "bad.webp",
                contentType: "image/webp",
                contentSha256: "f".repeat(64),
                sizeBytes: 100,
                width: 1,
                height: 1,
            },
        })).rejects.toMatchObject({ code: "P2003" });
        await expect(prisma.iTTicketAttachment.create({
            data: {
                id: "d".repeat(32),
                ticketId: stored.ticketId,
                commentId: stored.commentId,
                uploaderUserId: fixture.requester.userId,
                position: stored.position,
                storageKey: `it/${ticket.ticket.id}/${"e".repeat(32)}.webp`,
                originalName: "duplicate.webp",
                contentType: "image/webp",
                contentSha256: "f".repeat(64),
                sizeBytes: 100,
                width: 1,
                height: 1,
            },
        })).rejects.toMatchObject({ code: "P2002" });
        await expect(prisma.iTTicketComment.delete({ where: { id: result.comment.id } }))
            .rejects.toMatchObject({ code: "P2003" });
        await expect(prisma.user.delete({ where: { id: fixture.requester.userId } }))
            .rejects.toMatchObject({ code: "P2003" });
    });

    it("keeps the IT5A comment body required and enforces server image limits", async () => {
        const fixture = await createFixture("attachment-validation");
        const ticket = await createTicket(fixture.requester, "attachment-validation");
        const valid = await imageSource("valid.png", { r: 1, g: 2, b: 3 });
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "   " },
            { idempotencyKey: nextFixtureKey("missing-body"), attachments: [valid] },
        )).rejects.toBeInstanceOf(ITTicketInputValidationError);
        await expect(postITRequesterTicketComment(
            fixture.requester.context,
            { ticketId: ticket.ticket.id, body: "valid" },
            { idempotencyKey: nextFixtureKey("too-many"), attachments: [valid, valid, valid, valid] },
        )).rejects.toBeInstanceOf(ITTicketAttachmentValidationError);
        expect(await prisma.iTTicketComment.count({ where: { ticketId: ticket.ticket.id } })).toBe(0);
        expect(await filesForTicket(ticket.ticket.id)).toHaveLength(0);
    });
});
