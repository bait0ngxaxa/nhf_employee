import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { calculateCalendarLeave, type CalendarLeaveCalculation, type LeaveCalculationPreview } from "../../domain/calendar-calculation";
import { getBusinessDate, toDateOnlyString, type BusinessDateInput } from "../../domain/business-date";
import { HolidayCalendarError } from "../../domain/holiday-calendar";
import { assertLeaveCapabilityScope, resolveLeaveCapabilityInTransaction, type LeaveAuthorizationContext } from "../authorization";
import { calculateEffectiveEntitlementForYearHalfDays } from "../../domain/quota-entitlement";
import { calculateAdditionalOverQuotaHalfDays } from "../../domain/over-quota";
import { ensureHolidayCalendarInTransaction } from "./defaults";

/** Explicit feature activation. Bundled verified years initialize automatically after activation. */
export function isHolidayCalendarEnforced(): boolean {
    const value = process.env.LEAVE_HOLIDAY_CALENDAR_ENABLED;
    if (value === undefined || value === "false") return false;
    if (value === "true") return true;
    throw new Error("LEAVE_HOLIDAY_CALENDAR_ENABLED must be true or false");
}

export interface EffectiveCalendarCalculation extends CalendarLeaveCalculation {
    calendarVersionId: string | null;
    calendarVersion: number | null;
    mode: LeaveCalculationPreview["mode"];
}

export async function calculateEffectiveLeaveInTransaction(
    tx: Prisma.TransactionClient,
    start: BusinessDateInput,
    end: BusinessDateInput,
    period: "FULL_DAY" | "MORNING" | "AFTERNOON",
): Promise<EffectiveCalendarCalculation> {
    if (!isHolidayCalendarEnforced()) return { ...calculateCalendarLeave(start, end, period, new Set()), calendarVersionId: null, calendarVersion: null, mode: "SETUP_WEEKDAYS" };
    const year = getBusinessDate(start).year;
    // Same annual lock as publication. Held through mutation commit, never read outside the final transaction.
    await ensureHolidayCalendarInTransaction(tx, year);
    const calendar = await tx.holidayCalendar.findUnique({ where: { year }, include: { activeVersion: { include: { days: true } } } });
    if (!calendar?.activeVersion?.publishedAt) throw new HolidayCalendarError(`ยังไม่ได้เผยแพร่ปฏิทินวันหยุดปี พ.ศ. ${year + 543} (ค.ศ. ${year}) กรุณาติดต่อผู้ดูแลระบบ`, 409);
    const version = calendar.activeVersion;
    return { ...calculateCalendarLeave(start, end, period, new Set(version.days.map((day) => toDateOnlyString(day.date)))), calendarVersionId: version.id, calendarVersion: version.number, mode: "PUBLISHED_CALENDAR" };
}

export const leaveCalculationInputSchema = z.object({
    startDate: z.iso.date(), endDate: z.iso.date(), period: z.enum(["FULL_DAY", "MORNING", "AFTERNOON"]), leaveType: z.enum(["SICK", "PERSONAL", "VACATION"]),
}).strict();

export async function previewLeaveCalculation(authorization: LeaveAuthorizationContext, raw: unknown): Promise<LeaveCalculationPreview> {
    const parsed = leaveCalculationInputSchema.safeParse(raw);
    if (!parsed.success) throw new HolidayCalendarError("ข้อมูลวันที่ลาไม่ถูกต้อง", 400);
    return runSerializableTransaction(async (tx) => {
        const access = assertLeaveCapabilityScope(await resolveLeaveCapabilityInTransaction(tx, authorization, "leave.request.create"), "OWN");
        if (access.actor.employeeId === null) throw new HolidayCalendarError("ไม่มีสิทธิ์ยื่นลา", 403);
        const { startDate, endDate, period, leaveType } = parsed.data;
        const calculation = await calculateEffectiveLeaveInTransaction(tx, startDate, endDate, period);
        if (!calculation.valid) throw new HolidayCalendarError("ช่วงวันลาไม่ถูกต้อง วันที่เริ่มและสิ้นสุดต้องเป็นวันทำงาน และไม่ลาข้ามปี", 400);
        // Read-only preview: calculate carry without creating/updating a quota row.
        const latestQuota = await tx.leaveQuota.findFirst({ where: { employeeId: access.actor.employeeId, leaveType, year: { lte: getBusinessDate(startDate).year } }, orderBy: { year: "desc" } });
        const total = calculateEffectiveEntitlementForYearHalfDays({ leaveType, year: getBusinessDate(startDate).year, latestQuota });
        const used = latestQuota?.year === getBusinessDate(startDate).year ? latestQuota.usedHalfDays : 0;
        return { ...calculation, remainingHalfDays: total - used, projectedRemainingHalfDays: total - used - calculation.durationHalfDays, overQuotaHalfDays: calculateAdditionalOverQuotaHalfDays(total, used, calculation.durationHalfDays) };
    });
}
