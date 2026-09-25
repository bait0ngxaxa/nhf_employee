import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { buildCurrentITAuthorizationContext, type ITTicketMutationResult } from "@/modules/it";
import type { ITAuthorizationContext } from "@/modules/it";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";

import { mapITOperatorRouteError, parseITOperatorTicketId } from "./response";

interface SafeParseSchema<TBody extends object> {
    safeParse(value: unknown):
        | { readonly success: true; readonly data: TBody }
        | { readonly success: false };
}

type ITTicketMutation<TBody extends object> = (
    context: ITAuthorizationContext,
    input: TBody & { readonly ticketId: number },
) => Promise<ITTicketMutationResult>;

/** Adapts one strict HTTP body into an existing IT2 command. */
export async function patchITOperatorTicket<TBody extends object>(
    request: NextRequest,
    rawTicketId: string,
    schema: SafeParseSchema<TBody>,
    mutate: ITTicketMutation<TBody>,
): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;

        const ticketId = parseITOperatorTicketId(rawTicketId);
        if (ticketId === null) {
            return jsonError("รหัส Ticket ไม่ถูกต้อง", 400, { success: false });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return jsonError("รูปแบบข้อมูลไม่ถูกต้อง", 400, { success: false });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return jsonError("กรุณาตรวจสอบข้อมูลที่ส่งมา", 400, { success: false });
        }

        const context = await buildCurrentITAuthorizationContext(auth.user);
        const result = await mutate(context, { ...parsed.data, ticketId });
        return NextResponse.json({
            success: true,
            changed: result.changed,
            ticket: {
                id: result.ticket.id,
                version: result.ticket.version,
                status: result.ticket.status,
                assignedToUserId: result.ticket.assignedToUserId,
                categoryId: result.ticket.categoryId,
                updatedAt: result.ticket.updatedAt.toISOString(),
            },
        });
    } catch (error) {
        const expected = mapITOperatorRouteError(error);
        if (expected) return expected;
        console.error("Error processing IT Ticket mutation:", error);
        return operationFailed(500, { success: false });
    }
}
