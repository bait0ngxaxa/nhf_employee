import {
    getEmployeeDisplayName,
    getEmployeeStatusLabel,
} from "../../domain/identity";
import type { EmployeeStatusValue } from "../../domain/lifecycle";

export { getEmployeeDisplayName, getEmployeeStatusLabel };

const EMPLOYEE_STATUS_BADGE_CLASSES: Readonly<
    Record<EmployeeStatusValue, string>
> = {
    ACTIVE: "bg-status-positive-surface-strong text-status-positive-strong",
    INACTIVE: "bg-surface-neutral-muted text-content-neutral-strong",
    SUSPENDED: "bg-status-error-surface-strong text-status-error-strong",
};

export function getEmployeeStatusBadge(status: string): string {
    if (status === "ACTIVE" || status === "INACTIVE" || status === "SUSPENDED") {
        return EMPLOYEE_STATUS_BADGE_CLASSES[status];
    }

    return "bg-surface-neutral-muted text-content-neutral-strong";
}

export function formatEmployeePhone(phone?: string | null): string {
    if (!phone) return "-";

    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length === 10
        ? `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
        : phone;
}

export function getEmployeeDepartmentLabel(department?: string | null): string {
    return department === "ADMIN" || department === "บริหาร"
        ? "บริหาร"
        : "วิชาการ";
}

export function getEmployeeDepartmentBadgeClass(
    department?: string | null,
): string {
    if (department === "ADMIN" || department === "บริหาร") {
        return "bg-status-warning-surface text-status-warning-foreground border-status-warning-border/80 hover:bg-status-warning-surface-strong";
    }

    return "bg-brand-surface text-brand-emphasis border-brand-border-default/80 hover:bg-brand-surface-strong";
}

export function isTemporaryEmail(email: string): boolean {
    return email.includes("@temp.local");
}
