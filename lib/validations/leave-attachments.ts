import {
    LEAVE_ATTACHMENT_ACCEPTED_TYPES,
    LEAVE_ATTACHMENT_MAX_BYTES,
    LEAVE_ATTACHMENT_MAX_FILES,
    LEAVE_ATTACHMENT_MAX_MB,
    LEAVE_ATTACHMENT_MAX_TOTAL_BYTES,
    LEAVE_ATTACHMENT_MAX_TOTAL_MB,
} from "@/lib/ssot/leave-attachments";

const MAX_ORIGINAL_NAME_LENGTH = 255;

export class LeaveAttachmentValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LeaveAttachmentValidationError";
    }
}

export interface LeaveAttachmentMetadata {
    readonly name: string;
    readonly type: string;
    readonly size: number;
}

export function validateLeaveAttachments(
    files: readonly LeaveAttachmentMetadata[],
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
        if (
            !LEAVE_ATTACHMENT_ACCEPTED_TYPES.some(
                (acceptedType) => acceptedType === file.type,
            )
        ) {
            throw new LeaveAttachmentValidationError(
                "รองรับเฉพาะไฟล์ JPG, PNG และ WEBP",
            );
        }
        if (!Number.isSafeInteger(file.size) || file.size < 0) {
            throw new LeaveAttachmentValidationError("ขนาดไฟล์ไม่ถูกต้อง");
        }
        if (file.size > LEAVE_ATTACHMENT_MAX_BYTES) {
            throw new LeaveAttachmentValidationError(
                `ไฟล์หลักฐานแต่ละไฟล์ต้องมีขนาดไม่เกิน ${LEAVE_ATTACHMENT_MAX_MB} MB`,
            );
        }
        totalBytes += file.size;
    }

    if (totalBytes > LEAVE_ATTACHMENT_MAX_TOTAL_BYTES) {
        throw new LeaveAttachmentValidationError(
            `ไฟล์หลักฐานรวมต้องมีขนาดไม่เกิน ${LEAVE_ATTACHMENT_MAX_TOTAL_MB} MB`,
        );
    }
}
