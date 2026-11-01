import { NextResponse } from "next/server";
import { getHolidayReference } from "../application/queries/holiday-reference";
import { getCurrentLeaveYear } from "../domain/quota-year";
import { HolidayReferenceError } from "../infrastructure/holidays/google-holiday-reference";

export async function getHolidayReferenceResponse(): Promise<NextResponse> {
    const headers = { "Cache-Control": "private, no-store" };
    try {
        return NextResponse.json(await getHolidayReference(getCurrentLeaveYear()), { headers });
    } catch (error) {
        const reason = error instanceof HolidayReferenceError ? error.reason : "network";
        console.error("Holiday reference unavailable", { reason });
        return NextResponse.json({
            error: "ไม่สามารถโหลดข้อมูลวันหยุดได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
            code: reason === "incomplete" ? "HOLIDAY_DATA_INCOMPLETE" : "HOLIDAY_SOURCE_UNAVAILABLE",
        }, { status: 503, headers });
    }
}
