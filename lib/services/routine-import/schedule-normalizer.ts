import type {
    RoutineBusinessDayPolicy,
} from "@/lib/routine/schedule";

import {
    ROUTINE_IMPORT_DEFAULT_BUSINESS_DAY_POLICY,
    ROUTINE_IMPORT_REVIEW_REASONS,
} from "./constants";
import {
    normalizeSourceText,
    parseSourceDates,
} from "./dates";
import type {
    RoutineImportJsonObject,
    RoutineImportNormalizedSchedule,
} from "./types";

const MONTH_NAMES: Readonly<Record<string, number>> = {
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
const MONTH_PATTERN =
    "มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\\.?ค\\.?|ก\\.?พ\\.?|มี\\.?ค\\.?|เม\\.?ย\\.?|พ\\.?ค\\.?|มิ\\.?ย\\.?|ก\\.?ค\\.?|ส\\.?ค\\.?|ก\\.?ย\\.?|ต\\.?ค\\.?|พ\\.?ย\\.?|ธ\\.?ค\\.?";

export interface RoutineScheduleNormalizationResult {
    normalizedSchedule: RoutineImportNormalizedSchedule | null;
    reviewReasons: string[];
}

function monthNumber(value: string): number | null {
    return MONTH_NAMES[value.replaceAll(".", "")] ?? null;
}

function makeSchedule(
    scheduleType: RoutineImportNormalizedSchedule["scheduleType"],
    scheduleConfig: RoutineImportJsonObject,
    businessDayPolicy: RoutineBusinessDayPolicy =
        ROUTINE_IMPORT_DEFAULT_BUSINESS_DAY_POLICY,
): RoutineImportNormalizedSchedule {
    return { scheduleType, scheduleConfig, businessDayPolicy };
}

function uniqueReasons(reasons: string[]): string[] {
    return [...new Set(reasons)];
}

export function normalizeRoutineSchedule(
    scheduleText: string | null,
    contractStartDate: string | null = null,
): RoutineScheduleNormalizationResult {
    if (!scheduleText || normalizeSourceText(scheduleText).length === 0) {
        return {
            normalizedSchedule: null,
            reviewReasons: [ROUTINE_IMPORT_REVIEW_REASONS.MISSING_SCHEDULE],
        };
    }

    const normalized = normalizeSourceText(scheduleText);
    const reviewReasons: string[] = [];
    const holidayPolicy = normalized.includes("วันหยุด")
        ? "PREVIOUS_BUSINESS_DAY"
        : ROUTINE_IMPORT_DEFAULT_BUSINESS_DAY_POLICY;
    if (normalized.includes("วันหยุด")) {
        reviewReasons.push(
            ROUTINE_IMPORT_REVIEW_REASONS.HOLIDAY_CALENDAR_NOT_SUPPORTED,
        );
    }

    const monthlyMatch = /^(?:ภายใน\s*)?(?:ส่งบุคคล\s*)?วันที่\s*(\d{1,2})\s*ของเดือน(ถัดไป)?(?:\s*\(.*\))?$/u.exec(
        normalized,
    );
    if (monthlyMatch) {
        const day = Number(monthlyMatch[1]);
        const monthOffset = monthlyMatch[2] ? 1 : 0;
        return {
            normalizedSchedule: makeSchedule(
                "MONTHLY_DAY",
                { day, monthOffset },
                holidayPolicy,
            ),
            reviewReasons: uniqueReasons(reviewReasons),
        };
    }

    if (/^สิ้นเดือน$/u.test(normalized)) {
        return {
            normalizedSchedule: makeSchedule(
                "MONTH_END",
                {},
                holidayPolicy,
            ),
            reviewReasons: uniqueReasons(reviewReasons),
        };
    }

    const yearlyEndMatch = new RegExp(
        `^(?:ภายใน\\s*)?สิ้นเดือน\\s*(${MONTH_PATTERN})\\s*(?:ของทุกปี|ทุกปี)$`,
        "u",
    ).exec(normalized);
    if (yearlyEndMatch) {
        const month = monthNumber(yearlyEndMatch[1]);
        if (month) {
            return {
                normalizedSchedule: makeSchedule(
                    "YEARLY_DATE",
                    { month, day: 31 },
                    holidayPolicy,
                ),
                reviewReasons: uniqueReasons(reviewReasons),
            };
        }
    }

    const yearlyMatch = new RegExp(
        `^(?:ภายใน\\s*)?(?:วันที่\\s*)?(\\d{1,2})\\s*(${MONTH_PATTERN})\\s*(?:ของทุกปี|ทุกปี)$`,
        "u",
    ).exec(normalized);
    if (yearlyMatch) {
        const day = Number(yearlyMatch[1]);
        const month = monthNumber(yearlyMatch[2]);
        if (month) {
            return {
                normalizedSchedule: makeSchedule(
                    "YEARLY_DATE",
                    { month, day },
                    holidayPolicy,
                ),
                reviewReasons: uniqueReasons(reviewReasons),
            };
        }
    }

    const intervalMatch = /(?:ทุก|ทุกรอบ)\s*(\d+)\s*(เดือน|ปี)/u.exec(
        normalized,
    );
    if (intervalMatch) {
        const intervalMonths = Number(intervalMatch[1])
            * (intervalMatch[2] === "ปี" ? 12 : 1);
        if (contractStartDate) {
            return {
                normalizedSchedule: makeSchedule(
                    "INTERVAL_MONTHS",
                    { intervalMonths, anchorDate: contractStartDate },
                    holidayPolicy,
                ),
                reviewReasons: uniqueReasons(reviewReasons),
            };
        }
        reviewReasons.push(ROUTINE_IMPORT_REVIEW_REASONS.AMBIGUOUS_SCHEDULE);
        return {
            normalizedSchedule: null,
            reviewReasons: uniqueReasons(reviewReasons),
        };
    }

    const oneTimeMatch = new RegExp(
        `^(?:ภายใน\\s*)?(?:วันที่\\s*)?\\d{1,2}\\s*(?:${MONTH_PATTERN})\\s*\\d{2,4}$`,
        "u",
    );
    const isoDateMatch = /^\d{4}-\d{2}-\d{2}$/u.test(normalized);
    if (oneTimeMatch.test(normalized) || isoDateMatch) {
        const [date] = parseSourceDates(normalized);
        if (date?.date) {
            return {
                normalizedSchedule: makeSchedule(
                    "ONE_TIME",
                    { date: date.date },
                    holidayPolicy,
                ),
                reviewReasons: uniqueReasons(reviewReasons),
            };
        }
    }

    const unsupportedEvent = /เมื่อ|ตามความเหมาะสม|โดยประมาณ|ก่อนวัน|ได้รับเอกสาร|ตามวาระ|เข้าและออก|ลาออก|ปีละ|รอบวางบิล|ต่ออัตโนมัติ/u.test(
        normalized,
    );
    reviewReasons.push(
        unsupportedEvent
            ? ROUTINE_IMPORT_REVIEW_REASONS.UNSUPPORTED_EVENT_SCHEDULE
            : ROUTINE_IMPORT_REVIEW_REASONS.AMBIGUOUS_SCHEDULE,
    );
    return {
        normalizedSchedule: null,
        reviewReasons: uniqueReasons(reviewReasons),
    };
}
