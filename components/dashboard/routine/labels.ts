import type { RoutineTimingStatus } from "./types";

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

export function formatRoutineUnitLabel(unit: { code: string; name: string }): string {
    const code = unit.code.trim();
    const name = unit.name.trim();
    if (!code) return name;
    if (!name || code === name) return code;
    return `${code} · ${name}`;
}

export function uniqueRoutineUnits(
    units: readonly { id: number; code: string; name: string }[],
): Array<{ id: number; code: string; name: string }> {
    const seenCodes = new Set<string>();
    return units.filter((unit) => {
        const key = unit.code.trim().toLocaleLowerCase() || unit.name.trim().toLocaleLowerCase();
        if (seenCodes.has(key)) return false;
        seenCodes.add(key);
        return true;
    });
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

export function getRoutineTimingStatusClass(status: RoutineTimingStatus): string {
    switch (status) {
        case "OVERDUE":
            return "border-rose-200 bg-rose-50 text-rose-700";
        case "DUE_TODAY":
            return "border-sky-200 bg-sky-50 text-sky-700";
        case "DUE_SOON":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "UPCOMING":
            return "border-slate-200 bg-slate-100 text-slate-700";
    }
}

export function formatRoutineDueLabel(occurrence: {
    dueDate: string;
    isOverdue?: boolean;
    daysUntilDue?: number;
}): string {
    if (occurrence.isOverdue) return `เกินกำหนด ${Math.abs(occurrence.daysUntilDue ?? 0)} วัน`;
    if (occurrence.daysUntilDue === 0) return "วันนี้";
    if (occurrence.daysUntilDue === 1) return "พรุ่งนี้";
    if (occurrence.daysUntilDue !== undefined && occurrence.daysUntilDue > 1) {
        return `อีก ${occurrence.daysUntilDue} วัน`;
    }
    return occurrence.dueDate;
}
