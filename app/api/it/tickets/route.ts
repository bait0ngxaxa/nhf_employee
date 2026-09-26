import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import {
    buildCurrentITAuthorizationContext,
    createITTicket,
    IT_TICKET_LIST_DEFAULT_LIMIT,
    IT_TICKET_LIST_DEFAULT_PAGE,
    listITRequesterTickets,
    logITTicketRouteFailure,
    mapITTicketRouteError,
    getITTicketCreateMediaType,
    isITTicketCreateParseFailure,
    parseITTicketCreateHttpInput,
    toITRequesterTicket,
} from "@/modules/it";
import { idempotencyKeySchema } from "@/lib/validations/idempotency";
import { scheduleITTicketOutboxWakeup } from "@/lib/server/it-ticket-outbox-wakeup";

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;
        const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "it-ticket-create",
            auth.user.id,
        );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const idempotencyKey = idempotencyKeySchema.safeParse(
            request.headers.get("Idempotency-Key"),
        );
        if (!idempotencyKey.success) {
            return jsonError("กรุณาระบุ Idempotency-Key ที่ถูกต้อง", 400, { success: false });
        }

        const mediaType = getITTicketCreateMediaType(request);
        if (mediaType === "unsupported") {
            return jsonError("รูปแบบข้อมูลไม่ถูกต้อง", 415, { success: false });
        }
        const parsed = await parseITTicketCreateHttpInput(request, mediaType);
        if (isITTicketCreateParseFailure(parsed)) return parsed;

        const context = await buildCurrentITAuthorizationContext(auth.user);
        const result = await createITTicket(context, parsed.input, {
            idempotencyKey: idempotencyKey.data,
            ...(parsed.attachments.length > 0 ? { attachments: parsed.attachments } : {}),
        });
        if (!result.replayed) scheduleITTicketOutboxWakeup();

        return NextResponse.json(
            {
                success: true,
                ticket: toITRequesterTicket(result.ticket),
                replayed: result.replayed,
            },
            { status: result.replayed ? 200 : 201 },
        );
    } catch (error) {
        const expected = mapITTicketRouteError(error);
        if (expected) return expected;
        logITTicketRouteFailure("Error creating IT Ticket", error);
        return operationFailed(500, { success: false });
    }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;

        const { searchParams } = new URL(request.url);
        const result = await listITRequesterTickets(
            await buildCurrentITAuthorizationContext(auth.user),
            {
                page: searchParams.get("page") ?? IT_TICKET_LIST_DEFAULT_PAGE,
                limit: searchParams.get("limit") ?? IT_TICKET_LIST_DEFAULT_LIMIT,
            },
        );
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        const expected = mapITTicketRouteError(error);
        if (expected) return expected;
        logITTicketRouteFailure("Error listing IT Tickets", error);
        return operationFailed(500, { success: false });
    }
}
