import type { RoutineTimingStatus } from "./timing";

export const ROUTINE_TIMING_STATUS_LABELS: Record<RoutineTimingStatus, string> = {
    OVERDUE: "เกินกำหนด",
    DUE_TODAY: "ถึงกำหนดวันนี้",
    DUE_SOON: "ใกล้ถึงกำหนด",
    UPCOMING: "ยังไม่ถึงกำหนด",
};

export const ROUTINE_SCHEDULE_LABELS: Record<string, string> = {
    MONTHLY_DAY: "ทุกเดือนตามวันที่",
    MONTH_END: "วันสิ้นเดือน",
    INTERVAL_MONTHS: "ทุกระยะเดือน",
    YEARLY_DATE: "ทุกปีตามวันที่",
    ONE_TIME: "ครั้งเดียว",
    MANUAL: "สร้างเอง",
};

export const ROUTINE_BUSINESS_DAY_POLICY_LABELS: Record<string, string> = {
    NONE: "ไม่เลื่อนวัน",
    PREVIOUS_BUSINESS_DAY: "เลื่อนเป็นวันทำการก่อนหน้า",
    NEXT_BUSINESS_DAY: "เลื่อนเป็นวันทำการถัดไป",
};

export function formatRoutineUnitLabel(unit: { code: string; name: string }): string {
    const code = unit.code.trim();
    const name = unit.name.trim();
    if (!code) return name;
    if (!name || code === name) return code;
    return `${code} · ${name}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number | null {
    return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function businessDayLabel(policy: string | undefined): string {
    if (policy === "PREVIOUS_BUSINESS_DAY") return " · เลื่อนเป็นวันทำการก่อนหน้า";
    if (policy === "NEXT_BUSINESS_DAY") return " · เลื่อนเป็นวันทำการถัดไป";
    return "";
}

const THAI_MONTH_LABELS = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
] as const;

export function formatRoutineScheduleSummary(schedule: {
    scheduleType: string;
    scheduleConfig: unknown;
    businessDayPolicy?: string;
}): string {
    const config = isRecord(schedule.scheduleConfig) ? schedule.scheduleConfig : {};
    const day = numberValue(config.day);
    const monthOffset = numberValue(config.monthOffset);
    let summary: string;

    switch (schedule.scheduleType) {
        case "MONTHLY_DAY":
            summary = day === null
                ? "ทุกเดือนตามวันที่"
                : `วันที่ ${day} ของ${monthOffset === 1 ? "เดือนถัดไป" : "เดือน"}`;
            break;
        case "MONTH_END":
            summary = "วันสุดท้ายของทุกเดือน";
            break;
        case "INTERVAL_MONTHS": {
            const interval = numberValue(config.intervalMonths);
            const anchorDate = typeof config.anchorDate === "string" ? config.anchorDate : null;
            summary = interval === null
                ? "ทำซ้ำตามรอบเดือน"
                : `ทำซ้ำทุก ${interval} เดือน${anchorDate ? ` เริ่มนับจาก ${anchorDate}` : ""}`;
            break;
        }
        case "YEARLY_DATE": {
            const month = numberValue(config.month);
            const yearDay = numberValue(config.day);
            const monthLabel = month !== null && month >= 1 && month <= 12
                ? THAI_MONTH_LABELS[month - 1]
                : null;
            summary = monthLabel && yearDay !== null
                ? `วันที่ ${yearDay} เดือน${monthLabel} ของทุกปี`
                : "วันเดียวกันของทุกปี";
            break;
        }
        case "ONE_TIME":
            summary = typeof config.date === "string" ? `วันที่ ${config.date}` : "กำหนดวันเดียว";
            break;
        case "MANUAL":
            summary = "สร้างงานเอง ไม่สร้างรอบอัตโนมัติ";
            break;
        default:
            summary = ROUTINE_SCHEDULE_LABELS[schedule.scheduleType] ?? "ยังไม่กำหนดตารางงาน";
    }

    return `${summary}${businessDayLabel(schedule.businessDayPolicy)}`;
}
