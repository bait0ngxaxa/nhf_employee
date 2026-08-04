import {
    calendarDayDifference,
    type CalendarDate,
} from "./schedule";

export const ROUTINE_TIMING_STATUSES = [
    "OVERDUE",
    "DUE_TODAY",
    "DUE_SOON",
    "UPCOMING",
] as const;

export type RoutineTimingStatus = (typeof ROUTINE_TIMING_STATUSES)[number];

export function getRoutineTimingStatus(
    today: CalendarDate,
    dueDate: CalendarDate,
): RoutineTimingStatus {
    const daysUntilDue = calendarDayDifference(today, dueDate);
    if (daysUntilDue < 0) return "OVERDUE";
    if (daysUntilDue === 0) return "DUE_TODAY";
    if (daysUntilDue <= 7) return "DUE_SOON";
    return "UPCOMING";
}

