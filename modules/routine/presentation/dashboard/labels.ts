import type {
    RoutineAssignee,
    RoutineReminderRecipientScope,
    RoutineTimingStatus,
} from "./types";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";

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

export const ROUTINE_ASSIGNEE_ROLE_LABELS = {
    OWNER: "ผู้รับผิดชอบหลัก",
    CO_OWNER: "ผู้รับผิดชอบร่วม",
} as const;

export const ROUTINE_BUSINESS_DAY_POLICY_LABELS: Record<string, string> = {
    NONE: "ไม่เลื่อนวัน",
    PREVIOUS_BUSINESS_DAY: "เลื่อนเป็นวันทำการก่อนหน้า",
    NEXT_BUSINESS_DAY: "เลื่อนเป็นวันทำการถัดไป",
};

export const ROUTINE_REMINDER_RECIPIENT_SCOPE_LABELS: Record<
    RoutineReminderRecipientScope,
    string
> = {
    ASSIGNEES: "ผู้รับผิดชอบ",
    ADMINS: "ผู้ดูแลระบบ",
    ASSIGNEES_AND_ADMINS: "ผู้รับผิดชอบและผู้ดูแลระบบ",
};

export function formatRoutineAssigneeName(assignee: RoutineAssignee): string {
    const displayName = assignee.employee.displayName?.trim();
    if (displayName) return displayName;
    return getEmployeeDisplayName(assignee.employee)
        || `รหัสพนักงาน ${assignee.employeeId}`;
}

export function sortRoutineAssignees(
    assignees: readonly RoutineAssignee[],
): RoutineAssignee[] {
    return [...assignees].sort((left, right) => {
        if (left.role !== right.role) return left.role === "OWNER" ? -1 : 1;
        return formatRoutineAssigneeName(left).localeCompare(
            formatRoutineAssigneeName(right),
            "th",
        );
    });
}

export function formatRoutineAssigneeSummary(
    assignees: readonly RoutineAssignee[],
): string {
    const [first, ...remaining] = sortRoutineAssignees(assignees);
    if (!first) return "ยังไม่ได้ระบุ";
    const name = formatRoutineAssigneeName(first);
    return remaining.length > 0 ? `${name} +${remaining.length} คน` : name;
}

export function areRoutineAssigneeSnapshotsEqual(
    left: readonly RoutineAssignee[],
    right: readonly RoutineAssignee[],
): boolean {
    if (left.length !== right.length) return false;
    const toKey = (assignee: RoutineAssignee): string =>
        `${assignee.employeeId}:${assignee.role}`;
    const leftKeys = left.map(toKey).sort();
    const rightKeys = right.map(toKey).sort();
    return leftKeys.every((key, index) => key === rightKeys[index]);
}

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
            return "border-status-danger-border bg-status-danger-surface text-status-danger-strong";
        case "DUE_TODAY":
            return "border-brand-border-default bg-brand-surface text-brand-emphasis";
        case "DUE_SOON":
            return "border-status-warning-border bg-status-warning-surface text-status-warning-foreground";
        case "UPCOMING":
            return "border-border-subtle bg-surface-subtle text-content-body";
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
