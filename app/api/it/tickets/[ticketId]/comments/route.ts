import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { contentLengthExceedsLimit, readBoundedJsonBody } from "@/lib/server/request-body";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import { IT_TICKET_COMMENT_MAX_REQUEST_BYTES } from "@/lib/ssot/request-limits";
import {
    buildCurrentITAuthorizationContext,
    createITTicketCommentBodySchema,
    postITRequesterTicketComment,
} from "@/modules/it";

import {
    mapITTicketRouteError,
    parseITRequesterTicketId,
} from "../../_lib/response";

export async function POST(
    request: NextRequest,
    context: { readonly params: Promise<{ readonly ticketId: string }> },
): Promise<NextResponse> {
    if (contentLengthExceedsLimit(request, IT_TICKET_COMMENT_MAX_REQUEST_BYTES)) {
        return jsonError("คำขอมีขนาดใหญ่เกินไป", 413, { success: false });
    }

    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;

        const { ticketId: rawTicketId } = await context.params;
        const ticketId = parseITRequesterTicketId(rawTicketId);
        if (ticketId === null) {
            return jsonError("หมายเลข Ticket ไม่ถูกต้อง", 400, { success: false });
        }
        const idempotencyKey = request.headers.get("Idempotency-Key");
        if (idempotencyKey === null) {
            return jsonError("กรุณาระบุ Idempotency-Key", 400, { success: false });
        }

        const body = await readBoundedJsonBody(request, IT_TICKET_COMMENT_MAX_REQUEST_BYTES);
        if (!body.ok) {
            const tooLarge = body.reason === "TOO_LARGE";
            return jsonError(
                tooLarge ? "คำขอมีขนาดใหญ่เกินไป" : "รูปแบบข้อมูลไม่ถูกต้อง",
                tooLarge ? 413 : 400,
                { success: false },
            );
        }
        const parsed = createITTicketCommentBodySchema.safeParse(body.value);
        if (!parsed.success) {
            return jsonError("กรุณาตรวจสอบข้อความตอบกลับ", 400, { success: false });
        }

        const result = await postITRequesterTicketComment(
            await buildCurrentITAuthorizationContext(auth.user),
            { ticketId, ...parsed.data },
            { idempotencyKey },
        );
        return NextResponse.json(
            { success: true, ...result },
            { status: result.replayed ? 200 : 201 },
        );
    } catch (error) {
        const expected = mapITTicketRouteError(error);
        if (expected) return expected;
        console.error("Error posting requester IT Ticket comment:", error);
        return operationFailed(500, { success: false });
    }
}
