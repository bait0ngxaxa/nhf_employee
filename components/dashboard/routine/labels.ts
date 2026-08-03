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
