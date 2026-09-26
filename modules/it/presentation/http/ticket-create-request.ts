import { type NextRequest, NextResponse } from "next/server";

import { readBoundedBytes, readBoundedJsonBody } from "@/lib/server/request-body";
import { jsonError } from "@/lib/ssot/http";

import { createITTicketInputSchema } from "../../application/ticket-schemas";
import { IT_TICKET_ATTACHMENT_MAX_REQUEST_BYTES } from "../../contracts";
import type { CreateITTicketInput } from "../../application/ticket-schemas";
import type { ITTicketAttachmentSource } from "../../infrastructure/attachments/validation";

export type ITTicketCreateMediaType = "json" | "multipart" | "unsupported";

export interface ParsedITTicketCreateHttpInput {
    readonly input: CreateITTicketInput;
    readonly attachments: readonly ITTicketAttachmentSource[];
}

export function getITTicketCreateMediaType(request: Request): ITTicketCreateMediaType {
    const contentType = request.headers.get("content-type");
    if (contentType === null || contentType.trim() === "") return "json";

    const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
    if (mediaType === "application/json") return "json";
    if (mediaType === "multipart/form-data") return "multipart";
    return "unsupported";
}

export async function parseITTicketCreateHttpInput(
    request: NextRequest,
    mediaType: Exclude<ITTicketCreateMediaType, "unsupported">,
): Promise<ParsedITTicketCreateHttpInput | NextResponse> {
    if (mediaType === "json") {
        const result = await readBoundedJsonBody(request, IT_TICKET_ATTACHMENT_MAX_REQUEST_BYTES);
        if (!result.ok) {
            const tooLarge = result.reason === "TOO_LARGE";
            return jsonError(
                tooLarge ? "คำขอมีขนาดใหญ่เกินไป" : "รูปแบบข้อมูลไม่ถูกต้อง",
                tooLarge ? 413 : 400,
                { success: false },
            );
        }
        const parsed = createITTicketInputSchema.safeParse(result.value);
        if (!parsed.success) {
            return jsonError("กรุณาตรวจสอบประเภท หัวข้อ และรายละเอียด Ticket", 400, {
                success: false,
            });
        }
        return { input: parsed.data, attachments: [] };
    }

    const bounded = await readBoundedBytes(request, IT_TICKET_ATTACHMENT_MAX_REQUEST_BYTES);
    if (!bounded.ok) {
        const tooLarge = bounded.reason === "TOO_LARGE";
        return jsonError(
            tooLarge ? "คำขอมีขนาดใหญ่เกินไป" : "รูปแบบข้อมูลไม่ถูกต้อง",
            tooLarge ? 413 : 400,
            { success: false },
        );
    }

    const contentType = request.headers.get("content-type");
    if (contentType === null) {
        return jsonError("รูปแบบข้อมูลไม่ถูกต้อง", 400, { success: false });
    }

    let formData: FormData;
    try {
        const boundedRequest = new Request(request.url, {
            method: "POST",
            headers: { "Content-Type": contentType },
            body: new Uint8Array(bounded.bytes),
        });
        formData = await boundedRequest.formData();
    } catch {
        return jsonError("รูปแบบข้อมูลไม่ถูกต้อง", 400, { success: false });
    }

    const scalarFields = new Map<string, string>();
    const attachments: ITTicketAttachmentSource[] = [];
    for (const [field, value] of formData.entries()) {
        if (field === "attachments" && typeof value !== "string") {
            attachments.push({
                name: value.name,
                type: value.type,
                size: value.size,
                arrayBuffer: () => value.arrayBuffer(),
            });
            continue;
        }
        if (
            (field === "type" || field === "title" || field === "description")
            && typeof value === "string"
            && !scalarFields.has(field)
        ) {
            scalarFields.set(field, value);
            continue;
        }
        return jsonError("รูปแบบข้อมูลไม่ถูกต้อง", 400, { success: false });
    }

    const parsed = createITTicketInputSchema.safeParse({
        type: scalarFields.get("type"),
        title: scalarFields.get("title"),
        description: scalarFields.get("description"),
    });
    if (!parsed.success) {
        return jsonError("กรุณาตรวจสอบประเภท หัวข้อ และรายละเอียด Ticket", 400, {
            success: false,
        });
    }

    return { input: parsed.data, attachments };
}

export function isITTicketCreateParseFailure(
    value: ParsedITTicketCreateHttpInput | NextResponse,
): value is NextResponse {
    return value instanceof NextResponse;
}
