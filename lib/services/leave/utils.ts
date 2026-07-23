export type LeavePeriodValue = "FULL_DAY" | "MORNING" | "AFTERNOON";

export const EMERGENCY_BACKDATE_LIMIT_DAYS = 7;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getStartOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
}

export function isWorkingDay(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6;
}

export function isPastDate(date: Date, today: Date = new Date()): boolean {
    return getStartOfDay(date) < getStartOfDay(today);
}

export function isAfterLeaveEnd(endDate: Date, today: Date = new Date()): boolean {
    return getStartOfDay(today) > getStartOfDay(endDate);
}

export function getCalendarDaysAgo(date: Date, today: Date = new Date()): number {
    const diff = getStartOfDay(today).getTime() - getStartOfDay(date).getTime();
    return Math.floor(diff / MILLISECONDS_PER_DAY);
}

export function isWithinEmergencyBackdateWindow(
    date: Date,
    today: Date = new Date(),
): boolean {
    const daysAgo = getCalendarDaysAgo(date, today);
    return daysAgo >= 1 && daysAgo <= EMERGENCY_BACKDATE_LIMIT_DAYS;
}

export function getWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = getStartOfDay(startDate);
    const matchEndDate = getStartOfDay(endDate);

    while (current <= matchEndDate) {
        if (isWorkingDay(current)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}

export function calculateLeaveDuration(
    startDate: Date,
    endDate: Date,
    period: LeavePeriodValue,
): number {
    const workingDays = getWorkingDays(startDate, endDate);
    if (period === "FULL_DAY") {
        return workingDays;
    }
    return workingDays === 0 ? 0 : 0.5;
}

export function calculateLeaveDurationHalfDays(
    startDate: Date,
    endDate: Date,
    period: LeavePeriodValue,
): number {
    const workingDays = getWorkingDays(startDate, endDate);
    if (period === "FULL_DAY") {
        return workingDays * 2;
    }
    return workingDays === 0 ? 0 : 1;
}
