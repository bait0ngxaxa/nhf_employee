import {
    addCalendarDays,
    compareBusinessDates,
    getBusinessDayOfWeek,
    getCalendarDaysDifference,
    isValidDateOnly,
    toUtcDate,
    toDateOnlyString,
    type BusinessDateInput,
} from "@/modules/leave/domain/business-date";
import { getLeaveYearFromDateValue } from "./quota-year";

export type LeavePeriodValue = "FULL_DAY" | "MORNING" | "AFTERNOON";

interface LeaveOccupancy {
    startDate: BusinessDateInput;
    endDate: BusinessDateInput;
    period: LeavePeriodValue;
}

export function doLeaveRequestsOverlap(
    existing: LeaveOccupancy,
    requested: LeaveOccupancy,
): boolean {
    if (
        compareBusinessDates(existing.startDate, requested.endDate) > 0
        || compareBusinessDates(existing.endDate, requested.startDate) < 0
    ) {
        return false;
    }
    return existing.period === "FULL_DAY"
        || requested.period === "FULL_DAY"
        || existing.period === requested.period;
}

export const EMERGENCY_BACKDATE_LIMIT_DAYS = 7;

export type { BusinessDateInput } from "@/modules/leave/domain/business-date";

export type LeaveDateRangeIssue = "invalid" | "reversed" | "cross-year";

export function getLeaveDateRangeIssue(
    startDate: string,
    endDate: string,
): LeaveDateRangeIssue | null {
    if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) {
        return "invalid";
    }
    if (compareBusinessDates(endDate, startDate) < 0) {
        return "reversed";
    }
    if (getLeaveYearFromDateValue(startDate) !== getLeaveYearFromDateValue(endDate)) {
        return "cross-year";
    }
    return null;
}

export function getStartOfDay(date: BusinessDateInput): Date {
    return toUtcDate(date);
}

export function isWorkingDay(date: BusinessDateInput, holidays?: ReadonlySet<string>): boolean {
    const dayOfWeek = getBusinessDayOfWeek(date);
    return dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays?.has(toDateOnlyString(date));
}

export function isPastDate(
    date: BusinessDateInput,
    today: BusinessDateInput = new Date(),
): boolean {
    return compareBusinessDates(date, today) < 0;
}

export function isBeforeLeaveStart(
    date: BusinessDateInput,
    today: BusinessDateInput = new Date(),
): boolean {
    return compareBusinessDates(date, today) > 0;
}

export function isAfterLeaveEnd(
    endDate: BusinessDateInput,
    today: BusinessDateInput = new Date(),
): boolean {
    return compareBusinessDates(today, endDate) > 0;
}

export function getCalendarDaysAgo(
    date: BusinessDateInput,
    today: BusinessDateInput = new Date(),
): number {
    return getCalendarDaysDifference(today, date);
}

export function isWithinEmergencyBackdateWindow(
    date: BusinessDateInput,
    today: BusinessDateInput = new Date(),
): boolean {
    const daysAgo = getCalendarDaysAgo(date, today);
    return daysAgo >= 1 && daysAgo <= EMERGENCY_BACKDATE_LIMIT_DAYS;
}

export function getWorkingDays(
    startDate: BusinessDateInput,
    endDate: BusinessDateInput,
    holidays?: ReadonlySet<string>,
): number {
    let count = 0;
    let current: BusinessDateInput = startDate;

    while (compareBusinessDates(current, endDate) <= 0) {
        if (isWorkingDay(current, holidays)) {
            count++;
        }
        current = addCalendarDays(current, 1);
    }

    return count;
}

export function calculateLeaveDuration(
    startDate: BusinessDateInput,
    endDate: BusinessDateInput,
    period: LeavePeriodValue,
    holidays?: ReadonlySet<string>,
): number {
    const workingDays = getWorkingDays(startDate, endDate, holidays);
    if (period === "FULL_DAY") {
        return workingDays;
    }
    return workingDays === 0 ? 0 : 0.5;
}

export function calculateLeaveDurationHalfDays(
    startDate: BusinessDateInput,
    endDate: BusinessDateInput,
    period: LeavePeriodValue,
    holidays?: ReadonlySet<string>,
): number {
    const workingDays = getWorkingDays(startDate, endDate, holidays);
    if (period === "FULL_DAY") {
        return workingDays * 2;
    }
    return workingDays === 0 ? 0 : 1;
}
