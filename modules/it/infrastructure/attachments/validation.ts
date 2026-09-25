import { createHash } from "node:crypto";
import sharp from "sharp";

import {
    IT_TICKET_ATTACHMENT_ACCEPTED_TYPES,
    IT_TICKET_ATTACHMENT_MAX_BYTES,
    IT_TICKET_ATTACHMENT_MAX_FILES,
    IT_TICKET_ATTACHMENT_MAX_HEIGHT,
    IT_TICKET_ATTACHMENT_MAX_INPUT_PIXELS,
    IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES,
    IT_TICKET_ATTACHMENT_MAX_WIDTH,
    IT_TICKET_ATTACHMENT_WEBP_QUALITY,
} from "../../contracts";

const MAX_ORIGINAL_NAME_LENGTH = 255;
const FORMAT_BY_TYPE: Readonly<Record<string, string>> = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
};

export interface ITTicketAttachmentSource {
    readonly name: string;
    readonly type: string;
    readonly size: number;
    arrayBuffer(): Promise<ArrayBuffer>;
}

export interface PreparedITTicketAttachment {
    readonly originalName: string;
    readonly contentType: "image/webp";
    readonly contentSha256: string;
    readonly sizeBytes: number;
    readonly width: number;
    readonly height: number;
    readonly data: Buffer;
}

export class ITTicketAttachmentValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ITTicketAttachmentValidationError";
    }
}

export function sanitizeITTicketAttachmentName(name: string): string {
    if (name.length === 0 || name.length > MAX_ORIGINAL_NAME_LENGTH) {
        throw new ITTicketAttachmentValidationError("ชื่อไฟล์ไม่ถูกต้อง");
    }

    const sanitized = name
        .replace(/[\\/]/g, "_")
        .replace(/\p{Cc}/gu, "")
        .replace(/\.\./g, "_")
        .trim();
    if (sanitized.length === 0 || sanitized.length > MAX_ORIGINAL_NAME_LENGTH) {
        throw new ITTicketAttachmentValidationError("ชื่อไฟล์ไม่ถูกต้อง");
    }
    return sanitized;
}

export function assertValidITTicketDecodedImage(
    format: string | undefined,
    width: number | undefined,
    height: number | undefined,
    declaredType: string,
): void {
    if (
        !format
        || !Number.isSafeInteger(width)
        || !Number.isSafeInteger(height)
        || !width
        || !height
        || width < 1
        || height < 1
        || width * height > IT_TICKET_ATTACHMENT_MAX_INPUT_PIXELS
        || FORMAT_BY_TYPE[declaredType] !== format
    ) {
        throw new ITTicketAttachmentValidationError(
            "ไฟล์ไม่ใช่รูปภาพที่รองรับหรือมีความละเอียดสูงเกินไป",
        );
    }
}

function validateSources(files: readonly ITTicketAttachmentSource[]): void {
    if (files.length > IT_TICKET_ATTACHMENT_MAX_FILES) {
        throw new ITTicketAttachmentValidationError(
            `แนบรูปภาพได้สูงสุด ${IT_TICKET_ATTACHMENT_MAX_FILES} ไฟล์`,
        );
    }

    let totalBytes = 0;
    for (const file of files) {
        const sanitizedName = sanitizeITTicketAttachmentName(file.name);
        const extension = sanitizedName.split(".").at(-1)?.toLowerCase();
        const extensionType = extension === "jpg" || extension === "jpeg"
            ? "image/jpeg"
            : extension === "png"
                ? "image/png"
                : extension === "webp"
                    ? "image/webp"
                    : null;
        if (
            !IT_TICKET_ATTACHMENT_ACCEPTED_TYPES.some((type) => type === file.type)
            || extensionType !== file.type
        ) {
            throw new ITTicketAttachmentValidationError(
                "รองรับเฉพาะรูปภาพ JPG, PNG และ WEBP",
            );
        }
        if (!Number.isSafeInteger(file.size) || file.size < 1) {
            throw new ITTicketAttachmentValidationError("ขนาดไฟล์ไม่ถูกต้อง");
        }
        if (file.size > IT_TICKET_ATTACHMENT_MAX_BYTES) {
            throw new ITTicketAttachmentValidationError("รูปภาพแต่ละไฟล์ต้องมีขนาดไม่เกิน 8 MiB");
        }
        totalBytes += file.size;
    }
    if (totalBytes > IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES) {
        throw new ITTicketAttachmentValidationError("รูปภาพทั้งหมดต้องมีขนาดไม่เกิน 20 MiB");
    }
}

async function prepareOne(
    file: ITTicketAttachmentSource,
): Promise<PreparedITTicketAttachment> {
    const originalName = sanitizeITTicketAttachmentName(file.name);
    try {
        const source = Buffer.from(await file.arrayBuffer());
        if (source.byteLength !== file.size || source.byteLength > IT_TICKET_ATTACHMENT_MAX_BYTES) {
            throw new ITTicketAttachmentValidationError("ขนาดไฟล์ไม่ถูกต้อง");
        }

        const metadata = await sharp(source, {
            failOn: "warning",
            limitInputPixels: IT_TICKET_ATTACHMENT_MAX_INPUT_PIXELS,
            sequentialRead: true,
        }).metadata();
        assertValidITTicketDecodedImage(
            metadata.format,
            metadata.width,
            metadata.height,
            file.type,
        );

        const transformed = await sharp(source, {
            failOn: "warning",
            limitInputPixels: IT_TICKET_ATTACHMENT_MAX_INPUT_PIXELS,
            sequentialRead: true,
        })
            .rotate()
            .resize(IT_TICKET_ATTACHMENT_MAX_WIDTH, IT_TICKET_ATTACHMENT_MAX_HEIGHT, {
                fit: "inside",
                withoutEnlargement: true,
            })
            .webp({ quality: IT_TICKET_ATTACHMENT_WEBP_QUALITY })
            .toBuffer({ resolveWithObject: true });

        if (
            transformed.info.format !== "webp"
            || !transformed.info.width
            || !transformed.info.height
            || transformed.info.width > IT_TICKET_ATTACHMENT_MAX_WIDTH
            || transformed.info.height > IT_TICKET_ATTACHMENT_MAX_HEIGHT
        ) {
            throw new Error("Invalid normalized image result");
        }

        return {
            originalName,
            contentType: "image/webp",
            contentSha256: createHash("sha256").update(transformed.data).digest("hex"),
            sizeBytes: transformed.data.byteLength,
            width: transformed.info.width,
            height: transformed.info.height,
            data: transformed.data,
        };
    } catch (error) {
        if (error instanceof ITTicketAttachmentValidationError) throw error;
        throw new ITTicketAttachmentValidationError("ไฟล์รูปภาพเสียหายหรืออ่านไม่ได้");
    }
}

export async function prepareITTicketAttachments(
    files: readonly ITTicketAttachmentSource[],
): Promise<PreparedITTicketAttachment[]> {
    validateSources(files);
    const prepared: PreparedITTicketAttachment[] = [];
    for (const file of files) prepared.push(await prepareOne(file));
    return prepared;
}
