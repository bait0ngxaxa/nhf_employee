import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import {
    buildCurrentITAuthorizationContext,
    getITAnalyticsDashboard,
    ITAnalyticsInputValidationError,
    ITCapabilityDeniedError,
    ITWorkforceDeniedError,
} from "@/modules/it";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;

        const searchParams = new URL(request.url).searchParams;
        let period: string | undefined;
        let invalidQuery = false;
        let periodSeen = false;
        searchParams.forEach((value, key) => {
            if (key !== "period" || periodSeen) {
                invalidQuery = true;
                return;
            }
            periodSeen = true;
            period = value;
        });
        if (invalidQuery) {
            return jsonError("พารามิเตอร์รายงาน IT ไม่ถูกต้อง", 400, { success: false });
        }

        const dashboard = await getITAnalyticsDashboard(
            await buildCurrentITAuthorizationContext(auth.user),
            period,
        );
        return NextResponse.json({ success: true, dashboard });
    } catch (error) {
        if (error instanceof ITAnalyticsInputValidationError) {
            return jsonError(error.message, 400, { success: false });
        }
        if (error instanceof ITCapabilityDeniedError || error instanceof ITWorkforceDeniedError) {
            return forbidden({ success: false });
        }
        console.error("Error reading IT analytics:", error);
        return operationFailed(500, { success: false });
    }
}
