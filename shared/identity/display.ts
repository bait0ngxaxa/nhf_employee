export interface UserDisplayNameSource {
    name?: string | null;
    email?: string | null;
    employee?: {
        firstName: string;
        lastName: string;
        nickname?: string | null;
    } | null;
}

export function getUserDisplayName(
    user: UserDisplayNameSource,
    fallback = "ไม่ระบุชื่อ",
): string {
    const employeeName = user.employee
        && typeof user.employee.firstName === "string"
        && typeof user.employee.lastName === "string"
        ? formatEmployeeProjection(user.employee)
        : "";

    return employeeName || user.name?.trim() || user.email?.trim() || fallback;
}

function formatEmployeeProjection(employee: NonNullable<UserDisplayNameSource["employee"]>): string {
    const fullName = [employee.firstName.trim(), employee.lastName.trim()]
        .filter(Boolean)
        .join(" ");
    const nickname = employee.nickname?.trim();

    if (!nickname) return fullName;
    return fullName ? `${fullName} (${nickname})` : nickname;
}
