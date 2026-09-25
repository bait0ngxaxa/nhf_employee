import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import { buildCurrentITAuthorizationContext, getITOperatorTicket } from "@/modules/it";

import { mapITOperatorRouteError, parseITOperatorTicketId } from "../../_lib/response";

interface OperatorTicketRouteContext {
    readonly params: Promise<{ readonly ticketId: string }>;
}

export async function GET(
    _request: NextRequest,
    routeContext: OperatorTicketRouteContext,
): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;

        const { ticketId: rawTicketId } = await routeContext.params;
        const ticketId = parseITOperatorTicketId(rawTicketId);
        if (ticketId === null) {
            return jsonError("รหัส Ticket ไม่ถูกต้อง", 400, { success: false });
        }

        const ticket = await getITOperatorTicket(
            await buildCurrentITAuthorizationContext(auth.user),
            ticketId,
        );
        return NextResponse.json({ success: true, ticket });
    } catch (error) {
        const expected = mapITOperatorRouteError(error);
        if (expected) return expected;
        console.error("Error reading IT operator Ticket:", error);
        return operationFailed(500, { success: false });
    }
}
