import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import { buildCurrentITAuthorizationContext, getITOperatorReferenceData } from "@/modules/it";

import { mapITOperatorRouteError } from "../_lib/response";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;
        if (new URL(request.url).searchParams.size > 0) {
            return jsonError("ไม่รองรับตัวเลือกอ้างอิงที่ส่งมา", 400, { success: false });
        }

        const reference = await getITOperatorReferenceData(
            await buildCurrentITAuthorizationContext(auth.user),
        );
        return NextResponse.json({ success: true, ...reference });
    } catch (error) {
        const expected = mapITOperatorRouteError(error);
        if (expected) return expected;
        console.error("Error reading IT operator reference data:", error);
        return operationFailed(500, { success: false });
    }
}
