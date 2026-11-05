interface CalendarDate {
    year: number;
    month: number;
    day: number;
}

export interface EmploymentTenure {
    years: number;
    months: number;
    days: number;
}

const THAILAND_TIME_ZONE = "Asia/Bangkok";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function makeCalendarDate(year: number, month: number, day: number): CalendarDate | null {
    if (
        !Number.isInteger(year)
        || year < 1000
        || year > 9999
        || !Number.isInteger(month)
        || month < 1
        || month > 12
        || !Number.isInteger(day)
        || day < 1
        || day > 31
    ) {
        return null;
    }

    const date = new Date(Date.UTC(2000, month - 1, day));
    date.setUTCFullYear(year);
    if (
        date.getUTCFullYear() !== year
        || date.getUTCMonth() + 1 !== month
        || date.getUTCDate() !== day
    ) {
        return null;
    }

    return { year, month, day };
}

function parseDateOnlyString(value: string): CalendarDate | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
    if (!match) return null;

    return makeCalendarDate(
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
    );
}

export function parseEmployeeHireDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = parseDateOnlyString(value);
    if (!date) return null;

    return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

function getThailandCalendarDate(value: Date | string): CalendarDate | null {
    const instant = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(instant.getTime())) return null;

    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: THAILAND_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(instant);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const year = Number(values.get("year"));
    const month = Number(values.get("month"));
    const day = Number(values.get("day"));

    return makeCalendarDate(year, month, day);
}

/** Current Thailand day, as a Gregorian ISO date for presentation clocks. */
export function getThailandDateOnly(instant: Date): string {
    const date = getThailandCalendarDate(instant);
    if (!date) throw new RangeError("Invalid Thailand calendar date");
    return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function toHireCalendarDate(value: Date | string): CalendarDate | null {
    if (typeof value === "string") return parseDateOnlyString(value);
    if (!Number.isFinite(value.getTime())) return null;

    // Prisma returns a database DATE as midnight UTC in the installed client.
    return makeCalendarDate(
        value.getUTCFullYear(),
        value.getUTCMonth() + 1,
        value.getUTCDate(),
    );
}

function compareCalendarDates(left: CalendarDate, right: CalendarDate): number {
    return toDayNumber(left) - toDayNumber(right);
}

function toDayNumber(date: CalendarDate): number {
    return Date.UTC(date.year, date.month - 1, date.day) / MILLISECONDS_PER_DAY;
}

function daysInMonth(year: number, month: number): number {
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthDate = makeCalendarDate(nextMonthYear, nextMonth, 1);
    const currentMonthDate = makeCalendarDate(year, month, 1);
    if (!nextMonthDate || !currentMonthDate) return 31;
    return toDayNumber(nextMonthDate) - toDayNumber(currentMonthDate);
}

function addCalendarMonths(date: CalendarDate, months: number): CalendarDate | null {
    const absoluteMonth = date.year * 12 + date.month - 1 + months;
    const year = Math.floor(absoluteMonth / 12);
    const month = absoluteMonth - year * 12 + 1;
    const day = Math.min(date.day, daysInMonth(year, month));
    return makeCalendarDate(year, month, day);
}

function asOfCalendarDate(value: Date | string): CalendarDate | null {
    if (typeof value === "string") {
        const dateOnly = parseDateOnlyString(value);
        if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dateOnly;
    }
    return getThailandCalendarDate(value);
}

/**
 * Calculate elapsed calendar tenure. Date-only hire values are read in UTC
 * calendar terms; instants used for asOfDate are evaluated on the Thailand
 * calendar. A future hire date has zero elapsed tenure until that date arrives.
 */
export function calculateEmploymentTenure(
    hireDate: Date | string | null,
    asOfDate: Date | string,
): EmploymentTenure | null {
    if (hireDate === null) return null;

    const start = toHireCalendarDate(hireDate);
    const end = asOfCalendarDate(asOfDate);
    if (!start || !end) return null;
    if (compareCalendarDates(end, start) < 0) {
        return { years: 0, months: 0, days: 0 };
    }

    let totalMonths = (end.year - start.year) * 12 + end.month - start.month;
    let monthAnchor = addCalendarMonths(start, totalMonths);
    if (!monthAnchor) return null;
    if (compareCalendarDates(monthAnchor, end) > 0) {
        totalMonths -= 1;
        monthAnchor = addCalendarMonths(start, totalMonths);
    }
    if (!monthAnchor) return null;

    const days = compareCalendarDates(end, monthAnchor);
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return { years, months, days };
}

export function formatEmploymentHireDate(hireDate: Date | string | null): string {
    if (hireDate === null) return "ไม่ระบุ";
    const date = toHireCalendarDate(hireDate);
    if (!date) return "ไม่ระบุ";

    return new Intl.DateTimeFormat("th-TH", {
        timeZone: "UTC",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)));
}

export function formatEmploymentTenure(tenure: EmploymentTenure | null): string {
    if (tenure === null) return "ยังไม่ทราบ";
    const formatNumber = (value: number): string => value.toLocaleString("th-TH");
    return formatNumber(tenure.years) + " ปี "
        + formatNumber(tenure.months) + " เดือน "
        + formatNumber(tenure.days) + " วัน";
}
