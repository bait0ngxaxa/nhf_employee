import {
    addCalendarDays,
    compareBusinessDates,
    getBusinessDayOfWeek,
    getCalendarDaysDifference,
    isValidDateOnly,
    toUtcDate,
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

export interface LeaveDurationBreakdown {
    calendarDays: number;
    weekendDays: number;
    workingDays: number;
    requestedDays: number;
}

export type LeaveSelectionResult =
    | { valid: true; breakdown: LeaveDurationBreakdown }
    | { valid: false; issue: LeaveDateRangeIssue | "half-day-multi-date" | "weekend-single" | "weekend-start" | "weekend-end" | "weekend-both" | "no-working-days"; message: string };

export function evaluateLeaveSelection(
    startDate: string,
    endDate: string,
    period: LeavePeriodValue,
): LeaveSelectionResult {
    const rangeIssue = getLeaveDateRangeIssue(startDate, endDate);
    if (rangeIssue) {
        const messages = {
            invalid: "กรุณาระบุวันที่ลาให้ถูกต้อง",
            reversed: "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น",
            "cross-year": "ไม่สามารถลาข้ามปีได้ กรุณาแยกคำขอเป็นคนละปี",
        };
        return { valid: false, issue: rangeIssue, message: messages[rangeIssue] };
    }
    if (period !== "FULL_DAY" && startDate !== endDate) {
        return { valid: false, issue: "half-day-multi-date", message: "การลาครึ่งวันต้องเลือกวันลาเพียงวันเดียว" };
    }
    const workingDays = getWorkingDays(startDate, endDate);
    const startWeekend = !isWorkingDay(startDate);
    const endWeekend = !isWorkingDay(endDate);
    if (startDate === endDate && startWeekend) {
        return { valid: false, issue: "weekend-single", message: "วันที่ลาเป็นวันเสาร์หรือวันอาทิตย์ กรุณาเลือกวันทำงาน" };
    }
    if (workingDays === 0) {
        return { valid: false, issue: "no-working-days", message: "ช่วงวันที่เลือกไม่มีวันทำงาน กรุณาเลือกวันใหม่" };
    }
    if (startWeekend && endWeekend) {
        return { valid: false, issue: "weekend-both", message: "วันเริ่มต้นและวันสิ้นสุดเป็นวันเสาร์หรือวันอาทิตย์ กรุณาเลือกวันทำงาน" };
    }
    if (startWeekend || endWeekend) {
        return {
            valid: false,
            issue: startWeekend ? "weekend-start" : "weekend-end",
            message: startWeekend ? "วันเริ่มต้นเป็นวันเสาร์หรือวันอาทิตย์ กรุณาเลือกวันทำงาน" : "วันสิ้นสุดเป็นวันเสาร์หรือวันอาทิตย์ กรุณาเลือกวันทำงาน",
        };
    }
    const calendarDays = getCalendarDaysDifference(endDate, startDate) + 1;
    return {
        valid: true,
        breakdown: {
            calendarDays,
            weekendDays: calendarDays - workingDays,
            workingDays,
            requestedDays: calculateLeaveDuration(startDate, endDate, period),
        },
    };
}

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
