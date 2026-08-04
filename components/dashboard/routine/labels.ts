import type { RoutineStatus } from "./types";

export const ROUTINE_STATUS_LABELS: Record<RoutineStatus, string> = {
    TODO: "รอดำเนินการ",
    IN_PROGRESS: "กำลังดำเนินการ",
    COMPLETED: "เสร็จแล้ว",
    SKIPPED: "ข้ามงาน",
    CANCELLED: "ยกเลิก",
};

export const ROUTINE_SCHEDULE_LABELS: Record<string, string> = {
    MONTHLY_DAY: "ทุกเดือนตามวันที่",
    MONTH_END: "วันสิ้นเดือน",
    INTERVAL_MONTHS: "ทุกระยะเดือน",
    YEARLY_DATE: "ทุกปีตามวันที่",
    ONE_TIME: "ครั้งเดียว",
    MANUAL: "สร้างเอง",
};

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

export function getRoutineStatusClass(status: RoutineStatus): string {
    switch (status) {
        case "COMPLETED":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "IN_PROGRESS":
            return "border-sky-200 bg-sky-50 text-sky-700";
        case "SKIPPED":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "CANCELLED":
            return "border-slate-200 bg-slate-100 text-slate-600";
        case "TODO":
            return "border-orange-200 bg-orange-50 text-orange-700";
    }
}

export function formatRoutineDueLabel(occurrence: {
    dueDate: string;
    isOverdue?: boolean;
    daysUntilDue?: number;
}): string {
    if (occurrence.isOverdue) return "เกินกำหนด";
    if (occurrence.daysUntilDue === 0) return "วันนี้";
    if (occurrence.daysUntilDue === 1) return "พรุ่งนี้";
    if (occurrence.daysUntilDue !== undefined && occurrence.daysUntilDue > 1) {
        return `อีก ${occurrence.daysUntilDue} วัน`;
    }
    return occurrence.dueDate;
}
