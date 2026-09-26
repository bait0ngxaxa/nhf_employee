import {
    IT_TICKET_ATTACHMENT_ACCEPTED_TYPES,
    IT_TICKET_ATTACHMENT_MAX_BYTES,
    IT_TICKET_ATTACHMENT_MAX_FILES,
    IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES,
} from "../../contracts";
import type { ITTicketType } from "@prisma/client";

export interface SelectedITTicketAttachment {
    readonly file: File;
    readonly previewUrl: string;
}

export function validateITTicketAttachmentSelection(
    current: readonly File[],
    incoming: readonly File[],
): string | null {
    if (current.length + incoming.length > IT_TICKET_ATTACHMENT_MAX_FILES) {
        return `แนบรูปภาพได้สูงสุด ${IT_TICKET_ATTACHMENT_MAX_FILES} ไฟล์`;
    }

    let totalBytes = current.reduce((total, file) => total + file.size, 0);
    for (const file of incoming) {
        const extension = file.name.split(".").at(-1)?.toLowerCase();
        const matchingExtension = extension === "jpg" || extension === "jpeg"
            ? file.type === "image/jpeg"
            : extension === "png"
                ? file.type === "image/png"
                : extension === "webp"
                    ? file.type === "image/webp"
                    : false;
        if (
            !IT_TICKET_ATTACHMENT_ACCEPTED_TYPES.some((type) => type === file.type)
            || !matchingExtension
        ) {
            return "รองรับเฉพาะรูปภาพ JPG, PNG และ WEBP";
        }
        if (!Number.isSafeInteger(file.size) || file.size < 1) {
            return "ขนาดไฟล์รูปภาพไม่ถูกต้อง";
        }
        if (file.size > IT_TICKET_ATTACHMENT_MAX_BYTES) {
            return "รูปภาพแต่ละไฟล์ต้องมีขนาดไม่เกิน 8 MiB";
        }
        totalBytes += file.size;
    }
    if (totalBytes > IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES) {
        return "รูปภาพทั้งหมดต้องมีขนาดไม่เกิน 20 MiB";
    }
    return null;
}

function toHex(bytes: ArrayBuffer): string {
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readFileBytes(file: File): Promise<ArrayBuffer> {
    if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) resolve(reader.result);
            else reject(new Error("Unable to read selected image"));
        };
        reader.onerror = () => reject(new Error("Unable to read selected image"));
        reader.readAsArrayBuffer(file);
    });
}

export async function createITTicketCommentAttemptSignature(
    ticketId: number,
    operator: boolean,
    body: string,
    files: readonly File[],
): Promise<string> {
    const attachments = await Promise.all(files.map(async (file) => {
        const sourceHash = await globalThis.crypto.subtle.digest("SHA-256", await readFileBytes(file));
        return {
            name: file.name,
            type: file.type,
            size: file.size,
            sourceSha256: toHex(sourceHash),
        };
    }));
    return JSON.stringify({ ticketId, operator, body, attachments });
}

export async function createITTicketCreationAttemptSignature(
    input: {
        readonly type: ITTicketType;
        readonly title: string;
        readonly description: string;
    },
    files: readonly File[],
): Promise<string> {
    const attachments = await Promise.all(files.map(async (file) => {
        const sourceHash = await globalThis.crypto.subtle.digest("SHA-256", await readFileBytes(file));
        return {
            originalName: file.name,
            contentSha256: toHex(sourceHash),
        };
    }));
    return JSON.stringify({ ...input, attachments });
}
