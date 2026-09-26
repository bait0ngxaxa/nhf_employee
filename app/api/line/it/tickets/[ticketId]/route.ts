import { type NextRequest, NextResponse } from "next/server";

import { jsonError, operationFailed } from "@/lib/ssot/http";
import { requireLiffWorkforceSession } from "@/modules/line";
import {
    buildITAuthorizationContext,
    getITRequesterTicket,
    logITTicketRouteFailure,
    mapITTicketRouteError,
    parseITRequesterTicketId,
} from "@/modules/it";

interface RouteContext {
    readonly params: Promise<{ readonly ticketId: string }>;
}

export async function GET(
    _request: NextRequest,
    { params }: RouteContext,
): Promise<NextResponse> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        const ticketId = parseITRequesterTicketId((await params).ticketId);
        if (ticketId === null) {
            return jsonError("หมายเลข Ticket ไม่ถูกต้อง", 400, { success: false });
        }
        const ticket = await getITRequesterTicket(
            buildITAuthorizationContext(auth.user, auth.employeeId, "LIFF_SELF_SERVICE"),
            ticketId,
        );
        return NextResponse.json({ success: true, ticket });
    } catch (error) {
        const expected = mapITTicketRouteError(error);
        if (expected) return expected;
        logITTicketRouteFailure("Error fetching LIFF IT Ticket", error);
        return operationFailed(500, { success: false });
    }
}
