import { NextResponse } from "next/server";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import { HolidayCalendarError } from "../domain/holiday-calendar";
import { LeaveCapabilityDeniedError, type LeaveAuthorizationContext } from "../application/authorization";
import { previewLeaveCalculation } from "../application/calendar/calculation";
import { jsonError } from "@/lib/ssot/http";

export async function handleLeaveCalculationPreview(request: Request, authorization: LeaveAuthorizationContext): Promise<NextResponse> {
    try {
        const params = new URL(request.url).searchParams;
        const result = await previewLeaveCalculation(authorization, { startDate: params.get("startDate"), endDate: params.get("endDate"), period: params.get("period"), leaveType: params.get("leaveType") });
        return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        if (error instanceof HolidayCalendarError) return jsonError(error.message, error.statusCode);
        if (error instanceof LeaveCapabilityDeniedError || error instanceof WorkforceAuthorizationError) return jsonError("คุณไม่มีสิทธิ์คำนวณคำขอลา", 403);
        console.error("Leave calendar preview failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        return jsonError("คำนวณวันลาไม่สำเร็จ กรุณาลองใหม่", 500);
    }
}
