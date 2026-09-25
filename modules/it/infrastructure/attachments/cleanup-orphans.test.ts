import { mkdtemp, mkdir, readFile, rm, symlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanupOrphanedITTicketAttachments } from "./cleanup-orphans";
import { IT_TICKET_ATTACHMENT_ORPHAN_SAFETY_WINDOW_MS } from "../../contracts";
import { createITTicketAttachmentStorage } from "./storage";
import type { PreparedITTicketAttachment } from "./validation";

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createRoot(): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), "it-attachment-cleanup-"));
    roots.push(root);
    return root;
}

const prepared: PreparedITTicketAttachment = {
    originalName: "proof.png",
    contentType: "image/webp",
    contentSha256: "a".repeat(64),
    sizeBytes: 4,
    width: 1,
    height: 1,
    data: Buffer.from("webp"),
};

describe("IT private attachment orphan cleanup", () => {
    it.skipIf(process.platform === "win32")("does not follow a ticket-directory symlink outside IT storage", async () => {
        const root = await createRoot();
        const outsideRoot = await createRoot();
        const outsideFile = path.join(outsideRoot, `${"c".repeat(32)}.webp`);
        await writeFile(outsideFile, "keep outside data");
        const oldDate = new Date("2020-01-01T00:00:00.000Z");
        await utimes(outsideFile, oldDate, oldDate);
        await mkdir(path.join(root, "it"), { recursive: true });
        await symlink(outsideRoot, path.join(root, "it", "15"), "dir");

        await expect(cleanupOrphanedITTicketAttachments({
            privateRoot: root,
            repository: { findMany: async () => [] },
            now: new Date("2026-09-25T12:00:00.000Z"),
        })).resolves.toMatchObject({ scannedCount: 0, deletedCount: 0 });
        await expect(readFile(outsideFile, "utf8")).resolves.toBe("keep outside data");
    });

    it("deletes only old unreferenced valid IT files and preserves recent, committed, malformed, and Leave files", async () => {
        const root = await createRoot();
        const storage = createITTicketAttachmentStorage(root);
        const [oldOrphan] = await storage.write(10, [prepared]);
        const [committed] = await storage.write(11, [prepared]);
        const [recent] = await storage.write(12, [prepared]);
        const now = new Date("2026-09-25T12:00:00.000Z");
        const oldDate = new Date(now.getTime() - IT_TICKET_ATTACHMENT_ORPHAN_SAFETY_WINDOW_MS - 1000);
        const recentDate = new Date(now.getTime() - IT_TICKET_ATTACHMENT_ORPHAN_SAFETY_WINDOW_MS + 1000);
        await utimes(path.join(root, oldOrphan.storageKey), oldDate, oldDate);
        await utimes(path.join(root, committed.storageKey), oldDate, oldDate);
        await utimes(path.join(root, recent.storageKey), recentDate, recentDate);

        const malformedDirectory = path.join(root, "it", "13");
        const leaveDirectory = path.join(root, "leave", "99");
        await Promise.all([mkdir(malformedDirectory), mkdir(leaveDirectory, { recursive: true })]);
        await Promise.all([
            writeFile(path.join(malformedDirectory, "not-a-key.webp"), "ignored"),
            writeFile(path.join(leaveDirectory, `${"b".repeat(32)}.webp`), "leave"),
        ]);

        const repository = {
            findMany: vi.fn().mockResolvedValue([{ storageKey: committed.storageKey }]),
        };
        const result = await cleanupOrphanedITTicketAttachments({
            privateRoot: root,
            repository,
            now,
        });

        expect(result).toEqual({
            scannedCount: 3,
            orphanCount: 2,
            deletedCount: 1,
            failedCount: 0,
            skippedRecentCount: 1,
            dryRun: false,
        });
        await expect(storage.read(oldOrphan.storageKey, 10)).rejects.toMatchObject({ code: "ENOENT" });
        await expect(storage.read(committed.storageKey, 11)).resolves.toEqual(prepared.data);
        await expect(storage.read(recent.storageKey, 12)).resolves.toEqual(prepared.data);
        expect(repository.findMany).toHaveBeenCalledWith({ select: { storageKey: true } });
    });

    it("dry-run reports counts without deleting, and a missing IT directory is harmless", async () => {
        const root = await createRoot();
        const storage = createITTicketAttachmentStorage(root);
        const [orphan] = await storage.write(14, [prepared]);
        const now = new Date("2026-09-25T12:00:00.000Z");
        const oldDate = new Date(now.getTime() - IT_TICKET_ATTACHMENT_ORPHAN_SAFETY_WINDOW_MS - 1000);
        await utimes(path.join(root, orphan.storageKey), oldDate, oldDate);

        await expect(cleanupOrphanedITTicketAttachments({
            privateRoot: root,
            repository: { findMany: async () => [] },
            now,
            dryRun: true,
        })).resolves.toMatchObject({ scannedCount: 1, orphanCount: 1, deletedCount: 0, dryRun: true });
        await expect(storage.read(orphan.storageKey, 14)).resolves.toEqual(prepared.data);

        const emptyRoot = await createRoot();
        await expect(cleanupOrphanedITTicketAttachments({
            privateRoot: emptyRoot,
            repository: { findMany: async () => [] },
            now,
        })).resolves.toMatchObject({ scannedCount: 0, orphanCount: 0, deletedCount: 0 });
    });
});
