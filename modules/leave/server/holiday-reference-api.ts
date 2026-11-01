import { NextResponse } from "next/server";
import { getHolidayReference } from "../application/queries/holiday-reference";
import { getCurrentLeaveYear } from "../domain/quota-year";
import { HolidayReferenceError } from "../infrastructure/holidays/google-holiday-reference";
import { isSupportedHolidayYear } from "../schemas/holiday-reference";

export async function getHolidayReferenceResponse(request?: Request): Promise<NextResponse> {
    const headers = { "Cache-Control": "private, no-store" };
    const value = request ? new URL(request.url).searchParams.getAll("year") : [];
    const year = value.length ? Number(value[0]) : getCurrentLeaveYear();
    if (value.length > 1 || (value.length && !/^\d{4}$/.test(value[0])) || !isSupportedHolidayYear(year, getCurrentLeaveYear())) {
        return NextResponse.json({ error: "ปีข้อมูลวันหยุดไม่อยู่ในช่วงที่รองรับ" }, { status: 400, headers });
    }
    try {
        return NextResponse.json(await getHolidayReference(year), { headers });
    } catch (error) {
        const reason = error instanceof HolidayReferenceError ? error.reason : "network";
        console.error("Holiday reference unavailable", { reason });
        return NextResponse.json({
            error: "ไม่สามารถโหลดข้อมูลวันหยุดได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
            code: reason === "incomplete" ? "HOLIDAY_DATA_INCOMPLETE" : "HOLIDAY_SOURCE_UNAVAILABLE",
        }, { status: 503, headers });
    }
}
