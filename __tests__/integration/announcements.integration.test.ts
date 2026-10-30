import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Announcement } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import * as audit from "@/modules/audit";
import { getPublishedAnnouncement, mutateAnnouncement } from "@/modules/announcements";

const email = `announcement-${randomUUID()}@integration.test`;
let userId: number | undefined;
let secondUserId: number | undefined;
let snapshot: Announcement | null = null;

function admin(id = userId): { id: number; role: string; email: string; name: string } {
    if (id === undefined) throw new Error("Fixture not initialized");
    return { id, role: "ADMIN", email, name: "Announcement integration" };
}

function fixtureUserIds(): number[] {
    return [userId, secondUserId].filter((id): id is number => id !== undefined);
}

describe("Announcement MySQL persistence", () => {
    beforeAll(async () => {
        const rawUrl = process.env.DATABASE_URL;
        if (!rawUrl) throw new Error("DATABASE_URL is required");
        const url = new URL(rawUrl);
        if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(decodeURIComponent(url.pathname.slice(1)))) {
            throw new Error("Refusing to modify a database outside a dedicated integration/test database");
        }
        snapshot = await prisma.announcement.findUniqueOrThrow({ where: { id: 1 } });
        const user = await prisma.user.create({ data: { email, name: "Announcement integration", password: "test-only-unused", role: "ADMIN" } });
        userId = user.id;
        const second = await prisma.user.create({ data: { email: `second-${email}`, name: "Second admin", password: "test-only-unused", role: "ADMIN" } });
        secondUserId = second.id;
    });
    beforeEach(async () => {
        if (userId === undefined) return;
        await prisma.announcement.update({ where: { id: 1 }, data: {
            content: "", published: false, version: 0, authorId: null, updatedById: null,
        } });
        await prisma.auditLog.deleteMany({ where: { userId: { in: fixtureUserIds() }, entityType: "Announcement" } });
    });
    afterAll(async () => {
        vi.restoreAllMocks();
        if (snapshot) {
            const { id, ...data } = snapshot;
            await prisma.announcement.update({ where: { id }, data });
        }
        if (fixtureUserIds().length > 0) {
            await prisma.auditLog.deleteMany({ where: { userId: { in: fixtureUserIds() }, entityType: "Announcement" } });
            await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds() } } });
        }
        await prisma.$disconnect();
    });

    it("persists Unicode lifecycle and one audit per successful command", async () => {
        const draft = await mutateAnnouncement(admin(), { action: "save", content: "ฉบับร่าง NHF", version: 0 });
        expect(await getPublishedAnnouncement()).toBeNull();
        const published = await mutateAnnouncement(admin(), { action: "publish", content: "ข่าวองค์กร NHF", version: draft.version });
        expect(await getPublishedAnnouncement()).toEqual({ content: "ข่าวองค์กร NHF" });
        const updated = await mutateAnnouncement(admin(), { action: "publish", content: "ข่าวใหม่", version: published.version });
        expect(updated.authorId).toBe(admin().id); expect(updated.updatedById).toBe(admin().id);
        expect(updated.createdAt).toBe(draft.createdAt);
        await mutateAnnouncement(admin(), { action: "unpublish", version: updated.version });
        expect(await getPublishedAnnouncement()).toBeNull();
        expect(await prisma.auditLog.count({ where: { userId, entityType: "Announcement" } })).toBe(4);
    });

    it("serializes competing admins without silently overwriting newer content", async () => {
        const results = await Promise.allSettled([
            mutateAnnouncement(admin(), { action: "publish", content: "หนึ่ง", version: 0 }),
            mutateAnnouncement(admin(secondUserId), { action: "publish", content: "สอง", version: 0 }),
        ]);
        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        const rejected = results.find((r) => r.status === "rejected");
        expect(rejected).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
        expect(await prisma.announcement.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({ version: 1 });
        expect(await prisma.auditLog.count({ where: { userId: { in: fixtureUserIds() }, entityType: "Announcement" } })).toBe(1);
    });

    it("rolls back the announcement if audit persistence fails", async () => {
        const before = await prisma.announcement.findUniqueOrThrow({ where: { id: 1 } });
        const spy = vi.spyOn(audit, "appendAuditInTransaction").mockRejectedValueOnce(new Error("forced audit failure"));
        try {
            await expect(mutateAnnouncement(admin(), { action: "publish", content: "ต้องไม่ถูกบันทึก", version: 0 })).rejects.toThrow("forced audit failure");
            expect(await prisma.announcement.findUniqueOrThrow({ where: { id: 1 } })).toEqual(before);
        } finally { spy.mockRestore(); }
    });

    it("enforces the singleton and valid published content at database level", async () => {
        await expect(prisma.announcement.create({ data: { id: 2, content: "second" } })).rejects.toThrow();
        await expect(prisma.announcement.update({ where: { id: 1 }, data: { content: "", published: true } })).rejects.toThrow();
    });
});
