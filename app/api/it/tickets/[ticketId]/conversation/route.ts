import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import {
    buildCurrentITAuthorizationContext,
    getITRequesterTicketConversation,
    logITTicketRouteFailure,
    mapITTicketRouteError,
    parseITRequesterTicketId,
    readITTicketHistoryQuery,
} from "@/modules/it";

export async function GET(
    request: NextRequest,
    context: { readonly params: Promise<{ readonly ticketId: string }> },
): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;

        const ticketId = parseITRequesterTicketId((await context.params).ticketId);
        if (ticketId === null) {
            return jsonError("หมายเลข Ticket ไม่ถูกต้อง", 400, { success: false });
        }
        const query = readITTicketHistoryQuery(request.nextUrl.searchParams);
        if (query === null) {
            return jsonError("เงื่อนไขการสนทนาไม่ถูกต้อง", 400, { success: false });
        }
        const page = await getITRequesterTicketConversation(
            await buildCurrentITAuthorizationContext(auth.user),
            ticketId,
            query,
        );
        return NextResponse.json({ success: true, ...page });
    } catch (error) {
        const expected = mapITTicketRouteError(error);
        if (expected) return expected;
        logITTicketRouteFailure("Error reading requester IT Ticket conversation", error);
        return operationFailed(500, { success: false });
    }
}
