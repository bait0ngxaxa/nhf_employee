import { prisma } from "@/lib/prisma";
import { EMPLOYEE_WITH_RELATIONS_INCLUDE } from "./constants";
import type {
    CreateEmployeeData,
    UpdateEmployeeData,
    EmployeeWithRelations,
    EmployeeMutationResult,
} from "./types";
import { emailExists } from "./queries";

/**
 * Generate a temporary email for employees without email
 */
function generateTempEmail(): string {
    return `no-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@temp.local`;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Process email field for update - handles empty/dash values
 */
function processEmailForUpdate(
    email: string | undefined,
): { email: string; error?: string } | null {
    if (email === undefined) return null;

    const trimmed = email.trim();
    if (trimmed === "" || trimmed === "-") {
        return { email: generateTempEmail() };
    }

    if (!isValidEmail(trimmed)) {
        return { email: "", error: "รูปแบบอีเมลไม่ถูกต้อง" };
    }

    return { email: trimmed.toLowerCase() };
}

/**
 * Create a new employee
 */
export async function createEmployee(
    data: CreateEmployeeData,
): Promise<EmployeeMutationResult> {
    // Check if email already exists
    if (await emailExists(data.email)) {
        return {
            success: false,
            error: "อีเมลนี้ถูกใช้งานแล้ว",
            status: 400,
        };
    }

    // Validate email domain
    if (data.email && !data.email.endsWith("@thainhf.org")) {
        return {
            success: false,
            error: "กรุณาใช้อีเมลองค์กร (@thainhf.org) เท่านั้น",
            status: 400,
        };
    }

    const employee = await prisma.employee.create({
        data: {
            firstName: data.firstName,
            lastName: data.lastName,
            nickname: data.nickname,
            email: data.email,
            phone: data.phone,
            position: data.position,
            affiliation: data.affiliation,
            departmentId: data.departmentId,
        },
        include: EMPLOYEE_WITH_RELATIONS_INCLUDE,
    });

    return {
        success: true,
        employee: employee as EmployeeWithRelations,
    };
}

/**
 * Update an existing employee
 */
export async function updateEmployee(
    employeeId: number,
    data: UpdateEmployeeData,
): Promise<EmployeeMutationResult & { beforeData?: Record<string, unknown> }> {
    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
    });

    if (!existingEmployee) {
        return {
            success: false,
            error: "ไม่พบข้อมูลพนักงาน",
            status: 404,
        };
    }

    // Store before values for audit
    const beforeData = {
        firstName: existingEmployee.firstName,
        lastName: existingEmployee.lastName,
        email: existingEmployee.email,
        status: existingEmployee.status,
    };

    // Prepare update data
    const dataToUpdate: Record<string, unknown> = {};

    if (data.firstName) dataToUpdate.firstName = data.firstName.trim();
    if (data.lastName) dataToUpdate.lastName = data.lastName.trim();
    if (data.nickname !== undefined) {
        dataToUpdate.nickname = data.nickname?.trim() || null;
    }
    if (data.phone !== undefined) {
        dataToUpdate.phone = data.phone?.trim() || null;
    }
    if (data.position) dataToUpdate.position = data.position.trim();
    if (data.affiliation !== undefined) {
        dataToUpdate.affiliation = data.affiliation?.trim() || null;
    }
    if (data.departmentId) dataToUpdate.departmentId = data.departmentId;
    if (data.status) dataToUpdate.status = data.status;

    // Handle email update
    if (data.email !== undefined) {
        const emailResult = processEmailForUpdate(data.email);
        if (emailResult) {
            if (emailResult.error) {
                return {
                    success: false,
                    error: emailResult.error,
                    status: 400,
                };
            }

            // Check for duplicate email if real email provided
            if (!emailResult.email.includes("@temp.local")) {
                // Validate email domain
                if (!emailResult.email.endsWith("@thainhf.org")) {
                    return {
                        success: false,
                        error: "กรุณาใช้อีเมลองค์กร (@thainhf.org) เท่านั้น",
                        status: 400,
                    };
                }

                if (await emailExists(emailResult.email, employeeId)) {
                    return {
                        success: false,
                        error: "อีเมลนี้ถูกใช้งานแล้ว",
                        status: 400,
                    };
                }
            }

            dataToUpdate.email = emailResult.email;
        }
    }

    // Update employee
    const updatedEmployee = await prisma.employee.update({
        where: { id: employeeId },
        data: dataToUpdate,
        include: EMPLOYEE_WITH_RELATIONS_INCLUDE,
    });

    return {
        success: true,
        employee: updatedEmployee as EmployeeWithRelations,
        beforeData,
    };
}

/**
 * Delete an employee
 */
export async function deleteEmployee(employeeId: number): Promise<{
    success: boolean;
    beforeData?: Record<string, unknown>;
    error?: string;
    status?: number;
}> {
    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
    });

    if (!existingEmployee) {
        return {
            success: false,
            error: "ไม่พบข้อมูลพนักงาน",
            status: 404,
        };
    }

    // Store employee data before deletion for audit
    const beforeData = {
        firstName: existingEmployee.firstName,
        lastName: existingEmployee.lastName,
        email: existingEmployee.email,
    };

    // Delete employee
    await prisma.employee.delete({
        where: { id: employeeId },
    });

    return { success: true, beforeData };
}
