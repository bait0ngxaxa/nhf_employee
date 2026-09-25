import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import {
    buildCurrentITAuthorizationContext,
    listITOperatorTickets,
} from "@/modules/it";

import { mapITOperatorRouteError } from "../_lib/response";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;

        const searchParams = new URL(request.url).searchParams;
        const input: Record<string, string> = {};
        let hasDuplicateKey = false;
        searchParams.forEach((value, key) => {
            if (Object.prototype.hasOwnProperty.call(input, key)) {
                hasDuplicateKey = true;
            }
            input[key] = value;
        });
        if (hasDuplicateKey) {
            return jsonError("ตัวกรองรายการ Ticket ไม่ถูกต้อง", 400, { success: false });
        }

        const result = await listITOperatorTickets(
            await buildCurrentITAuthorizationContext(auth.user),
            input,
        );
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        const expected = mapITOperatorRouteError(error);
        if (expected) return expected;
        console.error("Error listing IT operator Tickets:", error);
        return operationFailed(500, { success: false });
    }
}
