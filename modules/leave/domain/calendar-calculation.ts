import { toDateOnlyString, type BusinessDateInput } from "./business-date";
import { calculateLeaveDurationHalfDays, getLeaveDateRangeIssue, isWorkingDay, type LeavePeriodValue } from "./utils";

export interface CalendarLeaveCalculation {
    durationHalfDays: number;
    valid: boolean;
}

/** Full-range evaluation is also used for impact analysis; invalid endpoints do not erase interior units. */
export function calculateCalendarLeave(
    start: BusinessDateInput,
    end: BusinessDateInput,
    period: LeavePeriodValue,
    holidays: ReadonlySet<string>,
): CalendarLeaveCalculation {
    const startDate = toDateOnlyString(start);
    const endDate = toDateOnlyString(end);
    if (getLeaveDateRangeIssue(startDate, endDate) || (period !== "FULL_DAY" && startDate !== endDate)) return { durationHalfDays: 0, valid: false };
    const durationHalfDays = calculateLeaveDurationHalfDays(startDate, endDate, period, holidays);
    return { durationHalfDays, valid: durationHalfDays > 0 && isWorkingDay(startDate, holidays) && isWorkingDay(endDate, holidays) };
}

export interface LeaveCalculationPreview {
    durationHalfDays: number;
    holidayDates?: string[];
    calendarVersionId: string | null;
    calendarVersion: number | null;
    mode: "PUBLISHED_CALENDAR" | "SETUP_WEEKDAYS";
    remainingHalfDays: number;
    projectedRemainingHalfDays: number;
    overQuotaHalfDays: number;
}
