import { type NextRequest, NextResponse } from "next/server";

import { jsonError, operationFailed } from "@/lib/ssot/http";
import { requireLiffWorkforceSession } from "@/modules/line";
import {
    buildITAuthorizationContext,
    getITRequesterTicketActivity,
    logITTicketRouteFailure,
    mapITTicketRouteError,
    parseITRequesterTicketId,
    readITTicketHistoryQuery,
} from "@/modules/it";

interface RouteContext {
    readonly params: Promise<{ readonly ticketId: string }>;
}

export async function GET(
    request: NextRequest,
    { params }: RouteContext,
): Promise<NextResponse> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        const ticketId = parseITRequesterTicketId((await params).ticketId);
        if (ticketId === null) {
            return jsonError("หมายเลข Ticket ไม่ถูกต้อง", 400, { success: false });
        }
        const query = readITTicketHistoryQuery(request.nextUrl.searchParams);
        if (query === null) {
            return jsonError("เงื่อนไขประวัติการดำเนินการไม่ถูกต้อง", 400, { success: false });
        }
        const page = await getITRequesterTicketActivity(
            buildITAuthorizationContext(auth.user, auth.employeeId, "LIFF_SELF_SERVICE"),
            ticketId,
            query,
        );
        return NextResponse.json({ success: true, ...page });
    } catch (error) {
        const expected = mapITTicketRouteError(error);
        if (expected) return expected;
        logITTicketRouteFailure("Error reading LIFF IT Ticket activity", error);
        return operationFailed(500, { success: false });
    }
}
