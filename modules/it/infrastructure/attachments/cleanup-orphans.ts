import path from "node:path";

import { prisma } from "@/lib/db/prisma";

import { IT_TICKET_ATTACHMENT_ORPHAN_SAFETY_WINDOW_MS } from "../../contracts";
import { createITTicketAttachmentStorage } from "./storage";

export interface ITTicketAttachmentStorageKeyRepository {
    findMany(args: {
        readonly select: { readonly storageKey: true };
    }): Promise<readonly { readonly storageKey: string }[]>;
}

export interface ITTicketAttachmentCleanupOptions {
    readonly privateRoot?: string;
    readonly repository?: ITTicketAttachmentStorageKeyRepository;
    readonly now?: Date;
    readonly dryRun?: boolean;
}

export interface ITAttachmentCleanupResult {
    readonly scannedCount: number;
    readonly orphanCount: number;
    readonly deletedCount: number;
    readonly failedCount: number;
    readonly skippedRecentCount: number;
    readonly dryRun: boolean;
}

function isSafeDate(value: Date): boolean {
    return Number.isFinite(value.getTime());
}

export async function cleanupOrphanedITTicketAttachments(
    options: ITTicketAttachmentCleanupOptions,
): Promise<ITAttachmentCleanupResult> {
    const now = options.now ?? new Date();
    if (!isSafeDate(now)) throw new Error("Invalid IT attachment cleanup time");

    const privateRoot = options.privateRoot
        ?? path.join(process.cwd(), ".uploads", "private");
    const storage = createITTicketAttachmentStorage(privateRoot);
    const [candidates, committed] = await Promise.all([
        storage.listCandidates(),
        options.repository
            ? options.repository.findMany({ select: { storageKey: true } })
            : prisma.iTTicketAttachment.findMany({ select: { storageKey: true } }),
    ]);
    const committedKeys = new Set(committed.map((attachment) => attachment.storageKey));
    const orphans = candidates.filter((candidate) => !committedKeys.has(candidate.storageKey));
    const cutoff = new Date(now.getTime() - IT_TICKET_ATTACHMENT_ORPHAN_SAFETY_WINDOW_MS);
    const oldOrphans = orphans.filter((candidate) => candidate.modifiedAt < cutoff);
    const skippedRecentCount = orphans.length - oldOrphans.length;
    if (options.dryRun === true) {
        return {
            scannedCount: candidates.length,
            orphanCount: orphans.length,
            deletedCount: 0,
            failedCount: 0,
            skippedRecentCount,
            dryRun: true,
        };
    }

    const results = await Promise.allSettled(oldOrphans.map((candidate) =>
        storage.deleteIfOlder(candidate.storageKey, cutoff),
    ));
    const deletedCount = results.filter(
        (result) => result.status === "fulfilled" && result.value,
    ).length;
    const failedCount = results.filter((result) => result.status === "rejected").length;
    const skippedDuringDelete = results.filter(
        (result) => result.status === "fulfilled" && !result.value,
    ).length;
    if (failedCount > 0) {
        console.error("IT attachment orphan cleanup encountered file errors", { failedCount });
    }

    return {
        scannedCount: candidates.length,
        orphanCount: orphans.length,
        deletedCount,
        failedCount,
        skippedRecentCount: skippedRecentCount + skippedDuringDelete,
        dryRun: false,
    };
}
