import {
    isCalendarDate,
    type CalendarDate,
} from "@/lib/routine/schedule";

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const THAI_MONTHS: Readonly<Record<string, number>> = {
    "มกราคม": 1,
    "กุมภาพันธ์": 2,
    "มีนาคม": 3,
    "เมษายน": 4,
    "พฤษภาคม": 5,
    "มิถุนายน": 6,
    "กรกฎาคม": 7,
    "สิงหาคม": 8,
    "กันยายน": 9,
    "ตุลาคม": 10,
    "พฤศจิกายน": 11,
    "ธันวาคม": 12,
    "มค": 1,
    "กพ": 2,
    "มีค": 3,
    "เมย": 4,
    "พค": 5,
    "มิย": 6,
    "กค": 7,
    "สค": 8,
    "กย": 9,
    "ตค": 10,
    "พย": 11,
    "ธค": 12,
};
const THAI_MONTH_PATTERN =
    "มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\\.?ค\\.?|ก\\.?พ\\.?|มี\\.?ค\\.?|เม\\.?ย\\.?|พ\\.?ค\\.?|มิ\\.?ย\\.?|ก\\.?ค\\.?|ส\\.?ค\\.?|ก\\.?ย\\.?|ต\\.?ค\\.?|พ\\.?ย\\.?|ธ\\.?ค\\.?";
const THAI_DATE_PATTERN = new RegExp(
    `(\\d{1,2})\\s*(${THAI_MONTH_PATTERN})\\s*(\\d{2,4})?`,
    "gu",
);

export interface ParsedSourceDate {
    date: CalendarDate | null;
    day: number;
    month: number;
    year: number | null;
    hasYear: boolean;
}

export interface ParsedContractDates {
    startDate: CalendarDate | null;
    endDate: CalendarDate | null;
    reviewReasons: string[];
}

export function normalizeThaiDigits(value: string): string {
    return [...value]
        .map((character) => {
            const index = THAI_DIGITS.indexOf(character);
            return index === -1 ? character : String(index);
        })
        .join("");
}

export function normalizeSourceText(value: string): string {
    return normalizeThaiDigits(value)
        .replace(/[\u00a0\r\n\t]+/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();
}

export function normalizeSourceYear(year: number): number | null {
    if (!Number.isInteger(year) || year < 0) return null;
    if (year >= 2400 && year <= 2700) return year - 543;
    if (year >= 1900 && year <= 2100) return year;
    if (year < 100) return 1957 + year;
    return null;
}

function normalizeMonthToken(value: string): number | null {
    return THAI_MONTHS[value.replaceAll(".", "")] ?? null;
}

function makeCalendarDate(
    year: number | null,
    month: number,
    day: number,
): CalendarDate | null {
    if (year === null) return null;
    const normalizedYear = normalizeSourceYear(year);
    if (normalizedYear === null) return null;
    const candidate = `${String(normalizedYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return isCalendarDate(candidate) ? candidate : null;
}

export function parseSourceDates(value: string): ParsedSourceDate[] {
    const normalized = normalizeSourceText(value);
    const dates: ParsedSourceDate[] = [];

    for (const match of normalized.matchAll(THAI_DATE_PATTERN)) {
        const day = Number(match[1]);
        const month = normalizeMonthToken(match[2]);
        if (!month) continue;
        const rawYear = match[3] ? Number(match[3]) : null;
        dates.push({
            date: makeCalendarDate(rawYear, month, day),
            day,
            month,
            year: rawYear === null ? null : normalizeSourceYear(rawYear),
            hasYear: rawYear !== null,
        });
    }

    const isoMatch = /(?<!\d)(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/u.exec(
        normalized,
    );
    if (isoMatch) {
        const year = Number(isoMatch[1]);
        const month = Number(isoMatch[2]);
        const day = Number(isoMatch[3]);
        dates.push({
            date: makeCalendarDate(year, month, day),
            day,
            month,
            year: normalizeSourceYear(year),
            hasYear: true,
        });
    }

    const slashMatch = /(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?!\d)/u.exec(
        normalized,
    );
    if (slashMatch) {
        const day = Number(slashMatch[1]);
        const month = Number(slashMatch[2]);
        const rawYear = Number(slashMatch[3]);
        dates.push({
            date: makeCalendarDate(rawYear, month, day),
            day,
            month,
            year: normalizeSourceYear(rawYear),
            hasYear: true,
        });
    }

    return dates;
}

export function parseContractDates(value: string | null): ParsedContractDates {
    if (!value) {
        return { startDate: null, endDate: null, reviewReasons: [] };
    }

    const normalized = normalizeSourceText(value);
    const dates = parseSourceDates(normalized);
    const reviewReasons: string[] = [];
    const hasRange = /[-–—]/u.test(normalized) && dates.length >= 2;

    if (hasRange) {
        const [start, end] = dates;
        if (!start.hasYear || !end.hasYear || !start.date || !end.date) {
            reviewReasons.push("CONTRACT_DATE_UNRESOLVED");
            return { startDate: null, endDate: null, reviewReasons };
        }
        if (start.date > end.date) {
            reviewReasons.push("INVALID_CONTRACT_DATE_RANGE");
            return { startDate: start.date, endDate: end.date, reviewReasons };
        }
        return {
            startDate: start.date,
            endDate: end.date,
            reviewReasons,
        };
    }

    const isExpiry = /หมดอายุ/u.test(normalized);
    const isStartDate = /(?:เริ่ม|เริ่มใช้|สัญญาเริ่ม)/u.test(normalized);
    if (dates.length > 0 && (isExpiry || isStartDate)) {
        const date = dates[0];
        if (!date.hasYear || !date.date) {
            reviewReasons.push("CONTRACT_DATE_UNRESOLVED");
        } else if (isExpiry) {
            return { startDate: null, endDate: date.date, reviewReasons };
        } else {
            return { startDate: date.date, endDate: null, reviewReasons };
        }
    } else if (dates.length > 0 || /\d{2,4}/u.test(normalized)) {
        reviewReasons.push("CONTRACT_DATE_UNRESOLVED");
    }

    return { startDate: null, endDate: null, reviewReasons };
}

export function isDateNumberFormat(format: string | null | undefined): boolean {
    if (!format) return false;
    return /[dmy]/iu.test(format);
}

export function excelSerialToCalendarDate(
    serial: number,
    date1904 = false,
): CalendarDate | null {
    if (!Number.isFinite(serial) || serial < 0) return null;
    const epoch = date1904
        ? Date.UTC(1904, 0, 1)
        : Date.UTC(1899, 11, 30);
    const wholeDays = Math.floor(serial);
    const adjustedDays = !date1904 && wholeDays < 60
        ? wholeDays + 1
        : wholeDays;
    const date = new Date(epoch + adjustedDays * 86_400_000);
    const calendarDate = date.toISOString().slice(0, 10);
    return isCalendarDate(calendarDate) ? calendarDate : null;
}

export function normalizeCellDate(
    value: unknown,
    format: string | null | undefined,
    date1904 = false,
): CalendarDate | null {
    if (typeof value === "number" && isDateNumberFormat(format)) {
        return excelSerialToCalendarDate(value, date1904);
    }
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value !== "string") return null;
    const dates = parseSourceDates(value);
    return dates.length === 1 ? dates[0].date : null;
}

export function isDateExpired(
    endDate: CalendarDate | null,
    asOfDate: CalendarDate,
): boolean {
    if (!endDate) return false;
    return endDate < asOfDate;
}
