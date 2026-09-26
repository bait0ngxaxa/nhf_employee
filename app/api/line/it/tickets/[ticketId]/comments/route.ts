import { type NextRequest, NextResponse } from "next/server";

import { contentLengthExceedsLimit } from "@/lib/server/request-body";
import { scheduleITTicketOutboxWakeup } from "@/lib/server/it-ticket-outbox-wakeup";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { jsonError, operationFailed } from "@/lib/ssot/http";
import { IT_TICKET_COMMENT_MAX_REQUEST_BYTES } from "@/lib/ssot/request-limits";
import { idempotencyKeySchema } from "@/lib/validations/idempotency";
import { requireLiffWorkforceSession } from "@/modules/line";
import {
    buildITAuthorizationContext,
    getITTicketCommentMediaType,
    isITTicketCommentParseFailure,
    IT_TICKET_ATTACHMENT_MAX_REQUEST_BYTES,
    logITTicketRouteFailure,
    mapITTicketRouteError,
    parseITRequesterTicketId,
    parseITTicketCommentHttpInput,
    postITRequesterTicketComment,
} from "@/modules/it";

interface RouteContext {
    readonly params: Promise<{ readonly ticketId: string }>;
}

export async function POST(
    request: NextRequest,
    { params }: RouteContext,
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
        const preAuthLimit = enforcePreAuthIpRateLimit(
            request,
            "it-ticket-comment-attachment",
        );
        if (preAuthLimit) return preAuthLimit;
    }

    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;
    if (mediaType === "multipart") {
        const principalLimit = enforceAuthenticatedMutationRateLimit(
            "it-ticket-comment-attachment",
            auth.user.id,
        );
        if (principalLimit) return principalLimit;
    }

    try {
        const ticketId = parseITRequesterTicketId((await params).ticketId);
        if (ticketId === null) {
            return jsonError("หมายเลข Ticket ไม่ถูกต้อง", 400, { success: false });
        }
        const idempotencyKey = idempotencyKeySchema.safeParse(
            request.headers.get("Idempotency-Key"),
        );
        if (!idempotencyKey.success) {
            return jsonError("กรุณาระบุ Idempotency-Key ที่ถูกต้อง", 400, { success: false });
        }
        const parsed = await parseITTicketCommentHttpInput(request, mediaType);
        if (isITTicketCommentParseFailure(parsed)) return parsed;

        const result = await postITRequesterTicketComment(
            buildITAuthorizationContext(auth.user, auth.employeeId, "LIFF_SELF_SERVICE"),
            { ticketId, body: parsed.body },
            { idempotencyKey: idempotencyKey.data, attachments: parsed.attachments },
        );
        if (!result.replayed) scheduleITTicketOutboxWakeup();
        return NextResponse.json(
            { success: true, ...result },
            { status: result.replayed ? 200 : 201 },
        );
    } catch (error) {
        const expected = mapITTicketRouteError(error);
        if (expected) return expected;
        logITTicketRouteFailure("Error posting LIFF IT Ticket comment", error);
        return operationFailed(500, { success: false });
    }
}
