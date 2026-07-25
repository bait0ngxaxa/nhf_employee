import crypto from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import {
    LEAVE_ATTACHMENT_ACCEPTED_TYPES,
    LEAVE_ATTACHMENT_MAX_BYTES,
    LEAVE_ATTACHMENT_MAX_FILES,
    LEAVE_ATTACHMENT_MAX_HEIGHT,
    LEAVE_ATTACHMENT_MAX_MB,
    LEAVE_ATTACHMENT_MAX_TOTAL_BYTES,
    LEAVE_ATTACHMENT_MAX_TOTAL_MB,
    LEAVE_ATTACHMENT_MAX_WIDTH,
    LEAVE_ATTACHMENT_WEBP_QUALITY,
    type LeaveAttachmentAcceptedType,
} from "@/lib/ssot/leave-attachments";

const DEFAULT_PRIVATE_UPLOAD_ROOT = path.join(process.cwd(), ".uploads", "private");
const SAFE_LEAVE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_STORAGE_KEY = /^leave\/[A-Za-z0-9_-]{1,64}\/[a-f0-9]{32}\.webp$/;
const MAX_ORIGINAL_NAME_LENGTH = 255;

export class LeaveAttachmentValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LeaveAttachmentValidationError";
    }
}

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

function isAcceptedType(contentType: string): contentType is LeaveAttachmentAcceptedType {
    return LEAVE_ATTACHMENT_ACCEPTED_TYPES.some((type) => type === contentType);
}

function validateLeaveRequestId(leaveRequestId: string): void {
    if (!SAFE_LEAVE_REQUEST_ID.test(leaveRequestId)) {
        throw new LeaveAttachmentValidationError("รหัสคำขอลาไม่ถูกต้อง");
    }
}

export function validateLeaveAttachments(
    files: readonly LeaveAttachmentSource[],
): void {
    if (files.length > LEAVE_ATTACHMENT_MAX_FILES) {
        throw new LeaveAttachmentValidationError(
            `แนบหลักฐานได้สูงสุด ${LEAVE_ATTACHMENT_MAX_FILES} ไฟล์`,
        );
    }

    let totalBytes = 0;
    for (const file of files) {
        if (!file.name || file.name.length > MAX_ORIGINAL_NAME_LENGTH) {
            throw new LeaveAttachmentValidationError("ชื่อไฟล์ไม่ถูกต้อง");
        }
        if (!isAcceptedType(file.type)) {
            throw new LeaveAttachmentValidationError(
                "รองรับเฉพาะไฟล์ JPG, PNG และ WEBP",
            );
        }
        if (!Number.isSafeInteger(file.size) || file.size < 0) {
            throw new LeaveAttachmentValidationError("ขนาดไฟล์ไม่ถูกต้อง");
        }
        if (file.size > LEAVE_ATTACHMENT_MAX_BYTES) {
            throw new LeaveAttachmentValidationError(
                `ไฟล์หลักฐานแต่ละไฟล์ต้องมีขนาดไม่เกิน ${LEAVE_ATTACHMENT_MAX_MB}MB`,
            );
        }
        totalBytes += file.size;
    }

    if (totalBytes > LEAVE_ATTACHMENT_MAX_TOTAL_BYTES) {
        throw new LeaveAttachmentValidationError(
            `ไฟล์หลักฐานรวมต้องมีขนาดไม่เกิน ${LEAVE_ATTACHMENT_MAX_TOTAL_MB}MB`,
        );
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
                await mkdir(path.dirname(targetPath), { recursive: true });
                await writeFile(targetPath, transformed.data, { flag: "wx" });
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
