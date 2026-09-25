import { randomBytes } from "node:crypto";
import type { Dirent } from "node:fs";
import { lstat, mkdir, open, readFile, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";

import type { PreparedITTicketAttachment } from "./validation";

const DEFAULT_PRIVATE_ROOT = path.join(process.cwd(), ".uploads", "private");
const SAFE_STORAGE_KEY = /^it\/([1-9]\d{0,9})\/([a-f0-9]{32})\.webp$/;
const SAFE_TICKET_ID = /^[1-9]\d{0,9}$/;
const MAX_TICKET_ID = 2_147_483_647;

export interface StoredITTicketAttachment extends Omit<
    PreparedITTicketAttachment,
    "data"
> {
    readonly id: string;
    readonly ticketId: number;
    readonly position: number;
    readonly storageKey: string;
}

export interface ITTicketAttachmentStorage {
    write(
        ticketId: number,
        attachments: readonly PreparedITTicketAttachment[],
    ): Promise<StoredITTicketAttachment[]>;
    read(storageKey: string, ticketId: number): Promise<Buffer>;
    delete(storageKey: string): Promise<void>;
    deleteIfOlder(storageKey: string, cutoff: Date): Promise<boolean>;
    listCandidates(): Promise<readonly ITAttachmentFileCandidate[]>;
}

export interface ITAttachmentFileCandidate {
    readonly storageKey: string;
    readonly modifiedAt: Date;
}

function validateTicketId(ticketId: number): void {
    if (!Number.isSafeInteger(ticketId) || ticketId < 1 || ticketId > MAX_TICKET_ID) {
        throw new Error("Invalid IT attachment ticket id");
    }
}

export function resolveITAttachmentPath(
    privateRoot: string,
    storageKey: string,
): string {
    const match = SAFE_STORAGE_KEY.exec(storageKey);
    if (!match || Number(match[1]) > MAX_TICKET_ID) {
        throw new Error("Invalid IT attachment storage key");
    }

    const rootPath = path.resolve(privateRoot);
    const targetPath = path.resolve(rootPath, ...storageKey.split("/"));
    if (!targetPath.startsWith(`${rootPath}${path.sep}`)) {
        throw new Error("Invalid IT attachment storage key");
    }
    return targetPath;
}

function createITAttachmentStorageKey(ticketId: number): string {
    return `it/${ticketId}/${randomBytes(16).toString("hex")}.webp`;
}

export function createITTicketAttachmentStorage(
    privateRoot: string = DEFAULT_PRIVATE_ROOT,
): ITTicketAttachmentStorage {
    const write = async (
        ticketId: number,
        attachments: readonly PreparedITTicketAttachment[],
    ): Promise<StoredITTicketAttachment[]> => {
        validateTicketId(ticketId);
        const stored: StoredITTicketAttachment[] = [];
        const createdStorageKeys: string[] = [];
        try {
            for (const [position, attachment] of attachments.entries()) {
                const storageKey = createITAttachmentStorageKey(ticketId);
                const targetPath = resolveITAttachmentPath(privateRoot, storageKey);
                await mkdir(path.dirname(targetPath), { recursive: true, mode: 0o750 });
                const rootRealPath = await realpath(privateRoot);
                const directoryRealPath = await realpath(path.dirname(targetPath));
                if (!directoryRealPath.startsWith(`${rootRealPath}${path.sep}`)) {
                    throw new Error("IT attachment directory escaped private root");
                }
                const safeTargetPath = path.join(directoryRealPath, path.basename(targetPath));
                const handle = await open(safeTargetPath, "wx", 0o640);
                createdStorageKeys.push(storageKey);
                try {
                    await handle.writeFile(attachment.data);
                } finally {
                    await handle.close();
                }
                stored.push({
                    id: randomBytes(16).toString("hex"),
                    ticketId,
                    position,
                    storageKey,
                    originalName: attachment.originalName,
                    contentType: attachment.contentType,
                    contentSha256: attachment.contentSha256,
                    sizeBytes: attachment.sizeBytes,
                    width: attachment.width,
                    height: attachment.height,
                });
            }
            return stored;
        } catch (error) {
            const results = await Promise.allSettled(
                createdStorageKeys.map((storageKey) =>
                    rm(resolveITAttachmentPath(privateRoot, storageKey), { force: true }),
                ),
            );
            const failedCount = results.filter((result) => result.status === "rejected").length;
            if (failedCount > 0) {
                console.error("IT attachment write rollback failed", { failedCount });
            }
            throw error;
        }
    };

    const read = async (storageKey: string, ticketId: number): Promise<Buffer> => {
        validateTicketId(ticketId);
        const match = SAFE_STORAGE_KEY.exec(storageKey);
        if (!match || Number(match[1]) !== ticketId) {
            throw new Error("Invalid IT attachment storage key");
        }
        const targetPath = resolveITAttachmentPath(privateRoot, storageKey);
        const file = await lstat(targetPath);
        if (!file.isFile() || file.isSymbolicLink()) throw new Error("Invalid IT attachment file");
        const [rootRealPath, targetRealPath] = await Promise.all([
            realpath(privateRoot),
            realpath(targetPath),
        ]);
        if (!targetRealPath.startsWith(`${rootRealPath}${path.sep}`)) {
            throw new Error("IT attachment file escaped private root");
        }
        return readFile(targetRealPath);
    };

    const remove = async (storageKey: string): Promise<void> => {
        const targetPath = resolveITAttachmentPath(privateRoot, storageKey);
        const file = await lstat(targetPath).catch((error: unknown) => {
            if (isErrorCode(error, "ENOENT")) return null;
            throw error;
        });
        if (file === null) return;
        if (!file.isFile() || file.isSymbolicLink()) throw new Error("Invalid IT attachment file");
        const [rootRealPath, targetRealPath] = await Promise.all([
            realpath(privateRoot),
            realpath(targetPath),
        ]);
        if (!targetRealPath.startsWith(`${rootRealPath}${path.sep}`)) {
            throw new Error("IT attachment file escaped private root");
        }
        await rm(targetRealPath, { force: true });
    };

    const deleteIfOlder = async (storageKey: string, cutoff: Date): Promise<boolean> => {
        const targetPath = resolveITAttachmentPath(privateRoot, storageKey);
        const file = await lstat(targetPath).catch((error: unknown) => {
            if (isErrorCode(error, "ENOENT")) return null;
            throw error;
        });
        if (
            file === null
            || !file.isFile()
            || file.isSymbolicLink()
            || file.mtime.getTime() >= cutoff.getTime()
        ) return false;

        const [rootRealPath, targetRealPath] = await Promise.all([
            realpath(privateRoot),
            realpath(targetPath),
        ]);
        if (!targetRealPath.startsWith(`${rootRealPath}${path.sep}`)) {
            throw new Error("IT attachment file escaped private root");
        }
        await rm(targetRealPath, { force: true });
        return true;
    };

    const listCandidates = async (): Promise<readonly ITAttachmentFileCandidate[]> => {
        const itDirectory = path.join(privateRoot, "it");
        let ticketDirectories: Dirent<string>[];
        let itDirectoryRealPath: string;
        try {
            const [rootRealPath, resolvedITDirectory] = await Promise.all([
                realpath(privateRoot),
                realpath(itDirectory),
            ]);
            if (!resolvedITDirectory.startsWith(`${rootRealPath}${path.sep}`)) return [];
            itDirectoryRealPath = resolvedITDirectory;
            ticketDirectories = await readdir(itDirectoryRealPath, { withFileTypes: true });
        } catch (error) {
            if (isErrorCode(error, "ENOENT")) return [];
            throw error;
        }

        const candidates: ITAttachmentFileCandidate[] = [];
        for (const ticketDirectory of ticketDirectories) {
            if (!ticketDirectory.isDirectory() || !SAFE_TICKET_ID.test(ticketDirectory.name)) continue;
            const ticketId = Number(ticketDirectory.name);
            if (ticketId > MAX_TICKET_ID) continue;
            const directoryPath = path.join(itDirectoryRealPath, ticketDirectory.name);
            let rootRealPath: string;
            let directoryRealPath: string;
            try {
                [rootRealPath, directoryRealPath] = await Promise.all([
                    realpath(privateRoot),
                    realpath(directoryPath),
                ]);
            } catch (error) {
                if (isErrorCode(error, "ENOENT")) continue;
                throw error;
            }
            if (!directoryRealPath.startsWith(`${rootRealPath}${path.sep}`)) continue;
            let files: Dirent<string>[];
            try {
                files = await readdir(directoryRealPath, { withFileTypes: true });
            } catch (error) {
                if (isErrorCode(error, "ENOENT")) continue;
                throw error;
            }
            for (const file of files) {
                if (!file.isFile() || !/^[a-f0-9]{32}\.webp$/.test(file.name)) continue;
                const storageKey = `it/${ticketDirectory.name}/${file.name}`;
                const targetPath = path.join(directoryRealPath, file.name);
                const fileStat = await lstat(targetPath).catch((error: unknown) => {
                    if (isErrorCode(error, "ENOENT")) return null;
                    throw error;
                });
                if (fileStat === null) continue;
                if (!fileStat.isFile() || fileStat.isSymbolicLink()) continue;
                const [rootRealPath, targetRealPath] = await Promise.all([
                    realpath(privateRoot),
                    realpath(targetPath),
                ]);
                if (!targetRealPath.startsWith(`${rootRealPath}${path.sep}`)) continue;
                candidates.push({ storageKey, modifiedAt: fileStat.mtime });
            }
        }
        return candidates;
    };

    return { write, read, delete: remove, deleteIfOlder, listCandidates };
}

function isErrorCode(error: unknown, code: string): boolean {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === code;
}

const itTicketAttachmentStorage = createITTicketAttachmentStorage();

export const writeITTicketAttachments = itTicketAttachmentStorage.write;
export const readITTicketAttachment = itTicketAttachmentStorage.read;
export const deleteITTicketAttachmentFile = itTicketAttachmentStorage.delete;
export const deleteOldITTicketAttachmentFile = itTicketAttachmentStorage.deleteIfOlder;
export const listITTicketAttachmentFiles = itTicketAttachmentStorage.listCandidates;

export async function deleteITTicketAttachmentFiles(
    storageKeys: readonly string[],
): Promise<void> {
    const results = await Promise.allSettled(
        storageKeys.map((storageKey) => itTicketAttachmentStorage.delete(storageKey)),
    );
    const failedCount = results.filter((result) => result.status === "rejected").length;
    if (failedCount > 0) {
        console.error("IT attachment cleanup after failed comment failed", { failedCount });
    }
}
