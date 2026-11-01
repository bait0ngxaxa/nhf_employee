import type { HolidayReferenceEvent } from "../schemas/holiday-reference";

// Exact source-title pairs checked against Google's Thai/English feeds. Unknown
// titles stay unchanged; localization never determines identity or classification.
const THAI_NAMES: Readonly<Record<string, string>> = {
    "Valentine's Day": "วันวาเลนไทน์",
    "Chakri Day": "วันจักรี",
    "Songkran Holiday": "วันสงกรานต์",
    "Songkran": "วันสงกรานต์",
    "Chulalongkorn Day": "วันปิยมหาราช",
    "Constitution Day": "วันรัฐธรรมนูญ",
    "New Year's Eve": "วันสิ้นปี",
};

export function holidayDisplayName(name: string): string {
    return THAI_NAMES[name] ?? name;
}

export const HOLIDAY_LABELS: Record<HolidayReferenceEvent["classification"], string> = {
    "public-holiday": "วันหยุดตาม Google",
    observance: "วันสำคัญ",
    unverified: "ยังไม่ยืนยันประเภท",
};

const DATE_FORMAT = new Intl.DateTimeFormat("th-TH", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok",
});
const MONTH_FORMAT = new Intl.DateTimeFormat("th-TH", {
    month: "long", year: "numeric", timeZone: "Asia/Bangkok",
});

export function formatCalendarDate(date: string, monthOnly = false): string {
    if (!date) return "ยังไม่ได้เลือก";
    return (monthOnly ? MONTH_FORMAT : DATE_FORMAT).format(new Date(`${date}T12:00:00+07:00`));
}
