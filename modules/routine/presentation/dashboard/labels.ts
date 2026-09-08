import type {
    RoutineAssignee,
    RoutineReminderRecipientScope,
    RoutineTimingStatus,
} from "./types";
import { getEmployeeDisplayName } from "@/modules/employee/client";
export {
    formatRoutineScheduleSummary,
    formatRoutineUnitLabel,
    ROUTINE_BUSINESS_DAY_POLICY_LABELS,
    ROUTINE_SCHEDULE_LABELS,
    ROUTINE_TIMING_STATUS_LABELS,
} from "../../domain/labels";

export const ROUTINE_ASSIGNEE_ROLE_LABELS = {
    OWNER: "ผู้รับผิดชอบหลัก",
    CO_OWNER: "ผู้รับผิดชอบร่วม",
} as const;

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
