import { readdir, lstat, rm } from "node:fs/promises";
import type { Dirent, Stats } from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/db/prisma";
import {
    LEAVE_ATTACHMENT_ORPHAN_SAFETY_WINDOW_MS,
} from "@/modules/leave/infrastructure/attachments/constants";

const DEFAULT_PRIVATE_UPLOAD_ROOT = path.join(
    process.cwd(),
    ".uploads",
    "private",
);
const SAFE_LEAVE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_ATTACHMENT_FILENAME = /^[a-f0-9]{32}\.webp$/;

export interface LeaveAttachmentStorageKeyRepository {
    findMany(args: {
        select: { storageKey: true };
    }): Promise<readonly { storageKey: string }[]>;
}

export interface LeaveAttachmentOrphanCleanupOptions {
    rootDirectory?: string;
    repository?: LeaveAttachmentStorageKeyRepository;
    now?: Date;
    safetyWindowMs?: number;
    dryRun?: boolean;
}

export interface LeaveAttachmentOrphanCleanupResult {
    scannedCount: number;
    orphanCount: number;
    deletedCount: number;
    failedCount: number;
    skippedRecentCount: number;
    dryRun: boolean;
    cutoff: Date;
}

interface ScannedFile {
    filePath: string;
    storageKey: string;
    modifiedAt: Date;
}

function isMissingDirectoryError(error: unknown): boolean {
    return (
        typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "ENOENT"
    );
}

function getLeaveRoot(rootDirectory: string): string {
    return path.resolve(rootDirectory, "leave");
}

async function scanLeaveFiles(rootDirectory: string): Promise<ScannedFile[]> {
    const leaveRoot = getLeaveRoot(rootDirectory);
    let requestDirectories: Dirent[];
    try {
        requestDirectories = await readdir(leaveRoot, { withFileTypes: true });
    } catch (error) {
        if (isMissingDirectoryError(error)) {
            return [];
        }
        throw error;
    }

    const files: ScannedFile[] = [];
    for (const requestDirectory of requestDirectories) {
        if (
            !requestDirectory.isDirectory()
            || !SAFE_LEAVE_REQUEST_ID.test(requestDirectory.name)
        ) {
            continue;
        }

        const requestDirectoryPath = path.join(leaveRoot, requestDirectory.name);
        let entries: Dirent[];
        try {
            entries = await readdir(requestDirectoryPath, {
                withFileTypes: true,
            });
        } catch (error) {
            if (isMissingDirectoryError(error)) {
                continue;
            }
            throw error;
        }
        for (const entry of entries) {
            if (!entry.isFile() || !SAFE_ATTACHMENT_FILENAME.test(entry.name)) {
                continue;
            }

            const filePath = path.join(requestDirectoryPath, entry.name);
            let fileStats: Stats;
            try {
                fileStats = await lstat(filePath);
            } catch (error) {
                if (isMissingDirectoryError(error)) {
                    continue;
                }
                throw error;
            }
            if (!fileStats.isFile()) {
                continue;
            }

            files.push({
                filePath,
                storageKey: `leave/${requestDirectory.name}/${entry.name}`,
                modifiedAt: fileStats.mtime,
            });
        }
    }

    return files;
}

export async function cleanupOrphanedLeaveAttachments(
    options: LeaveAttachmentOrphanCleanupOptions = {},
): Promise<LeaveAttachmentOrphanCleanupResult> {
    const now = options.now ?? new Date();
    const safetyWindowMs = options.safetyWindowMs
        ?? LEAVE_ATTACHMENT_ORPHAN_SAFETY_WINDOW_MS;
    if (!Number.isFinite(safetyWindowMs) || safetyWindowMs < 0) {
        throw new Error("Invalid leave attachment cleanup safety window");
    }

    const cutoff = new Date(now.getTime() - safetyWindowMs);
    const repository = options.repository ?? prisma.leaveAttachment;
    const [files, storedAttachments] = await Promise.all([
        scanLeaveFiles(options.rootDirectory ?? DEFAULT_PRIVATE_UPLOAD_ROOT),
        repository.findMany({ select: { storageKey: true } }),
    ]);
    const storedKeys = new Set(
        storedAttachments.map(({ storageKey }) => storageKey),
    );

    let orphanCount = 0;
    let deletedCount = 0;
    let failedCount = 0;
    let skippedRecentCount = 0;

    for (const file of files) {
        if (storedKeys.has(file.storageKey)) {
            continue;
        }
        orphanCount += 1;
        if (file.modifiedAt >= cutoff) {
            skippedRecentCount += 1;
            continue;
        }
        if (options.dryRun) {
            continue;
        }

        try {
            await rm(file.filePath, { force: true });
            deletedCount += 1;
        } catch (error) {
            failedCount += 1;
            console.error("ลบไฟล์หลักฐานที่ไม่ผูกกับข้อมูลไม่สำเร็จ", {
                errorType: error instanceof Error ? error.name : "UnknownError",
            });
        }
    }

    return {
        scannedCount: files.length,
        orphanCount,
        deletedCount,
        failedCount,
        skippedRecentCount,
        dryRun: options.dryRun === true,
        cutoff,
    };
}
