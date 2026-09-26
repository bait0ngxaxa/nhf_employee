import { type NextRequest, NextResponse } from "next/server";

import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { scheduleITTicketOutboxWakeup } from "@/lib/server/it-ticket-outbox-wakeup";
import { jsonError, operationFailed } from "@/lib/ssot/http";
import { idempotencyKeySchema } from "@/lib/validations/idempotency";
import { requireLiffWorkforceSession } from "@/modules/line";
import {
    buildITAuthorizationContext,
    createITTicket,
    createITTicketInputSchema,
    IT_TICKET_LIST_DEFAULT_LIMIT,
    IT_TICKET_LIST_DEFAULT_PAGE,
    listITRequesterTickets,
    logITTicketRouteFailure,
    mapITTicketRouteError,
    toITRequesterTicket,
} from "@/modules/it";

export async function GET(request: NextRequest): Promise<NextResponse> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const result = await listITRequesterTickets(
            buildITAuthorizationContext(auth.user, auth.employeeId, "LIFF_SELF_SERVICE"),
            {
                page: searchParams.get("page") ?? IT_TICKET_LIST_DEFAULT_PAGE,
                limit: searchParams.get("limit") ?? IT_TICKET_LIST_DEFAULT_LIMIT,
            },
        );
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        const expected = mapITTicketRouteError(error);
        if (expected) return expected;
        logITTicketRouteFailure("Error listing LIFF IT Tickets", error);
        return operationFailed(500, { success: false });
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const preAuthLimit = enforcePreAuthIpRateLimit(request, "it-ticket-create");
    if (preAuthLimit) return preAuthLimit;

    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    const principalLimit = enforceAuthenticatedMutationRateLimit(
        "it-ticket-create",
        auth.user.id,
    );
    if (principalLimit) return principalLimit;

    const idempotencyKey = idempotencyKeySchema.safeParse(
        request.headers.get("Idempotency-Key"),
    );
    if (!idempotencyKey.success) {
        return jsonError("กรุณาระบุ Idempotency-Key ที่ถูกต้อง", 400, { success: false });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return jsonError("รูปแบบข้อมูลไม่ถูกต้อง", 400, { success: false });
    }
    const parsed = createITTicketInputSchema.safeParse(body);
    if (!parsed.success) {
        return jsonError("กรุณาตรวจสอบประเภท หัวข้อ และรายละเอียด Ticket", 400, {
            success: false,
        });
    }
    try {
        const result = await createITTicket(
            buildITAuthorizationContext(auth.user, auth.employeeId, "LIFF_SELF_SERVICE"),
            parsed.data,
            { idempotencyKey: idempotencyKey.data },
        );
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
        logITTicketRouteFailure("Error creating LIFF IT Ticket", error);
        return operationFailed(500, { success: false });
    }
}
