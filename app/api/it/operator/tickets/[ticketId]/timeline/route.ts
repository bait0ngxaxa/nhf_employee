import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import { buildCurrentITAuthorizationContext, getITOperatorTicketTimeline } from "@/modules/it";

import {
    mapITOperatorRouteError,
    parseITOperatorTicketId,
} from "../../../_lib/response";
import { readITTicketTimelineQuery } from "../../../../tickets/_lib/response";

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

        const { ticketId: rawTicketId } = await context.params;
        const ticketId = parseITOperatorTicketId(rawTicketId);
        if (ticketId === null) {
            return jsonError("รหัส Ticket ไม่ถูกต้อง", 400, { success: false });
        }
        const query = readITTicketTimelineQuery(request.nextUrl.searchParams);
        if (query === null) {
            return jsonError("เงื่อนไขประวัติ Ticket ไม่ถูกต้อง", 400, { success: false });
        }

        const timeline = await getITOperatorTicketTimeline(
            await buildCurrentITAuthorizationContext(auth.user),
            ticketId,
            query,
        );
        return NextResponse.json({ success: true, ...timeline });
    } catch (error) {
        const expected = mapITOperatorRouteError(error);
        if (expected) return expected;
        console.error("Error reading operator IT Ticket timeline:", error);
        return operationFailed(500, { success: false });
    }
}
