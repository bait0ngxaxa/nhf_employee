import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Announcement } from "@prisma/client";

const mocks = vi.hoisted(() => ({
    session: vi.fn(), audit: vi.fn(), revalidate: vi.fn(),
    find: vi.fn(), update: vi.fn(), actor: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ getApiAuthSession: mocks.session }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
    announcement: { findUniqueOrThrow: mocks.find, updateMany: mocks.update },
    $transaction: mocks.transaction,
} }));
vi.mock("@/modules/audit", () => ({ appendAuditInTransaction: mocks.audit }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/db/row-locks", () => ({ lockUserRows: vi.fn().mockResolvedValue(undefined) }));

import { GET as read } from "@/app/api/announcements/route";
import { GET as manage, POST } from "@/app/api/announcements/manage/route";
import { mutateAnnouncement } from "@/modules/announcements";
import { resetMutationRateLimit } from "@/lib/security/mutation-rate-limit";

const admin = { id: 7, role: "ADMIN", email: "admin@example.com", name: "Admin" };
const tx = { user: { findUnique: mocks.actor }, announcement: { findUniqueOrThrow: mocks.find, updateMany: mocks.update } };
let row: Announcement;

function request(body: unknown, trusted = true): NextRequest {
    return new NextRequest("http://localhost/api/announcements/manage", {
        method: "POST", headers: trusted ? {
            origin: "http://localhost", "x-requested-with": "XMLHttpRequest", "content-type": "application/json",
        } : {}, body: JSON.stringify(body),
    });
}

function session(role: "ADMIN" | "USER" = "ADMIN"): void {
    mocks.session.mockResolvedValue({ user: { ...admin, id: String(admin.id), role } });
}

describe("Announcement authenticated lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks(); resetMutationRateLimit(); session();
        row = { id: 1, content: "", published: false, version: 0, authorId: null, updatedById: null,
            createdAt: new Date("2026-10-30T00:00:00Z"), updatedAt: new Date("2026-10-30T00:00:00Z") };
        mocks.find.mockImplementation(async () => ({ ...row }));
        mocks.actor.mockResolvedValue({ role: "ADMIN", isActive: true, deletedAt: null, email: admin.email });
        mocks.audit.mockResolvedValue(undefined);
        mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
        mocks.update.mockImplementation(async ({ where, data }: {
            where: { id: number; version: number };
            data: { content?: string; published: boolean; authorId?: number; updatedById: number };
        }) => {
            if (row.version !== where.version) return { count: 0 };
            row = { ...row, ...data, version: row.version + 1, updatedAt: new Date() };
            return { count: 1 };
        });
    });

    it("allows ADMIN to publish, edit and unpublish with transactional audit", async () => {
        expect((await POST(request({ action: "publish", content: "ประกาศ NHF", version: 0 }))).status).toBe(200);
        expect(await (await read()).json()).toEqual({ announcement: { content: "ประกาศ NHF" } });
        expect(row).toMatchObject({ authorId: 7, updatedById: 7, version: 1, published: true });
        expect((await POST(request({ action: "publish", content: "Updated ประกาศ", version: 1 }))).status).toBe(200);
        expect(row.content).toBe("Updated ประกาศ");
        expect((await POST(request({ action: "unpublish", version: 2 }))).status).toBe(200);
        expect(await (await read()).json()).toEqual({ announcement: null });
        expect(row).toMatchObject({ authorId: 7, version: 3, published: false });
        expect(mocks.audit).toHaveBeenCalledTimes(3);
        expect(mocks.audit).toHaveBeenLastCalledWith(tx, expect.objectContaining({ action: "ANNOUNCEMENT_UPDATE",
            userId: 7, details: expect.objectContaining({ metadata: { action: "unpublish" } }) }));
        expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard");
    });

    it("keeps drafts and inactive announcements out of employee reads", async () => {
        expect(await (await read()).json()).toEqual({ announcement: null });
        expect((await POST(request({ action: "save", content: "ฉบับร่าง", version: 0 }))).status).toBe(200);
        expect(await (await read()).json()).toEqual({ announcement: null });
        expect(await (await manage()).json()).toMatchObject({ announcement: { content: "ฉบับร่าง", published: false } });
    });

    it.each(["draft", "unpublished"])("rejects unpublish on an already inactive %s without writes or audit", async (state) => {
        row = { ...row, content: "ฉบับร่าง", version: 1, published: false };
        if (state === "unpublished") row.version = 3;
        const before = { ...row };
        expect((await POST(request({ action: "unpublish", version: row.version }))).status).toBe(400);
        expect(row).toEqual(before);
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.audit).not.toHaveBeenCalled();
        expect(mocks.revalidate).not.toHaveBeenCalled();
    });

    it.each(["ADMIN", "USER"] as const)("allows every active authenticated %s to read without Team or Department", async (role) => {
        row.content = "ข่าวสำหรับทุกคน"; row.published = true; session(role);
        const response = await read();
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(await response.json()).toEqual({ announcement: { content: row.content } });
    });

    it("rejects normal users including spoofed ADMIN JSON", async () => {
        session("USER");
        expect((await manage()).status).toBe(403);
        expect((await POST(request({ action: "publish", role: "ADMIN", content: "x", version: 0 }))).status).toBe(403);
        expect(mocks.transaction).not.toHaveBeenCalled();
        await expect(mutateAnnouncement({ ...admin, role: "USER" }, { action: "publish", content: "x", version: 0 }))
            .rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects missing or invalid active sessions", async () => {
        mocks.session.mockResolvedValue(null);
        expect((await read()).status).toBe(401);
        expect((await manage()).status).toBe(401);
        expect((await POST(request({ action: "publish", content: "x", version: 0 }))).status).toBe(401);
        expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each([
        { action: "publish", content: "", version: 0 },
        { action: "save", content: " \n\t ", version: 0 },
        { action: "publish", content: "ก".repeat(501), version: 0 },
        { action: "publish", content: 123, version: 0 },
        { action: "publish", content: "x", version: -1 },
        { action: "publish", content: "x", version: 0, role: "ADMIN" },
        { action: "publish", content: "a\u0000b", version: 0 },
        { action: "unpublish", version: 0 },
        {},
    ])("rejects invalid input %#", async (body) => {
        expect((await POST(request(body))).status).toBe(400);
        expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
    });

    it("accepts 500 Thai characters and stores markup only as plain text", async () => {
        expect((await POST(request({ action: "publish", content: "ก".repeat(500), version: 0 }))).status).toBe(200);
        const content = '<img src=x onerror="alert(1)"> ประกาศ';
        expect((await POST(request({ action: "publish", content, version: 1 }))).status).toBe(200);
        expect(await (await read()).json()).toEqual({ announcement: { content } });
    });

    it("does not silently overwrite a newer version, including retried requests", async () => {
        const input = { action: "publish", content: "ใหม่", version: 0 };
        expect((await POST(request(input))).status).toBe(200);
        expect((await POST(request(input))).status).toBe(409);
        expect(row).toMatchObject({ content: "ใหม่", version: 1 });
        expect(mocks.audit).toHaveBeenCalledTimes(1);
    });

    it("preserves original authorship instead of reassigning a deleted author", async () => {
        row = { ...row, content: "เดิม", version: 1, authorId: null };
        const createdAt = row.createdAt;
        expect((await POST(request({ action: "publish", content: "แก้ไข", version: 1 }))).status).toBe(200);
        expect(row.authorId).toBeNull(); expect(row.createdAt).toBe(createdAt);
        expect(row.updatedById).toBe(admin.id);
    });

    it("allows only one of two concurrent updates with the same version", async () => {
        const responses = await Promise.all([
            POST(request({ action: "publish", content: "หนึ่ง", version: 0 })),
            POST(request({ action: "publish", content: "สอง", version: 0 })),
        ]);
        expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(row.version).toBe(1); expect(mocks.audit).toHaveBeenCalledTimes(1);
    });

    it.each([
        { role: "USER", isActive: true, deletedAt: null },
        { role: "ADMIN", isActive: false, deletedAt: null },
        { role: "ADMIN", isActive: true, deletedAt: new Date() },
    ])("rechecks account state in the transaction %#", async (actor) => {
        mocks.actor.mockResolvedValue(actor);
        expect((await POST(request({ action: "publish", content: "x", version: 0 }))).status).toBe(403);
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it("rejects untrusted mutations, malformed JSON and oversized request bodies", async () => {
        expect((await POST(request({}, false))).status).toBe(403);
        const malformed = new NextRequest("http://localhost/api/announcements/manage", { method: "POST",
            headers: { origin: "http://localhost", "x-requested-with": "XMLHttpRequest" }, body: "{" });
        expect((await POST(malformed)).status).toBe(400);
        expect((await POST(request({ content: "a".repeat(9000) }))).status).toBe(413);
    });

    it("propagates audit failure through the transaction and returns a sanitized error", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.audit.mockRejectedValueOnce(new Error("private SQL failure"));
        const response = await POST(request({ action: "publish", content: "x", version: 0 }));
        expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain("private SQL");
        expect(mocks.revalidate).not.toHaveBeenCalled(); log.mockRestore();
    });
});
