import {
    addCalendarDays,
    compareBusinessDates,
    getBusinessDayOfWeek,
    getCalendarDaysDifference,
    toUtcDate,
    type BusinessDateInput,
} from "@/lib/services/leave/business-date";

export type LeavePeriodValue = "FULL_DAY" | "MORNING" | "AFTERNOON";

export const EMERGENCY_BACKDATE_LIMIT_DAYS = 7;

export type { BusinessDateInput } from "@/lib/services/leave/business-date";

export function getStartOfDay(date: BusinessDateInput): Date {
    return toUtcDate(date);
}

export function isWorkingDay(date: BusinessDateInput): boolean {
    const dayOfWeek = getBusinessDayOfWeek(date);
    return dayOfWeek !== 0 && dayOfWeek !== 6;
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
): number {
    let count = 0;
    let current: BusinessDateInput = startDate;

    while (compareBusinessDates(current, endDate) <= 0) {
        if (isWorkingDay(current)) {
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
): number {
    const workingDays = getWorkingDays(startDate, endDate);
    if (period === "FULL_DAY") {
        return workingDays;
    }
    return workingDays === 0 ? 0 : 0.5;
}

export function calculateLeaveDurationHalfDays(
    startDate: BusinessDateInput,
    endDate: BusinessDateInput,
    period: LeavePeriodValue,
): number {
    const workingDays = getWorkingDays(startDate, endDate);
    if (period === "FULL_DAY") {
        return workingDays * 2;
    }
    return workingDays === 0 ? 0 : 1;
}
