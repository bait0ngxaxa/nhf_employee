import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db/prisma";
import { createEmailRequest, getEmailRequests, updateEmailRequestAccessRequirements } from "@/modules/it";
import { dispatchITEmailRequestOutbox } from "@/modules/it";

const prefix = "email-access-integration-";
const employee = { thaiName: "สมชาย ทดสอบ", englishName: "Somchai Test", phone: "081-2345678", nickname: "ชาย",
    position: "เจ้าหน้าที่", department: "มสช.", replyEmail: "reply@example.com" };

async function clean(): Promise<void> {
    const requests = await prisma.emailRequest.findMany({ where: { user: { email: { startsWith: prefix } } }, select: { id: true } });
    const ids = requests.map((row) => row.id);
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: prefix } } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "EmailRequest", entityId: { in: ids } } });
    await prisma.notificationOutbox.deleteMany({ where: { OR: ids.map((id) => ({ eventKey: { startsWith: `email-request:${id}:` } })) } });
    await prisma.emailRequestAccessChange.deleteMany({ where: { emailRequestId: { in: ids } } });
    await prisma.emailRequestIdempotency.deleteMany({ where: { emailRequestId: { in: ids } } });
    await prisma.emailRequest.deleteMany({ where: { id: { in: ids } } });
    await prisma.userCapabilityGrant.deleteMany({ where: { user: { email: { startsWith: prefix } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
}
async function user(label: string, scope?: "OWN" | "ALL") {
    const actor = await prisma.user.create({ data: { name: `ทดสอบ ${label}`, email: `${prefix}${label}@test.invalid`, password: "test-only", role: "USER" } });
    if (scope) await prisma.userCapabilityGrant.create({ data: { userId: actor.id, capabilityKey: "email.request.update", scope } });
    return actor;
}
async function request(actor: Awaited<ReturnType<typeof user>>) {
    const result = await createEmailRequest({ ...employee, documentSystemDecision: "UNDECIDED", sharedDriveDecision: "UNDECIDED", sharedDriveAccess: [] }, actor, { idempotencyKey: "create-key" });
    if (!result.emailRequest) throw new Error("Missing test request");
    return result.emailRequest;
}

describe.sequential("Employee Access Requirements with MySQL", () => {
    beforeAll(async () => {
        const url = new URL(process.env.DATABASE_URL ?? "");
        if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(decodeURIComponent(url.pathname.slice(1)))) throw new Error("Dedicated MySQL test database required");
        await prisma.$connect();
    });
    beforeEach(clean);
    afterAll(async () => { await clean(); await prisma.$disconnect(); });

    it("persists new defaults and real transition history, dedupes retries, and permits a later notification", async () => {
        const owner = await user("owner", "OWN");
        const itReader = await user("reader");
        await prisma.userCapabilityGrant.createMany({ data: [
            { userId: owner.id, capabilityKey: "email.request.read", scope: "OWN" },
            { userId: itReader.id, capabilityKey: "email.request.read", scope: "ALL" },
        ] });
        const row = await request(owner);
        expect(row).toMatchObject({ documentSystemDecision: "UNDECIDED", sharedDriveDecision: "UNDECIDED", accessVersion: 1 });
        const input = { documentSystemDecision: "REQUIRED", sharedDriveDecision: "REQUIRED", sharedDriveAccess: ["support", "it"], expectedAccessVersion: 1 };
        const changed = await updateEmailRequestAccessRequirements(row.id, input, owner);
        expect(changed.emailRequest).toMatchObject({ accessVersion: 2, needsDocumentSystem: true, sharedDriveAccess: ["it", "support"] });
        await expect(updateEmailRequestAccessRequirements(row.id, input, owner)).rejects.toMatchObject({ name: "EmailRequestAccessConflictError" });
        expect((await updateEmailRequestAccessRequirements(row.id, { ...input, expectedAccessVersion: 2 }, owner)).changed).toBe(false);
        const event = await prisma.notificationOutbox.findUniqueOrThrow({ where: { eventKey: `email-request:${row.id}:access:2` } });
        await dispatchITEmailRequestOutbox(event);
        await dispatchITEmailRequestOutbox(event);
        expect(await prisma.notification.count({ where: { userId: itReader.id } })).toBe(1);
        expect(await prisma.notification.count({ where: { userId: owner.id } })).toBe(0);
        expect(await prisma.notificationOutbox.count({ where: { eventKey: { startsWith: `email-request:${row.id}:access:2:` } } })).toBe(2);
        await updateEmailRequestAccessRequirements(row.id, { ...input, documentSystemDecision: "NOT_REQUIRED", sharedDriveAccess: ["it"], expectedAccessVersion: 2 }, owner);
        const later = await prisma.notificationOutbox.findUniqueOrThrow({ where: { eventKey: `email-request:${row.id}:access:3` } });
        await dispatchITEmailRequestOutbox(later);
        expect(await prisma.notification.count({ where: { userId: itReader.id } })).toBe(2);
        const history = await prisma.emailRequestAccessChange.findMany({ where: { emailRequestId: row.id }, orderBy: { accessVersion: "asc" } });
        expect(history).toHaveLength(2);
        expect(history[1]).toMatchObject({ actorId: owner.id, accessVersion: 3,
            before: { documentSystemDecision: "REQUIRED", sharedDriveAccess: ["it", "support"] },
            after: { documentSystemDecision: "NOT_REQUIRED", sharedDriveAccess: ["it"] } });
        expect(await prisma.auditLog.count({ where: { entityType: "EmailRequest", entityId: row.id } })).toBe(2);
    });

    it("one concurrent writer wins and the other receives conflict with one durable change", async () => {
        const owner = await user("race", "OWN");
        const row = await request(owner);
        const input = { documentSystemDecision: "REQUIRED", sharedDriveDecision: "UNDECIDED", sharedDriveAccess: [], expectedAccessVersion: 1 };
        const results = await Promise.allSettled([updateEmailRequestAccessRequirements(row.id, input, owner), updateEmailRequestAccessRequirements(row.id, { ...input, documentSystemDecision: "NOT_REQUIRED" }, owner)]);
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        const rejected = results.find((result) => result.status === "rejected");
        expect(rejected?.status === "rejected" ? rejected.reason : null).toMatchObject({ name: "EmailRequestAccessConflictError" });
        expect(await prisma.emailRequestAccessChange.count({ where: { emailRequestId: row.id } })).toBe(1);
        expect(await prisma.notificationOutbox.count({ where: { eventKey: `email-request:${row.id}:access:2` } })).toBe(1);
    });

    it("enforces ownership, ALL, absent grants and live grant removal", async () => {
        const owner = await user("authorization-owner", "OWN");
        const other = await user("other", "OWN");
        const operator = await user("operator", "ALL");
        const denied = await user("denied");
        const row = await request(owner);
        const input = { documentSystemDecision: "REQUIRED", sharedDriveDecision: "UNDECIDED", sharedDriveAccess: [], expectedAccessVersion: 1 };
        await expect(updateEmailRequestAccessRequirements(row.id, input, other)).rejects.toMatchObject({ statusCode: 403 });
        await expect(updateEmailRequestAccessRequirements(row.id, input, denied)).rejects.toMatchObject({ statusCode: 403 });
        expect((await updateEmailRequestAccessRequirements(row.id, input, operator)).changed).toBe(true);
        await prisma.userCapabilityGrant.deleteMany({ where: { userId: operator.id } });
        await expect(updateEmailRequestAccessRequirements(row.id, { ...input, expectedAccessVersion: 2 }, operator)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rolls back access and parent fact when immutable history cannot be appended", async () => {
        const owner = await user("rollback", "OWN");
        const row = await request(owner);
        await prisma.emailRequestAccessChange.create({ data: { emailRequestId: row.id, actorId: owner.id, accessVersion: 2, before: {}, after: {} } });
        await expect(updateEmailRequestAccessRequirements(row.id, { documentSystemDecision: "REQUIRED", sharedDriveDecision: "UNDECIDED", sharedDriveAccess: [], expectedAccessVersion: 1 }, owner)).rejects.toMatchObject({ code: "P2002" });
        expect(await prisma.emailRequest.findUnique({ where: { id: row.id } })).toMatchObject({ accessVersion: 1, documentSystemDecision: "UNDECIDED" });
        expect(await prisma.notificationOutbox.count({ where: { eventKey: `email-request:${row.id}:access:2` } })).toBe(0);
    });

    it("maps old-app NULL decision rows at the persistence boundary without calling them undecided", async () => {
        const owner = await user("legacy", "OWN");
        for (const needsDocumentSystem of [true, false]) for (const drives of [null, [], ["it"]]) {
            const row = await prisma.emailRequest.create({ data: { ...employee, requestedBy: owner.id, needsDocumentSystem,
                sharedDriveAccess: drives === null ? Prisma.DbNull : drives } });
            const list = await getEmailRequests({ page: 1, limit: 100 }, { userId: owner.id, scopes: ["OWN"] });
            expect(list.emailRequests.find((item) => item.id === row.id)).toMatchObject({
                documentSystemDecision: needsDocumentSystem ? "REQUIRED" : "NOT_REQUIRED",
                sharedDriveDecision: drives?.length ? "REQUIRED" : "NOT_REQUIRED", sharedDriveAccess: drives ?? [], accessVersion: 1,
            });
        }
    });

    it("executes the migration backfill SQL against historical true/false and null/empty/nonempty drives", async () => {
        const migration = readFileSync("prisma/migrations/20261001090000_email_request_access_requirements/migration.sql", "utf8");
        const backfill = migration.match(/UPDATE email_requests SET[\s\S]*?;/)?.[0];
        if (!backfill) throw new Error("Backfill statement missing");
        await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`CREATE TEMPORARY TABLE email_access_backfill_test (id INT PRIMARY KEY, needsDocumentSystem BOOLEAN, sharedDriveAccess JSON, documentSystemDecision VARCHAR(20) NULL, sharedDriveDecision VARCHAR(20) NULL)`;
            try {
                await tx.$executeRaw`INSERT INTO email_access_backfill_test (id, needsDocumentSystem, sharedDriveAccess) VALUES (1, true, '["it"]'), (2, false, '[]'), (3, false, NULL), (4, true, '[]')`;
                // Fixed migration text and fixed temporary-table name; no external input.
                await tx.$executeRawUnsafe(backfill.replace("UPDATE email_requests", "UPDATE email_access_backfill_test"));
                const rows = await tx.$queryRaw<{ id: number; documentSystemDecision: string; sharedDriveDecision: string }[]>`SELECT id, documentSystemDecision, sharedDriveDecision FROM email_access_backfill_test ORDER BY id`;
                expect(rows).toEqual([
                    { id: 1, documentSystemDecision: "REQUIRED", sharedDriveDecision: "REQUIRED" },
                    { id: 2, documentSystemDecision: "NOT_REQUIRED", sharedDriveDecision: "NOT_REQUIRED" },
                    { id: 3, documentSystemDecision: "NOT_REQUIRED", sharedDriveDecision: "NOT_REQUIRED" },
                    { id: 4, documentSystemDecision: "REQUIRED", sharedDriveDecision: "NOT_REQUIRED" },
                ]);
            } finally { await tx.$executeRaw`DROP TEMPORARY TABLE email_access_backfill_test`; }
        });
    });
});
