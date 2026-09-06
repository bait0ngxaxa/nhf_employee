export interface EmployeeDisplayNameSource {
    firstName: string;
    lastName: string;
    nickname?: string | null;
}

export function getEmployeeFullName(firstName: string, lastName: string): string {
    return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export function getEmployeeDisplayName(employee: EmployeeDisplayNameSource): string {
    const fullName = getEmployeeFullName(employee.firstName, employee.lastName);
    const nickname = employee.nickname?.trim();

    if (!nickname) return fullName;
    return fullName ? `${fullName} (${nickname})` : nickname;
}

export function getEmployeeEmailStatus(email: string): "valid" | "temp" | "invalid" {
    if (!email || email.trim() === "") return "invalid";
    return email.includes("@temp.local") ? "temp" : "valid";
}

const EMPLOYEE_STATUS_LABELS: Readonly<Record<string, string>> = {
    ACTIVE: "ทำงานอยู่",
    INACTIVE: "ไม่ทำงาน",
    SUSPENDED: "ถูกระงับ",
};

export function getEmployeeStatusLabel(status: string): string {
    return EMPLOYEE_STATUS_LABELS[status] ?? status;
}
