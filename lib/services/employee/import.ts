import { prisma } from "@/lib/prisma";
import { DEPARTMENT_CODE_MAP } from "./constants";
import type { CSVImportEmployee, ImportResult } from "./types";

/**
 * Validate required fields for import
 */
function validateRequiredFields(
    data: Partial<CSVImportEmployee>,
): string | null {
    const requiredFields = ["firstName", "lastName", "position", "department"];
    for (const field of requiredFields) {
        const value = data[field as keyof CSVImportEmployee];
        if (!value || (typeof value === "string" && value.trim() === "")) {
            return `ข้อมูล ${field} เป็นข้อมูลที่จำเป็น`;
        }
    }
    return null;
}

/**
 * Assert that data has all required fields
 */
function assertRequiredFields(
    data: Partial<CSVImportEmployee>,
): asserts data is CSVImportEmployee {
    const error = validateRequiredFields(data);
    if (error) {
        throw new Error(error);
    }
}

/**
 * Validate email format (only if provided and not empty/dash)
 */
function validateEmail(email: string | undefined): string | null {
    if (!email || email.trim() === "" || email.trim() === "-") {
        return null;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return "รูปแบบอีเมลไม่ถูกต้อง";
    }
    return null;
}

/**
 * Get department ID from code/name
 */
function getDepartmentId(
    department: string,
    departmentMap: Map<string, number>,
): number | null {
    const deptCode = department.toUpperCase();
    const mappedCode =
        DEPARTMENT_CODE_MAP[deptCode] || DEPARTMENT_CODE_MAP[department];

    if (!mappedCode) {
        return null;
    }

    return departmentMap.get(mappedCode) ?? null;
}

/**
 * Generate a temporary email for employees without email
 */
function generateTempEmail(): string {
    return `no-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@temp.local`;
}

/**
 * Import employees from CSV data
 */
export async function importEmployeesFromCSV(
    employees: Partial<CSVImportEmployee>[],
): Promise<ImportResult> {
    const result: ImportResult = {
        success: [],
        errors: [],
    };

    // Get all departments for mapping
    const departments = await prisma.department.findMany();
    const departmentMap = new Map(
        departments.map((dept) => [dept.code, dept.id]),
    );

    // Get existing emails to check for duplicates
    const existingEmployees = await prisma.employee.findMany({
        select: { email: true },
    });
    const existingEmails = new Set(
        existingEmployees.map((emp) => emp.email.toLowerCase()),
    );

    // Process each employee
    for (let i = 0; i < employees.length; i++) {
        const rowNumber = i + 1;
        const employeeData = employees[i];

        try {
            // Validate required fields
            assertRequiredFields(employeeData);

            // Validate email format
            const emailError = validateEmail(employeeData.email);
            if (emailError) {
                throw new Error(emailError);
            }

            // Check for duplicate email
            if (
                employeeData.email &&
                employeeData.email.trim() !== "" &&
                employeeData.email.trim() !== "-" &&
                existingEmails.has(employeeData.email.toLowerCase())
            ) {
                throw new Error("อีเมลนี้ถูกใช้งานแล้ว");
            }

            // Validate department code
            const departmentId = getDepartmentId(
                employeeData.department,
                departmentMap,
            );
            if (departmentId === null) {
                throw new Error(
                    "รหัสแผนกไม่ถูกต้อง ใช้ได้เฉพาะ ADMIN หรือ ACADEMIC",
                );
            }

            // Determine email to use
            const email =
                employeeData.email &&
                employeeData.email.trim() !== "" &&
                employeeData.email.trim() !== "-"
                    ? employeeData.email.trim()
                    : generateTempEmail();

            // Create employee
            const newEmployee = await prisma.employee.create({
                data: {
                    firstName: employeeData.firstName.trim(),
                    lastName: employeeData.lastName.trim(),
                    nickname: employeeData.nickname?.trim() || null,
                    email,
                    phone: employeeData.phone?.trim() || null,
                    position: employeeData.position.trim(),
                    affiliation: employeeData.affiliation?.trim() || null,
                    departmentId,
                },
                include: {
                    dept: true,
                },
            });

            // Add to existing emails set
            if (!email.includes("@temp.local")) {
                existingEmails.add(email.toLowerCase());
            }

            result.success.push({
                firstName: newEmployee.firstName,
                lastName: newEmployee.lastName,
                email: newEmployee.email,
                phone: newEmployee.phone || undefined,
                position: newEmployee.position,
                department: newEmployee.dept.name,
                affiliation: newEmployee.affiliation || undefined,
                nickname: newEmployee.nickname || undefined,
            });
        } catch (error) {
            result.errors.push({
                row: rowNumber,
                data: employeeData,
                error:
                    error instanceof Error
                        ? error.message
                        : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
            });
        }
    }

    return result;
}
