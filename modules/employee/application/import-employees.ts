import { getEmployeeDisplayName } from "../domain/identity";
import { parseEmployeeImportStatus } from "../domain/import-status";
import {
    createImportedEmployee,
    loadEmployeeImportReferenceData,
} from "../infrastructure/persistence/employee-import";
import { EMPLOYEE_DEPARTMENT_CODE_MAP } from "./constants";
import type { CsvImportEmployee, EmployeeImportResult } from "./types";

function assertRequiredFields(
    data: Partial<CsvImportEmployee>,
): asserts data is CsvImportEmployee {
    for (const field of ["firstName", "lastName", "position", "department"] as const) {
        const value = data[field];
        if (!value || value.trim() === "") {
            throw new Error(`ข้อมูล ${field} เป็นข้อมูลที่จำเป็น`);
        }
    }
}

function normalizeImportEmail(email: string | undefined): string | null {
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

function generateTempEmail(): string {
    return `no-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@temp.local`;
}

export async function importEmployeesFromCsvRows(
    employees: Partial<CsvImportEmployee>[],
): Promise<EmployeeImportResult> {
    const result: EmployeeImportResult = { success: [], errors: [] };
    const { departments, existingEmployees } = await loadEmployeeImportReferenceData();
    const departmentMap = new Map(departments.map((department) => [department.code, department.id]));
    const existingEmails = new Set(existingEmployees
        .filter((employee) => employee.email && !employee.email.includes("@temp.local"))
        .map((employee) => employee.email.toLowerCase()));
    const existingNames = new Set(existingEmployees.map((employee) =>
        `${employee.firstName.trim().toLowerCase()} ${employee.lastName.trim().toLowerCase()}`));

    for (let index = 0; index < employees.length; index += 1) {
        const employeeData = employees[index];
        const rowNumber = employeeData.sourceRow ?? index + 1;
        try {
            assertRequiredFields(employeeData);
            const normalizedEmail = normalizeImportEmail(employeeData.email);
            if (normalizedEmail && existingEmails.has(normalizedEmail)) {
                throw new Error("อีเมลนี้ถูกใช้งานแล้ว");
            }
            const normalizedFullName = `${employeeData.firstName.trim().toLowerCase()} ${employeeData.lastName.trim().toLowerCase()}`;
            if (existingNames.has(normalizedFullName)) {
                throw new Error(`พนักงานชื่อ "${getEmployeeDisplayName(employeeData)}" มีอยู่ในระบบแล้ว`);
            }
            const departmentKey = employeeData.department.toUpperCase();
            const departmentCode = EMPLOYEE_DEPARTMENT_CODE_MAP[departmentKey]
                ?? EMPLOYEE_DEPARTMENT_CODE_MAP[employeeData.department];
            const departmentId = departmentCode ? departmentMap.get(departmentCode) : undefined;
            if (departmentId === undefined) {
                throw new Error("รหัสแผนกไม่ถูกต้อง ใช้ได้เฉพาะ ADMIN (บริหาร) หรือ ACADEMIC (วิชาการ)");
            }
            const email = normalizedEmail ?? generateTempEmail();
            const created = await createImportedEmployee({
                firstName: employeeData.firstName.trim(),
                lastName: employeeData.lastName.trim(),
                nickname: employeeData.nickname?.trim() || null,
                email,
                phone: employeeData.phone?.trim() || null,
                position: employeeData.position.trim(),
                affiliation: employeeData.affiliation?.trim() || null,
                departmentId,
                status: parseEmployeeImportStatus(employeeData.status),
            });
            if (!email.includes("@temp.local")) existingEmails.add(email.toLowerCase());
            existingNames.add(normalizedFullName);
            result.success.push({
                firstName: created.firstName,
                lastName: created.lastName,
                email: created.email,
                phone: created.phone || undefined,
                position: created.position,
                department: created.dept.name,
                affiliation: created.affiliation || undefined,
                nickname: created.nickname || undefined,
            });
        } catch (error) {
            result.errors.push({
                row: rowNumber,
                data: employeeData,
                error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
            });
        }
    }
    return result;
}
