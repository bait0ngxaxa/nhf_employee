import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/api";
import { jsonError, notFound, operationFailed } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { calendarYearSchema, getPublishedHolidayCalendar } from "@/modules/leave";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) return notFound();
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;
        const year = calendarYearSchema.safeParse(request.nextUrl.searchParams.get("year"));
        if (!year.success) return jsonError("กรุณาระบุปี ค.ศ. ให้ถูกต้อง", 400);
        return NextResponse.json(await getPublishedHolidayCalendar(year.data), { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        console.error("Published calendar read failed", error);
        return operationFailed();
    }
}
