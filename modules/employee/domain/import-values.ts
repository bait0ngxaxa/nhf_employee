export const EMPLOYEE_IMPORT_DEPARTMENT_CODE_MAP: Readonly<Record<string, string>> = {
    ADMIN: "ADMIN",
    บริหาร: "ADMIN",
    ACADEMIC: "ACADEMIC",
    วิชาการ: "ACADEMIC",
};

export function normalizeEmployeeImportEmail(email: string | undefined): string | null {
    if (!email || email.trim() === "" || email.trim() === "-") return null;

    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        throw new Error("รูปแบบอีเมลไม่ถูกต้อง");
    }
    if (!normalized.endsWith("@thainhf.org")) {
        throw new Error("กรุณาใช้อีเมลองค์กร (@thainhf.org) เท่านั้น");
    }

    return normalized;
}

export function normalizeEmployeeImportName(firstName: string, lastName: string): string {
    return `${firstName.trim().toLowerCase()} ${lastName.trim().toLowerCase()}`;
}

export function getEmployeeImportDepartmentCode(department: string): string | undefined {
    return EMPLOYEE_IMPORT_DEPARTMENT_CODE_MAP[department.toUpperCase()]
        ?? EMPLOYEE_IMPORT_DEPARTMENT_CODE_MAP[department];
}
