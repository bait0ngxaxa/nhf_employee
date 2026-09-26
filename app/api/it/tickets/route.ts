import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import {
    buildCurrentITAuthorizationContext,
    createITTicket,
    createITTicketInputSchema,
    IT_TICKET_LIST_DEFAULT_LIMIT,
    IT_TICKET_LIST_DEFAULT_PAGE,
    listITRequesterTickets,
    logITTicketRouteFailure,
    mapITTicketRouteError,
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

        const context = await buildCurrentITAuthorizationContext(auth.user);
        const result = await createITTicket(context, parsed.data, {
            idempotencyKey: idempotencyKey.data,
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
