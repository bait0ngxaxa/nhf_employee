import { type NextRequest, NextResponse } from "next/server";

import { readBoundedBytes } from "@/lib/server/request-body";
import { readRouteJsonBody } from "@/lib/server/route-json-body";
import { REQUEST_BODY_INVALID_JSON_MESSAGE } from "@/lib/ssot/request-limits";
import { jsonError } from "@/lib/ssot/http";
import { IT_TICKET_COMMENT_MAX_REQUEST_BYTES } from "@/lib/ssot/request-limits";

import { createITTicketCommentBodySchema } from "../../application/ticket-schemas";
import {
    IT_TICKET_ATTACHMENT_MAX_REQUEST_BYTES,
} from "../../contracts";
import type { ITTicketAttachmentSource } from "../../infrastructure/attachments/validation";

export type ITTicketCommentMediaType = "json" | "multipart" | "unsupported";

export interface ParsedITTicketCommentHttpInput {
    readonly body: string;
    readonly attachments: readonly ITTicketAttachmentSource[];
}

export function getITTicketCommentMediaType(request: Request): ITTicketCommentMediaType {
    const contentType = request.headers.get("content-type");
    if (contentType === null || contentType.trim() === "") return "json";

    const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
    if (mediaType === "application/json") return "json";
    if (mediaType === "multipart/form-data") return "multipart";
    return "unsupported";
}

export async function parseITTicketCommentHttpInput(
    request: NextRequest,
    mediaType: Exclude<ITTicketCommentMediaType, "unsupported">,
): Promise<ParsedITTicketCommentHttpInput | NextResponse> {
    if (mediaType === "json") {
        const result = await readRouteJsonBody(request, {
            maxBytes: IT_TICKET_COMMENT_MAX_REQUEST_BYTES,
            invalidJsonDetails: { success: false },
            tooLargeDetails: { success: false },
        });
        if (!result.ok) return result.response;
        const parsed = createITTicketCommentBodySchema.safeParse(result.body);
        if (!parsed.success) {
            return jsonError("กรุณาตรวจสอบข้อความตอบกลับ", 400, { success: false });
        }
        return { body: parsed.data.body, attachments: [] };
    }

    const bounded = await readBoundedBytes(request, IT_TICKET_ATTACHMENT_MAX_REQUEST_BYTES);
    if (!bounded.ok) {
        const tooLarge = bounded.reason === "TOO_LARGE";
        return jsonError(
            tooLarge ? "คำขอมีขนาดใหญ่เกินไป" : REQUEST_BODY_INVALID_JSON_MESSAGE,
            tooLarge ? 413 : 400,
            { success: false },
        );
    }

    const contentType = request.headers.get("content-type");
    if (contentType === null) {
        return jsonError(REQUEST_BODY_INVALID_JSON_MESSAGE, 400, { success: false });
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
        return jsonError(REQUEST_BODY_INVALID_JSON_MESSAGE, 400, { success: false });
    }

    let bodyValue: string | null = null;
    const attachments: ITTicketAttachmentSource[] = [];
    for (const [field, value] of formData.entries()) {
        if (field === "body" && typeof value === "string" && bodyValue === null) {
            bodyValue = value;
            continue;
        }
        if (field === "attachments" && typeof value !== "string") {
            attachments.push(value);
            continue;
        }
        return jsonError(REQUEST_BODY_INVALID_JSON_MESSAGE, 400, { success: false });
    }

    if (bodyValue === null) {
        return jsonError("กรุณาระบุข้อความตอบกลับ", 400, { success: false });
    }
    const parsed = createITTicketCommentBodySchema.safeParse({ body: bodyValue });
    if (!parsed.success) {
        return jsonError("กรุณาตรวจสอบข้อความตอบกลับ", 400, { success: false });
    }

    return {
        body: parsed.data.body,
        attachments: attachments.map((file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            arrayBuffer: () => file.arrayBuffer(),
        })),
    };
}

export function isITTicketCommentParseFailure(
    value: ParsedITTicketCommentHttpInput | NextResponse,
): value is NextResponse {
    return value instanceof NextResponse;
}
