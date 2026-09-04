export const LEAVE_BUSINESS_TIME_ZONE = "Asia/Bangkok";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const BUSINESS_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
    timeZone: LEAVE_BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

export interface BusinessDate {
    readonly year: number;
    readonly month: number;
    readonly day: number;
}

export type BusinessDateInput = Date | string | BusinessDate;

function createUtcDate(value: BusinessDate): Date {
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(value.year, value.month - 1, value.day);
    return date;
}

function validateBusinessDate(value: BusinessDate): BusinessDate {
    if (
        !Number.isInteger(value.year)
        || !Number.isInteger(value.month)
        || !Number.isInteger(value.day)
        || value.month < 1
        || value.month > 12
        || value.day < 1
    ) {
        throw new RangeError("Invalid leave date");
    }

    const date = createUtcDate(value);
    if (
        date.getUTCFullYear() !== value.year
        || date.getUTCMonth() !== value.month - 1
        || date.getUTCDate() !== value.day
    ) {
        throw new RangeError("Invalid leave date");
    }

    return {
        year: value.year,
        month: value.month,
        day: value.day,
    };
}

function isBusinessDate(value: BusinessDateInput): value is BusinessDate {
    return (
        typeof value === "object"
        && value !== null
        && !(value instanceof Date)
        && Number.isInteger(value.year)
        && Number.isInteger(value.month)
        && Number.isInteger(value.day)
    );
}

export function parseDateOnly(value: string): BusinessDate {
    const match = DATE_ONLY_PATTERN.exec(value);
    if (!match) {
        throw new RangeError("Invalid leave date");
    }

    return validateBusinessDate({
        year: Number.parseInt(match[1], 10),
        month: Number.parseInt(match[2], 10),
        day: Number.parseInt(match[3], 10),
    });
}

function getBusinessDateFromInstant(value: Date): BusinessDate {
    if (Number.isNaN(value.getTime())) {
        throw new RangeError("Invalid leave date");
    }

    const parts = new Map(
        BUSINESS_DATE_FORMATTER
            .formatToParts(value)
            .map((part) => [part.type, part.value]),
    );

    return validateBusinessDate({
        year: Number.parseInt(parts.get("year") ?? "", 10),
        month: Number.parseInt(parts.get("month") ?? "", 10),
        day: Number.parseInt(parts.get("day") ?? "", 10),
    });
}

export function getBusinessDate(value: BusinessDateInput): BusinessDate {
    if (isBusinessDate(value)) {
        return validateBusinessDate(value);
    }

    if (typeof value === "string") {
        if (DATE_ONLY_PATTERN.test(value)) {
            return parseDateOnly(value);
        }
        return getBusinessDateFromInstant(new Date(value));
    }

    return getBusinessDateFromInstant(value);
}

export function isValidDateOnly(value: string): boolean {
    try {
        parseDateOnly(value);
        return true;
    } catch {
        return false;
    }
}

export function toDateOnlyString(value: BusinessDateInput): string {
    const date = getBusinessDate(value);
    return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function toUtcDate(value: BusinessDateInput): Date {
    return createUtcDate(getBusinessDate(value));
}

export function compareBusinessDates(
    left: BusinessDateInput,
    right: BusinessDateInput,
): number {
    const difference =
        toUtcDate(left).getTime() - toUtcDate(right).getTime();
    if (difference === 0) {
        return 0;
    }
    return difference < 0 ? -1 : 1;
}

export function addCalendarDays(
    value: BusinessDateInput,
    days: number,
): BusinessDate {
    if (!Number.isSafeInteger(days)) {
        throw new RangeError("Calendar day offset must be an integer");
    }

    const date = toUtcDate(value);
    date.setUTCDate(date.getUTCDate() + days);
    return validateBusinessDate({
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
    });
}

export function getCalendarDaysDifference(
    later: BusinessDateInput,
    earlier: BusinessDateInput,
): number {
    return Math.round((toUtcDate(later).getTime() - toUtcDate(earlier).getTime()) / MILLISECONDS_PER_DAY);
}

export function getBusinessDayOfWeek(value: BusinessDateInput): number {
    return toUtcDate(value).getUTCDay();
}
