import {
    IT_ANALYTICS_PERIODS,
    IT_ANALYTICS_TIME_ZONE,
    type ITAnalyticsPeriod,
} from "../contracts";

export interface ITAnalyticsPeriodBounds {
    readonly key: ITAnalyticsPeriod;
    readonly startAt: Date;
    readonly endAt: Date;
    readonly dates: readonly string[];
}

interface CalendarDate {
    readonly year: number;
    readonly month: number;
    readonly day: number;
}

const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
    timeZone: IT_ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
});

function getCalendarParts(date: Date): CalendarDate & {
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
} {
    if (!Number.isFinite(date.getTime())) {
        throw new RangeError("Analytics date must be valid");
    }

    const parts = LOCAL_DATE_FORMATTER.formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    return {
        year: Number(values.get("year")),
        month: Number(values.get("month")),
        day: Number(values.get("day")),
        hour: Number(values.get("hour")),
        minute: Number(values.get("minute")),
        second: Number(values.get("second")),
    };
}

function formatCalendarDate(date: CalendarDate): string {
    return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
    const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
    };
}

/** Converts local midnight into an instant without spreading offset arithmetic. */
function getLocalMidnight(date: CalendarDate): Date {
    const targetAsUtc = Date.UTC(date.year, date.month - 1, date.day);
    let estimate = targetAsUtc;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const local = getCalendarParts(new Date(estimate));
        const representedAsUtc = Date.UTC(
            local.year,
            local.month - 1,
            local.day,
            local.hour,
            local.minute,
            local.second,
        );
        const correction = targetAsUtc - representedAsUtc;
        estimate += correction;
        if (correction === 0) break;
    }

    return new Date(estimate);
}

export function isITAnalyticsPeriod(value: string): value is ITAnalyticsPeriod {
    return (IT_ANALYTICS_PERIODS as readonly string[]).includes(value);
}

export function getITAnalyticsLocalDate(date: Date): string {
    return formatCalendarDate(getCalendarParts(date));
}

export function getITAnalyticsPeriodBounds(
    key: ITAnalyticsPeriod,
    now: Date,
): ITAnalyticsPeriodBounds {
    const today = getCalendarParts(now);
    const days = Number.parseInt(key, 10);
    const firstDay = addCalendarDays(today, -(days - 1));
    const dates = Array.from({ length: days }, (_, index) =>
        formatCalendarDate(addCalendarDays(firstDay, index)),
    );

    return {
        key,
        startAt: getLocalMidnight(firstDay),
        endAt: new Date(now),
        dates,
    };
}
