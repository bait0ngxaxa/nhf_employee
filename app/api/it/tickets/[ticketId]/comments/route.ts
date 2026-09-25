import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { contentLengthExceedsLimit } from "@/lib/server/request-body";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import { IT_TICKET_COMMENT_MAX_REQUEST_BYTES } from "@/lib/ssot/request-limits";
import {
    buildCurrentITAuthorizationContext,
    IT_TICKET_ATTACHMENT_MAX_REQUEST_BYTES,
    postITRequesterTicketComment,
} from "@/modules/it";
import {
    getITTicketCommentMediaType,
    isITTicketCommentParseFailure,
    parseITTicketCommentHttpInput,
} from "../../../_lib/comment-request";

import {
    mapITTicketRouteError,
    parseITRequesterTicketId,
} from "../../_lib/response";

function logCommentPostError(error: unknown): void {
    const rawErrorType = error instanceof Error ? error.name : "UnknownError";
    const errorType = /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(rawErrorType)
        ? rawErrorType
        : "UnknownError";
    const rawErrorCode = typeof error === "object" && error !== null && "code" in error
        && typeof error.code === "string"
        ? error.code
        : undefined;
    const errorCode = rawErrorCode !== undefined && /^[A-Z0-9_]{1,64}$/.test(rawErrorCode)
        ? rawErrorCode
        : undefined;
    console.error("Error posting requester IT Ticket comment:", {
        errorType,
        ...(errorCode === undefined ? {} : { errorCode }),
    });
}

export async function POST(
    request: NextRequest,
    context: { readonly params: Promise<{ readonly ticketId: string }> },
): Promise<NextResponse> {
    const mediaType = getITTicketCommentMediaType(request);
    if (mediaType === "unsupported") {
        return jsonError("รองรับเฉพาะ JSON หรือ multipart/form-data", 415, { success: false });
    }
    const maxRequestBytes = mediaType === "multipart"
        ? IT_TICKET_ATTACHMENT_MAX_REQUEST_BYTES
        : IT_TICKET_COMMENT_MAX_REQUEST_BYTES;
    if (contentLengthExceedsLimit(request, maxRequestBytes)) {
        return jsonError("คำขอมีขนาดใหญ่เกินไป", 413, { success: false });
    }
    if (mediaType === "multipart") {
        const limited = enforcePreAuthIpRateLimit(request, "it-ticket-comment-attachment");
        if (limited) return limited;
    }

    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;
        if (mediaType === "multipart") {
            const limited = enforceAuthenticatedMutationRateLimit(
                "it-ticket-comment-attachment",
                auth.user.id,
            );
            if (limited) return limited;
        }

        const { ticketId: rawTicketId } = await context.params;
        const ticketId = parseITRequesterTicketId(rawTicketId);
        if (ticketId === null) {
            return jsonError("หมายเลข Ticket ไม่ถูกต้อง", 400, { success: false });
        }
        const idempotencyKey = request.headers.get("Idempotency-Key");
        if (idempotencyKey === null) {
            return jsonError("กรุณาระบุ Idempotency-Key", 400, { success: false });
        }

        const parsed = await parseITTicketCommentHttpInput(request, mediaType);
        if (isITTicketCommentParseFailure(parsed)) return parsed;

        const result = await postITRequesterTicketComment(
            await buildCurrentITAuthorizationContext(auth.user),
            { ticketId, body: parsed.body },
            { idempotencyKey, attachments: parsed.attachments },
        );
        return NextResponse.json(
            { success: true, ...result },
            { status: result.replayed ? 200 : 201 },
        );
    } catch (error) {
        const expected = mapITTicketRouteError(error);
        if (expected) return expected;
        logCommentPostError(error);
        return operationFailed(500, { success: false });
    }
}
