import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    createEmailRequest,
    EmailRequestIdempotencyConflictError,
    getEmailRequests,
    type CreateEmailRequestData,
} from "@/modules/it";

const TEST_EMAIL = "email-request-idempotency@integration.test";
const OTHER_TEST_EMAIL = "email-request-idempotency-other@integration.test";
const TEST_EMAILS = [TEST_EMAIL, OTHER_TEST_EMAIL];

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");
    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(databaseName)) {
        throw new Error("ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test");
    }
}

async function cleanEmailRequestFixtures(): Promise<void> {
    await prisma.emailRequestIdempotency.deleteMany({
        where: { user: { email: { in: TEST_EMAILS } } },
    });
    await prisma.emailRequest.deleteMany({
        where: { user: { email: { in: TEST_EMAILS } } },
    });
    await prisma.notificationOutbox.deleteMany({
        where: {
            type: "EMAIL_REQUEST",
            eventKey: { startsWith: "email-request:" },
        },
    });
    await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
}

const DATA: CreateEmailRequestData = {
    thaiName: "สมชาย ทดสอบ",
    englishName: "Somchai Integration",
    phone: "081-2345678",
    nickname: "ชาย",
    position: "เจ้าหน้าที่",
    department: "มสช.",
    replyEmail: "somchai@example.com",
    needsDocumentSystem: true,
    sharedDriveAccess: ["it", "account"],
};

async function createEmailRequestTestUser(email = TEST_EMAIL) {
    return prisma.user.create({
        data: {
            email,
            name: "Email Request Integration",
            password: "integration-test-only",
            role: "ADMIN",
        },
    });
}

describe.sequential("email request idempotency with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(cleanEmailRequestFixtures);

    afterAll(async () => {
        await cleanEmailRequestFixtures();
        await prisma.$disconnect();
    });

    it("persists a new request, scoped key, and EMAIL_REQUEST outbox event", async () => {
        const user = await createEmailRequestTestUser();
        const result = await createEmailRequest(DATA, user, {
            idempotencyKey: "first-create-key",
        });

        expect(result.replayed).toBe(false);
        expect(result.emailRequest).toMatchObject({
            id: expect.any(Number),
            requestedBy: user.id,
            thaiName: DATA.thaiName,
            phone: DATA.phone,
        });
        const emailRequestId = result.emailRequest?.id;
        expect(emailRequestId).toEqual(expect.any(Number));
        expect(await prisma.emailRequest.count({ where: { requestedBy: user.id } })).toBe(1);
        expect(await prisma.emailRequestIdempotency.count({
            where: { userId: user.id, idempotencyKey: "first-create-key" },
        })).toBe(1);
        const outbox = await prisma.notificationOutbox.findMany({
            where: { eventKey: `email-request:${emailRequestId}:created` },
            select: { id: true, type: true, eventKey: true },
        });
        expect(outbox).toEqual([{
            id: expect.any(Number),
            type: "EMAIL_REQUEST",
            eventKey: `email-request:${emailRequestId}:created`,
        }]);
    });

    it("replays the existing row and does not add idempotency or outbox rows", async () => {
        const user = await createEmailRequestTestUser();
        const actor = { id: user.id, email: user.email, role: user.role };
        const first = await createEmailRequest(DATA, actor, {
            idempotencyKey: "same-payload-key",
        });
        const replay = await createEmailRequest(DATA, actor, {
            idempotencyKey: "same-payload-key",
        });

        expect(first.replayed).toBe(false);
        expect(replay.replayed).toBe(true);
        expect(replay.emailRequest?.id).toBe(first.emailRequest?.id);
        expect(await prisma.emailRequest.count({ where: { requestedBy: user.id } })).toBe(1);
        expect(await prisma.emailRequestIdempotency.count({
            where: { userId: user.id, idempotencyKey: "same-payload-key" },
        })).toBe(1);
        expect(await prisma.notificationOutbox.count({
            where: { eventKey: `email-request:${first.emailRequest?.id}:created` },
        })).toBe(1);
    });

    it("rejects changed canonical payload for the same user and key without extra rows", async () => {
        const user = await createEmailRequestTestUser();
        const actor = { id: user.id, email: user.email, role: user.role };
        await createEmailRequest(DATA, actor, { idempotencyKey: "changed-payload-key" });

        await expect(createEmailRequest(
            { ...DATA, position: "ผู้จัดการ" },
            actor,
            { idempotencyKey: "changed-payload-key" },
        )).rejects.toBeInstanceOf(EmailRequestIdempotencyConflictError);

        expect(await prisma.emailRequest.count({ where: { requestedBy: user.id } })).toBe(1);
        expect(await prisma.emailRequestIdempotency.count({
            where: { userId: user.id, idempotencyKey: "changed-payload-key" },
        })).toBe(1);
        expect(await prisma.notificationOutbox.count({
            where: { type: "EMAIL_REQUEST" },
        })).toBe(1);
    });

    it("converges concurrent same-key calls on one committed request and outbox event", async () => {
        const user = await createEmailRequestTestUser();
        const actor = { id: user.id, email: user.email, role: user.role };

        const results = await Promise.all([
            createEmailRequest(DATA, actor, { idempotencyKey: "concurrent-key" }),
            createEmailRequest(DATA, actor, { idempotencyKey: "concurrent-key" }),
        ]);
        const requestIds = results.map((result) => result.emailRequest?.id);
        const emailRequestId = requestIds[0];

        expect(new Set(requestIds).size).toBe(1);
        expect(results.filter((result) => result.replayed)).toHaveLength(1);
        expect(await prisma.emailRequest.count({
            where: { requestedBy: user.id },
        })).toBe(1);
        expect(await prisma.emailRequestIdempotency.count({
            where: { userId: user.id, idempotencyKey: "concurrent-key" },
        })).toBe(1);
        expect(await prisma.notificationOutbox.count({
            where: { eventKey: `email-request:${emailRequestId}:created` },
        })).toBe(1);
    });

    it("applies OWN and ALL read scopes in the MySQL query", async () => {
        const owner = await createEmailRequestTestUser();
        const other = await createEmailRequestTestUser(OTHER_TEST_EMAIL);
        await createEmailRequest(DATA, owner, { idempotencyKey: "owner-query-key" });
        await createEmailRequest(DATA, other, { idempotencyKey: "other-query-key" });

        const ownResult = await getEmailRequests(
            { page: 1, limit: 10 },
            { userId: owner.id, scopes: ["OWN"] },
        );
        const allResult = await getEmailRequests(
            { page: 1, limit: 10 },
            { userId: owner.id, scopes: ["ALL"] },
        );

        expect(ownResult.emailRequests).toHaveLength(1);
        expect(ownResult.emailRequests[0]?.requestedBy).toBe(owner.id);
        expect(allResult.emailRequests).toHaveLength(2);
        expect(new Set(allResult.emailRequests.map((request) => request.requestedBy))).toEqual(
            new Set([owner.id, other.id]),
        );
    });
});
