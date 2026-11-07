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

const ANALYTICS_QUERY_KEYS = ["period", "type", "category"] as const;
type AnalyticsQueryKey = (typeof ANALYTICS_QUERY_KEYS)[number];

function isAnalyticsQueryKey(key: string): key is AnalyticsQueryKey {
    return (ANALYTICS_QUERY_KEYS as readonly string[]).includes(key);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => unauthorized({ success: false }),
            forbiddenResponse: () => forbidden({ success: false }),
        });
        if (!auth.ok) return auth.response;

        const searchParams = new URL(request.url).searchParams;
        const query: Partial<Record<AnalyticsQueryKey, string>> = {};
        let invalidQuery = false;
        searchParams.forEach((value, key) => {
            if (!isAnalyticsQueryKey(key) || query[key] !== undefined) {
                invalidQuery = true;
                return;
            }
            query[key] = value;
        });
        if (invalidQuery) {
            return jsonError("พารามิเตอร์รายงาน IT ไม่ถูกต้อง", 400, { success: false });
        }

        const dashboard = await getITAnalyticsDashboard(
            await buildCurrentITAuthorizationContext(auth.user),
            query,
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
