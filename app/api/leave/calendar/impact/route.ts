import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth/api";
import { jsonError, notFound, operationFailed } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { getCalendarImpact, HolidayCalendarError } from "@/modules/leave";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) return notFound();
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;
        const params = request.nextUrl.searchParams;
        const result = await getCalendarImpact({ userId: auth.user.id, channel: "DASHBOARD" }, { year: params.get("year"), versionId: params.get("versionId"), ...(params.has("cursor") ? { cursor: params.get("cursor") } : {}) });
        return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        if (error instanceof HolidayCalendarError) return jsonError(error.message, error.statusCode);
        console.error("Calendar impact read failed", error);
        return operationFailed();
    }
}
