import type { NextRequest, NextResponse } from "next/server";

import { assignITTicket, assignITTicketBodySchema } from "@/modules/it";

import { patchITOperatorTicket } from "../../../_lib/mutation";

interface OperatorTicketRouteContext {
    readonly params: Promise<{ readonly ticketId: string }>;
}

export async function PATCH(
    request: NextRequest,
    routeContext: OperatorTicketRouteContext,
): Promise<NextResponse> {
    const { ticketId } = await routeContext.params;
    return patchITOperatorTicket(
        request,
        ticketId,
        assignITTicketBodySchema,
        assignITTicket,
        {
            shouldWakeOutbox: (input, actorUserId) =>
                "assigneeUserId" in input
                && typeof input.assigneeUserId === "number"
                && input.assigneeUserId !== actorUserId,
        },
    );
}
