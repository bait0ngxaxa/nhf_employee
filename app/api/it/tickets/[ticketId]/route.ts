import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import {
    buildCurrentITAuthorizationContext,
    getITRequesterTicket,
} from "@/modules/it";

import { mapITTicketRouteError } from "../_lib/response";

export async function GET(
    _request: NextRequest,
    context: { readonly params: Promise<{ readonly ticketId: string }> },
): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;

        const { ticketId: rawTicketId } = await context.params;
        if (!/^[1-9]\d*$/.test(rawTicketId)) {
            return jsonError("หมายเลข Ticket ไม่ถูกต้อง", 400, { success: false });
        }
        const ticketId = Number(rawTicketId);
        if (!Number.isSafeInteger(ticketId)) {
            return jsonError("หมายเลข Ticket ไม่ถูกต้อง", 400, { success: false });
        }

        const ticket = await getITRequesterTicket(
            await buildCurrentITAuthorizationContext(auth.user),
            ticketId,
        );
        return NextResponse.json({ success: true, ticket });
    } catch (error) {
        const expected = mapITTicketRouteError(error);
        if (expected) return expected;
        console.error("Error fetching IT Ticket:", error);
        return operationFailed(500, { success: false });
    }
}
