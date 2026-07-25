import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { cleanupOrphanedLeaveAttachments } from "@/lib/services/leave/cleanup-orphans";

const STORED_KEY =
    "leave/request-1/0123456789abcdef0123456789abcdef.webp";
const OLD_ORPHAN_KEY =
    "leave/request-1/fedcba9876543210fedcba9876543210.webp";
const RECENT_ORPHAN_KEY =
    "leave/request-1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp";

const tempDirectories: string[] = [];

async function createStorageRoot(): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "leave-cleanup-"));
    tempDirectories.push(directory);
    return directory;
}

async function writeStorageFile(root: string, storageKey: string): Promise<string> {
    const filePath = path.join(root, "leave", storageKey.split("/")[1] ?? "");
    await mkdir(filePath, { recursive: true });
    const target = path.join(filePath, storageKey.split("/")[2] ?? "");
    await writeFile(target, "webp");
    return target;
}

afterEach(async () => {
    await Promise.all(
        tempDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

describe("cleanupOrphanedLeaveAttachments", () => {
    it("supports dry-run and keeps files inside the safety window", async () => {
        const root = await createStorageRoot();
        const storedPath = await writeStorageFile(root, STORED_KEY);
        const oldOrphanPath = await writeStorageFile(root, OLD_ORPHAN_KEY);
        const recentOrphanPath = await writeStorageFile(root, RECENT_ORPHAN_KEY);
        const now = new Date("2035-01-02T00:00:00.000Z");
        await utimes(oldOrphanPath, new Date("2034-12-31T00:00:00.000Z"), new Date("2034-12-31T00:00:00.000Z"));
        await utimes(recentOrphanPath, new Date("2035-01-01T12:00:00.000Z"), new Date("2035-01-01T12:00:00.000Z"));

        const result = await cleanupOrphanedLeaveAttachments({
            rootDirectory: root,
            repository: {
                findMany: async () => [{ storageKey: STORED_KEY }],
            },
            now,
            safetyWindowMs: 24 * 60 * 60 * 1000,
            dryRun: true,
        });

        expect(result).toMatchObject({
            scannedCount: 3,
            orphanCount: 2,
            deletedCount: 0,
            skippedRecentCount: 1,
            dryRun: true,
        });
        await expect(stat(storedPath)).resolves.toBeTruthy();
        await expect(stat(oldOrphanPath)).resolves.toBeTruthy();
        await expect(stat(recentOrphanPath)).resolves.toBeTruthy();
    });

    it("deletes only old orphan files and never uses arbitrary paths", async () => {
        const root = await createStorageRoot();
        const oldOrphanPath = await writeStorageFile(root, OLD_ORPHAN_KEY);
        const recentOrphanPath = await writeStorageFile(root, RECENT_ORPHAN_KEY);
        const invalidDirectory = path.join(root, "leave", "..", "outside");
        await mkdir(invalidDirectory, { recursive: true });
        await writeFile(path.join(invalidDirectory, "not-an-attachment"), "safe");
        await utimes(oldOrphanPath, new Date("2034-12-31T00:00:00.000Z"), new Date("2034-12-31T00:00:00.000Z"));
        await utimes(recentOrphanPath, new Date("2035-01-01T12:00:00.000Z"), new Date("2035-01-01T12:00:00.000Z"));

        const result = await cleanupOrphanedLeaveAttachments({
            rootDirectory: root,
            repository: { findMany: async () => [] },
            now: new Date("2035-01-02T00:00:00.000Z"),
            safetyWindowMs: 24 * 60 * 60 * 1000,
        });

        expect(result).toMatchObject({
            scannedCount: 2,
            orphanCount: 2,
            deletedCount: 1,
            skippedRecentCount: 1,
            failedCount: 0,
        });
        await expect(stat(oldOrphanPath)).rejects.toMatchObject({ code: "ENOENT" });
        await expect(stat(recentOrphanPath)).resolves.toBeTruthy();
    });

    it("is safe when the private leave directory does not exist", async () => {
        const root = await createStorageRoot();
        await expect(
            cleanupOrphanedLeaveAttachments({
                rootDirectory: root,
                repository: { findMany: async () => [] },
            }),
        ).resolves.toMatchObject({
            scannedCount: 0,
            orphanCount: 0,
            deletedCount: 0,
        });
    });
});
