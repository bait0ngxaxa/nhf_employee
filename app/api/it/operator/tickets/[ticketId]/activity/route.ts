import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import {
    buildCurrentITAuthorizationContext,
    getITOperatorTicketActivity,
    readITTicketHistoryQuery,
} from "@/modules/it";

import {
    mapITOperatorRouteError,
    parseITOperatorTicketId,
} from "../../../_lib/response";

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

        const ticketId = parseITOperatorTicketId((await context.params).ticketId);
        if (ticketId === null) {
            return jsonError("รหัส Ticket ไม่ถูกต้อง", 400, { success: false });
        }
        const query = readITTicketHistoryQuery(request.nextUrl.searchParams);
        if (query === null) {
            return jsonError("เงื่อนไขประวัติการดำเนินการไม่ถูกต้อง", 400, { success: false });
        }
        const page = await getITOperatorTicketActivity(
            await buildCurrentITAuthorizationContext(auth.user),
            ticketId,
            query,
        );
        return NextResponse.json({ success: true, ...page });
    } catch (error) {
        const expected = mapITOperatorRouteError(error);
        if (expected) return expected;
        console.error("Error reading operator IT Ticket activity:", error);
        return operationFailed(500, { success: false });
    }
}
