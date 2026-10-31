import type { ReactElement } from "react";

import { getCalendarDaysDifference, toDateOnlyString } from "../domain/business-date";
import { getWorkingDays } from "../domain/utils";
import type { LeavePeriodValue } from "./types";

interface LeaveStoredDurationExplanationProps {
    startDate: string;
    endDate: string;
    period: LeavePeriodValue;
    durationDays: number;
}

export function LeaveStoredDurationExplanation({
    startDate,
    endDate,
    period,
    durationDays,
}: LeaveStoredDurationExplanationProps): ReactElement | null {
    const breakdown = getStoredBreakdown(startDate, endDate, period, durationDays);
    if (!breakdown) return null;
    return (
        <p className="mt-1 text-xs leading-5 text-content-secondary">
            จำนวนวันตามปฏิทิน {breakdown.calendarDays} วัน − วันเสาร์–อาทิตย์ {breakdown.weekendDays} วัน = วันลาที่นับ {durationDays} วัน
        </p>
    );
}

function getStoredBreakdown(startDate: string, endDate: string, period: LeavePeriodValue, durationDays: number): { calendarDays: number; weekendDays: number } | null {
    if (period !== "FULL_DAY") return null;
    try {
        const start = toDateOnlyString(startDate);
        const end = toDateOnlyString(endDate);
        const calendarDays = getCalendarDaysDifference(end, start) + 1;
        if (calendarDays <= 1) return null;
        const workingDays = getWorkingDays(start, end);
        const weekendDays = calendarDays - workingDays;
        if (weekendDays <= 0 || workingDays !== durationDays) return null;
        return { calendarDays, weekendDays };
    } catch {
        return null;
    }
}
