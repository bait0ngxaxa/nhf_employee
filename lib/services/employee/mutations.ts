import type { EmployeeStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";
import { EMPLOYEE_WITH_RELATIONS_INCLUDE } from "./constants";
import type {
    CreateEmployeeData,
    UpdateEmployeeData,
    EmployeeWithRelations,
    EmployeeMutationResult,
} from "./types";
import { emailExists } from "./queries";

export type EmployeeLifecycleActor = {
    userId: number;
    email: string;
};

type EmployeeLifecycleOperation = "OFFBOARD" | "SUSPEND" | "REACTIVATE";

type EmployeeMutationWithAudit = EmployeeMutationResult & {
    beforeData?: Record<string, unknown>;
    lifecycle?: EmployeeLifecycleOperation;
    auditRecorded?: boolean;
};

type LifecycleEmployee = {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    status: EmployeeStatus;
    deletedAt: Date | null;
    user: {
        id: number;
        email: string;
        role: string;
        isActive: boolean;
        deletedAt: Date | null;
    } | null;
};

type EmployeeSummary = {
    id: number;
    firstName: string;
    lastName: string;
};

type PendingApprovalSummary = {
    id: string;
    employee: EmployeeSummary;
};

class EmployeeLifecycleError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "EmployeeLifecycleError";
        this.statusCode = statusCode;
    }
}

const EMPLOYEE_LIFECYCLE_MESSAGES = {
    employeeNotFound: "ไม่พบข้อมูลพนักงาน",
    selfOffboarding: "ไม่สามารถปิดใช้งานบัญชีของตนเองได้",
    lastAdmin: "ไม่สามารถปิดใช้งานผู้ดูแลระบบคนสุดท้ายได้",
    managerDependencies: (
        subordinates: EmployeeSummary[],
        leaveDependencies: PendingApprovalSummary[],
    ): string => {
        const details: string[] = [];
        if (subordinates.length > 0) {
            details.push(
                `ผู้ใต้บังคับบัญชาที่ต้องกำหนดผู้จัดการใหม่: ${subordinates
                    .map((employee) => `${employee.id} (${formatEmployeeName(employee)})`)
                    .join(", ")}`,
            );
        }
        if (leaveDependencies.length > 0) {
            details.push(
                `คำขอลาที่ต้องจัดการก่อนปิดใช้งาน: ${leaveDependencies
                    .map((request) => `${request.id} (${formatEmployeeName(request.employee)})`)
                    .join(", ")}`,
            );
        }
        return `ไม่สามารถปิดใช้งานพนักงานได้ กรุณากำหนดผู้จัดการหรือผู้อนุมัติใหม่ก่อนดำเนินการ: ${details.join("; ")}`;
    },
    lifecycleActorRequired: "ไม่พบผู้ดำเนินการสำหรับการเปลี่ยนสถานะพนักงาน",
} as const;

const LIFECYCLE_EMPLOYEE_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    status: true,
    deletedAt: true,
    user: {
        select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            deletedAt: true,
        },
    },
} as const satisfies Prisma.EmployeeSelect;

function formatEmployeeName(employee: EmployeeSummary): string {
    return `${employee.firstName} ${employee.lastName}`.trim();
}

function buildLifecycleBeforeData(employee: LifecycleEmployee): Record<string, unknown> {
    return {
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        status: employee.status,
        deletedAt: employee.deletedAt,
        userId: employee.user?.id ?? null,
        userRole: employee.user?.role ?? null,
        userIsActive: employee.user?.isActive ?? null,
    };
}

function lifecycleNeedsWrite(
    operation: EmployeeLifecycleOperation,
    employee: LifecycleEmployee,
): boolean {
    if (operation === "OFFBOARD") {
        return employee.status !== "INACTIVE"
            || employee.deletedAt === null
            || Boolean(employee.user?.isActive)
            || Boolean(employee.user && employee.user.deletedAt !== null);
    }

    if (operation === "SUSPEND") {
        return employee.status !== "SUSPENDED"
            || employee.deletedAt !== null
            || Boolean(employee.user?.isActive)
            || Boolean(employee.user && employee.user.deletedAt !== null);
    }

    return employee.status !== "ACTIVE"
        || employee.deletedAt !== null
        || Boolean(employee.user && !employee.user.isActive)
        || Boolean(employee.user && employee.user.deletedAt !== null);
}

function isDeactivation(operation: EmployeeLifecycleOperation): boolean {
    return operation === "OFFBOARD" || operation === "SUSPEND";
}

async function findLifecycleEmployee(
    tx: Prisma.TransactionClient,
    employeeId: number,
): Promise<LifecycleEmployee | null> {
    return tx.employee.findUnique({
        where: { id: employeeId },
        select: LIFECYCLE_EMPLOYEE_SELECT,
    });
}

async function assertCanDeactivateEmployee(
    tx: Prisma.TransactionClient,
    employee: LifecycleEmployee,
    actor: EmployeeLifecycleActor,
): Promise<void> {
    if (employee.user?.id === actor.userId) {
        throw new EmployeeLifecycleError(
            EMPLOYEE_LIFECYCLE_MESSAGES.selfOffboarding,
            403,
        );
    }

    if (employee.user?.role === "ADMIN" && employee.user.isActive && !employee.user.deletedAt) {
        const activeAdmins = await tx.user.findMany({
            where: {
                role: "ADMIN",
                isActive: true,
                deletedAt: null,
            },
            select: { id: true },
        });
        await lockUserRows(tx, activeAdmins.map((admin) => admin.id));

        if (activeAdmins.length <= 1) {
            throw new EmployeeLifecycleError(
                EMPLOYEE_LIFECYCLE_MESSAGES.lastAdmin,
                409,
            );
        }
    }

    const [subordinates, leaveDependencies] = await Promise.all([
        tx.employee.findMany({
            where: { managerId: employee.id, deletedAt: null },
            select: { id: true, firstName: true, lastName: true },
            orderBy: { id: "asc" },
        }),
        tx.leaveRequest.findMany({
            where: {
                OR: [
                    { approverId: employee.id },
                    { exceptionApproverId: employee.id },
                ],
                AND: [{
                    OR: [
                        { status: "PENDING" },
                        { status: "CANCELLATION_REQUESTED" },
                        { status: "APPROVED", notTakenRequestedAt: { not: null } },
                    ],
                }],
            },
            select: {
                id: true,
                employee: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { id: "asc" },
        }),
    ]);

    if (subordinates.length > 0) {
        await lockEmployeeRows(tx, subordinates.map((subordinate) => subordinate.id));
    }

    if (subordinates.length > 0 || leaveDependencies.length > 0) {
        throw new EmployeeLifecycleError(
            EMPLOYEE_LIFECYCLE_MESSAGES.managerDependencies(subordinates, leaveDependencies),
            409,
        );
    }
}

async function writeLifecycleAudit(
    tx: Prisma.TransactionClient,
    employeeId: number,
    operation: EmployeeLifecycleOperation,
    actor: EmployeeLifecycleActor,
    beforeData: Record<string, unknown>,
    afterData: Record<string, unknown>,
): Promise<void> {
    await tx.auditLog.create({
        data: {
            action: operation === "OFFBOARD" ? "EMPLOYEE_DELETE" : "EMPLOYEE_STATUS_CHANGE",
            entityType: "Employee",
            entityId: employeeId,
            userId: actor.userId,
            userEmail: actor.email,
            details: JSON.stringify({ before: beforeData, after: afterData }),
        },
    });
}

async function runEmployeeLifecycle(
    employeeId: number,
    operation: EmployeeLifecycleOperation,
    actor: EmployeeLifecycleActor,
    employeeData: Prisma.EmployeeUncheckedUpdateInput = {},
): Promise<EmployeeMutationWithAudit> {
    try {
        return await runSerializableTransaction(async (tx) => {
            await lockEmployeeRows(tx, [employeeId]);

            const employee = await findLifecycleEmployee(tx, employeeId);
            if (!employee || (isDeactivation(operation) && employee.deletedAt !== null)) {
                throw new EmployeeLifecycleError(
                    EMPLOYEE_LIFECYCLE_MESSAGES.employeeNotFound,
                    404,
                );
            }

            if (employee.user) {
                await lockUserRows(tx, [employee.user.id]);
            }

            const lockedEmployee = await findLifecycleEmployee(tx, employeeId);
            if (!lockedEmployee || (isDeactivation(operation) && lockedEmployee.deletedAt !== null)) {
                throw new EmployeeLifecycleError(
                    EMPLOYEE_LIFECYCLE_MESSAGES.employeeNotFound,
                    404,
                );
            }

            const beforeData = buildLifecycleBeforeData(lockedEmployee);
            const shouldWriteLifecycle = lifecycleNeedsWrite(operation, lockedEmployee);

            if (!shouldWriteLifecycle) {
                const employeeResult = Object.keys(employeeData).length > 0
                    ? await tx.employee.update({
                        where: { id: employeeId },
                        data: employeeData,
                        include: EMPLOYEE_WITH_RELATIONS_INCLUDE,
                    })
                    : await tx.employee.findUnique({
                        where: { id: employeeId },
                        include: EMPLOYEE_WITH_RELATIONS_INCLUDE,
                    });

                if (!employeeResult) {
                    throw new EmployeeLifecycleError(
                        EMPLOYEE_LIFECYCLE_MESSAGES.employeeNotFound,
                        404,
                    );
                }

                return {
                    success: true,
                    employee: employeeResult as EmployeeWithRelations,
                    beforeData,
                };
            }

            if (isDeactivation(operation)) {
                await assertCanDeactivateEmployee(tx, lockedEmployee, actor);
            }

            const now = new Date();
            const employeeLifecycleData: Prisma.EmployeeUncheckedUpdateInput = {
                ...employeeData,
                status: operation === "OFFBOARD"
                    ? "INACTIVE"
                    : operation === "SUSPEND"
                        ? "SUSPENDED"
                        : "ACTIVE",
                deletedAt: operation === "OFFBOARD" ? now : null,
            };

            const employeeResult = await tx.employee.update({
                where: { id: employeeId },
                data: employeeLifecycleData,
                include: EMPLOYEE_WITH_RELATIONS_INCLUDE,
            });

            if (lockedEmployee.user) {
                await tx.user.update({
                    where: { id: lockedEmployee.user.id },
                    data: isDeactivation(operation)
                        ? {
                            isActive: false,
                            tokenVersion: { increment: 1 },
                        }
                        : {
                            isActive: true,
                            deletedAt: null,
                            tokenVersion: { increment: 1 },
                        },
                });

                await tx.authRefreshToken.updateMany({
                    where: { userId: lockedEmployee.user.id, revokedAt: null },
                    data: { revokedAt: now },
                });
            }

            await writeLifecycleAudit(
                tx,
                employeeId,
                operation,
                actor,
                beforeData,
                {
                    status: employeeResult.status,
                    deletedAt: employeeResult.deletedAt,
                    userId: lockedEmployee.user?.id ?? null,
                    userIsActive: isDeactivation(operation) ? false : true,
                },
            );

            return {
                success: true,
                employee: employeeResult as EmployeeWithRelations,
                beforeData,
                lifecycle: operation,
                auditRecorded: true,
            };
        });
    } catch (error) {
        if (error instanceof EmployeeLifecycleError) {
            return {
                success: false,
                error: error.message,
                status: error.statusCode,
            };
        }
        throw error;
    }
}

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
    actor?: EmployeeLifecycleActor,
): Promise<EmployeeMutationWithAudit> {
    // Check if employee exists
    const existingEmployee = await prisma.employee.findFirst({
        where: { id: employeeId },
    });

    if (!existingEmployee || (Boolean(existingEmployee.deletedAt) && data.status !== "ACTIVE")) {
        return {
            success: false,
            error: EMPLOYEE_LIFECYCLE_MESSAGES.employeeNotFound,
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
    const dataToUpdate: Prisma.EmployeeUncheckedUpdateInput = {};

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

    if (data.status) {
        if (!actor) {
            return {
                success: false,
                error: EMPLOYEE_LIFECYCLE_MESSAGES.lifecycleActorRequired,
                status: 403,
            };
        }

        const operation: EmployeeLifecycleOperation = data.status === "INACTIVE"
            ? "OFFBOARD"
            : data.status === "SUSPENDED"
                ? "SUSPEND"
                : "REACTIVATE";

        return runEmployeeLifecycle(employeeId, operation, actor, dataToUpdate);
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
 * Suspend an employee without soft-deleting the employee record.
 */
export async function suspendEmployee(
    employeeId: number,
    actor: EmployeeLifecycleActor,
): Promise<EmployeeMutationWithAudit> {
    return runEmployeeLifecycle(employeeId, "SUSPEND", actor);
}

/**
 * Reactivate an employee and explicitly restore the linked user account.
 */
export async function reactivateEmployee(
    employeeId: number,
    actor: EmployeeLifecycleActor,
): Promise<EmployeeMutationWithAudit> {
    return runEmployeeLifecycle(employeeId, "REACTIVATE", actor);
}

/**
 * Offboard an employee and close every linked authentication session.
 */
export async function offboardEmployee(
    employeeId: number,
    actor: EmployeeLifecycleActor,
): Promise<EmployeeMutationWithAudit> {
    return runEmployeeLifecycle(employeeId, "OFFBOARD", actor);
}

/**
 * Delete an employee through the same offboarding lifecycle used by status changes.
 */
export async function deleteEmployee(
    employeeId: number,
    actor: EmployeeLifecycleActor,
): Promise<EmployeeMutationWithAudit> {
    return offboardEmployee(employeeId, actor);
}
