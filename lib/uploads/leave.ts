import crypto from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import {
    LEAVE_ATTACHMENT_MAX_HEIGHT,
    LEAVE_ATTACHMENT_MAX_WIDTH,
    LEAVE_ATTACHMENT_WEBP_QUALITY,
} from "@/lib/ssot/leave-attachments";
import {
    LeaveAttachmentValidationError,
    validateLeaveAttachments,
} from "@/lib/validations/leave-attachments";

const DEFAULT_PRIVATE_UPLOAD_ROOT = path.join(process.cwd(), ".uploads", "private");
const SAFE_LEAVE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_STORAGE_KEY = /^leave\/[A-Za-z0-9_-]{1,64}\/[a-f0-9]{32}\.webp$/;

export {
    LeaveAttachmentValidationError,
    validateLeaveAttachments,
} from "@/lib/validations/leave-attachments";

export interface LeaveAttachmentSource {
    readonly name: string;
    readonly type: string;
    readonly size: number;
    arrayBuffer(): Promise<ArrayBuffer>;
}

export interface StoredLeaveAttachment {
    storageKey: string;
    originalName: string;
    contentType: "image/webp";
    sizeBytes: number;
    width: number;
    height: number;
}

export interface LeaveAttachmentStorageService {
    save(input: {
        leaveRequestId: string;
        files: readonly LeaveAttachmentSource[];
    }): Promise<StoredLeaveAttachment[]>;
    read(storageKey: string): Promise<Buffer>;
    delete(storageKey: string): Promise<void>;
}

function validateLeaveRequestId(leaveRequestId: string): void {
    if (!SAFE_LEAVE_REQUEST_ID.test(leaveRequestId)) {
        throw new LeaveAttachmentValidationError("รหัสคำขอลาไม่ถูกต้อง");
    }
}

function resolveStoragePath(rootDirectory: string, storageKey: string): string {
    if (!SAFE_STORAGE_KEY.test(storageKey)) {
        throw new LeaveAttachmentValidationError("รหัสจัดเก็บไฟล์ไม่ถูกต้อง");
    }

    const rootPath = path.resolve(rootDirectory);
    const resolvedPath = path.resolve(rootPath, ...storageKey.split("/"));
    if (!resolvedPath.startsWith(`${rootPath}${path.sep}`)) {
        throw new LeaveAttachmentValidationError("รหัสจัดเก็บไฟล์ไม่ถูกต้อง");
    }

    return resolvedPath;
}

async function transformFile(file: LeaveAttachmentSource): Promise<{
    data: Buffer;
    width: number;
    height: number;
}> {
    try {
        const sourceBuffer = Buffer.from(await file.arrayBuffer());
        const transformed = await sharp(sourceBuffer)
            .rotate()
            .resize(LEAVE_ATTACHMENT_MAX_WIDTH, LEAVE_ATTACHMENT_MAX_HEIGHT, {
                fit: "inside",
                withoutEnlargement: true,
            })
            .webp({ quality: LEAVE_ATTACHMENT_WEBP_QUALITY })
            .toBuffer({ resolveWithObject: true });

        if (!transformed.info.width || !transformed.info.height) {
            throw new Error("Missing transformed image dimensions");
        }

        return {
            data: transformed.data,
            width: transformed.info.width,
            height: transformed.info.height,
        };
    } catch {
        throw new LeaveAttachmentValidationError(
            `ไฟล์ "${file.name}" ไม่ใช่รูปภาพที่ถูกต้อง`,
        );
    }
}

function createStorageKey(leaveRequestId: string): string {
    return `leave/${leaveRequestId}/${crypto.randomBytes(16).toString("hex")}.webp`;
}

export function createLeaveAttachmentStorage(
    rootDirectory: string = DEFAULT_PRIVATE_UPLOAD_ROOT,
): LeaveAttachmentStorageService {
    const save = async (input: {
        leaveRequestId: string;
        files: readonly LeaveAttachmentSource[];
    }): Promise<StoredLeaveAttachment[]> => {
        validateLeaveRequestId(input.leaveRequestId);
        validateLeaveAttachments(input.files);

        const stored: StoredLeaveAttachment[] = [];
        try {
            for (const file of input.files) {
                const transformed = await transformFile(file);
                const storageKey = createStorageKey(input.leaveRequestId);
                const targetPath = resolveStoragePath(rootDirectory, storageKey);
                await mkdir(path.dirname(targetPath), {
                    recursive: true,
                    mode: 0o750,
                });
                await writeFile(targetPath, transformed.data, {
                    flag: "wx",
                    mode: 0o640,
                });
                stored.push({
                    storageKey,
                    originalName: file.name,
                    contentType: "image/webp",
                    sizeBytes: transformed.data.byteLength,
                    width: transformed.width,
                    height: transformed.height,
                });
            }
            return stored;
        } catch (error) {
            const cleanupResults = await Promise.allSettled(
                stored.map(({ storageKey }) =>
                    rm(resolveStoragePath(rootDirectory, storageKey), { force: true }),
                ),
            );
            const failedCleanupCount = cleanupResults.filter(
                (result) => result.status === "rejected",
            ).length;
            if (failedCleanupCount > 0) {
                console.error("ลบไฟล์หลักฐานระหว่าง rollback ไม่สำเร็จ", {
                    failedCleanupCount,
                });
            }
            throw error;
        }
    };

    return {
        save,
        read: async (storageKey: string): Promise<Buffer> =>
            readFile(resolveStoragePath(rootDirectory, storageKey)),
        delete: async (storageKey: string): Promise<void> => {
            await rm(resolveStoragePath(rootDirectory, storageKey), { force: true });
        },
    };
}

const leaveAttachmentStorage = createLeaveAttachmentStorage();

export const saveLeaveAttachments = leaveAttachmentStorage.save;
export const readLeaveAttachment = leaveAttachmentStorage.read;
export const deleteLeaveAttachment = leaveAttachmentStorage.delete;
