import type { Prisma } from "@prisma/client";

import {
    applyEmployeeAccountLifecycle,
    assertEmployeeAccountCanDeactivate,
    EmployeeAccountLifecycleError,
    lockEmployeeAccountForLifecycle,
    synchronizeEmployeeAccountIdentity,
    type LockedEmployeeAccount,
} from "@/lib/auth/employee-account-lifecycle";
import { lockEmployeeRows } from "@/lib/db/row-locks";
import { hasPrismaErrorCode, runSerializableTransaction } from "@/lib/db/transaction";
import { prisma } from "@/lib/db/prisma";
import {
    employeeLifecycleNeedsWrite,
    isEmployeeDeactivation,
    type EmployeeLifecycleOperation,
    type EmployeeStatusValue,
} from "../domain/lifecycle";
import { getEmployeeDisplayName, getEmployeeFullName } from "../domain/identity";
import { EMPLOYEE_WITH_RELATIONS_INCLUDE, employeeEmailExists } from "../infrastructure/persistence/employee-queries";
import type {
    CreateEmployeeData,
    EmployeeLifecycleActor,
    EmployeeMutationResult,
    EmployeeRecord,
    EmployeeOffboardingDependency,
    EmployeeOffboardingDependencyProvider,
    UpdateEmployeeData,
} from "./types";

type LifecycleEmployee = {
    id: number;
    firstName: string;
    lastName: string;
    nickname: string | null;
    email: string;
    status: EmployeeStatusValue;
    deletedAt: Date | null;
    user: LockedEmployeeAccount | null;
};

type EmployeeSummary = Pick<LifecycleEmployee, "id" | "firstName" | "lastName" | "nickname">;
type IdentityUpdate = { name?: string; email?: string };

class EmployeeMutationError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "EmployeeMutationError";
        this.statusCode = statusCode;
    }
}

const MESSAGES = {
    employeeNotFound: "ไม่พบข้อมูลพนักงาน",
    lifecycleActorRequired: "ไม่พบผู้ดำเนินการสำหรับการเปลี่ยนสถานะพนักงาน",
    linkedUserEmailRequired: "พนักงานที่มีบัญชีผู้ใช้ต้องมีอีเมลองค์กรที่ใช้งานได้",
    invalidEmail: "รูปแบบอีเมลไม่ถูกต้อง",
    organizationEmailOnly: "กรุณาใช้อีเมลองค์กร (@thainhf.org) เท่านั้น",
    emailAlreadyUsed: "อีเมลนี้ถูกใช้งานแล้ว",
} as const;

const LIFECYCLE_EMPLOYEE_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    nickname: true,
    email: true,
    status: true,
    deletedAt: true,
    user: {
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            deletedAt: true,
        },
    },
} as const satisfies Prisma.EmployeeSelect;

function managerDependenciesMessage(
    subordinates: readonly EmployeeSummary[],
    leaveDependencies: readonly EmployeeOffboardingDependency[],
): string {
    const details: string[] = [];
    if (subordinates.length > 0) {
        details.push(`ผู้ใต้บังคับบัญชาที่ต้องกำหนดผู้จัดการใหม่: ${subordinates
            .map((employee) => `${employee.id} (${getEmployeeDisplayName(employee)})`).join(", ")}`);
    }
    if (leaveDependencies.length > 0) {
        details.push(`คำขอลาที่ต้องจัดการก่อนปิดใช้งาน: ${leaveDependencies
            .map((request) => `${request.id} (${getEmployeeDisplayName(request.employee)})`).join(", ")}`);
    }
    return `ไม่สามารถปิดใช้งานพนักงานได้ กรุณากำหนดผู้จัดการหรือผู้อนุมัติใหม่ก่อนดำเนินการ: ${details.join("; ")}`;
}

function buildBeforeData(
    employee: LifecycleEmployee,
    account: LockedEmployeeAccount | null,
): Record<string, unknown> {
    return {
        firstName: employee.firstName,
        lastName: employee.lastName,
        nickname: employee.nickname,
        email: employee.email,
        status: employee.status,
        deletedAt: employee.deletedAt,
        userId: account?.id ?? null,
        userRole: account?.role ?? null,
        userIsActive: account?.isActive ?? null,
    };
}

async function findLifecycleEmployee(
    tx: Prisma.TransactionClient,
    employeeId: number,
): Promise<LifecycleEmployee | null> {
    return tx.employee.findUnique({ where: { id: employeeId }, select: LIFECYCLE_EMPLOYEE_SELECT });
}

async function findCommittedEmployee(
    tx: Prisma.TransactionClient,
    employeeId: number,
): Promise<EmployeeRecord> {
    const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        include: EMPLOYEE_WITH_RELATIONS_INCLUDE,
    });
    if (!employee) throw new EmployeeMutationError(MESSAGES.employeeNotFound, 404);
    return employee as EmployeeRecord;
}

async function lockEmployeeForMutation(
    tx: Prisma.TransactionClient,
    employeeId: number,
    allowDeleted: boolean,
): Promise<{ employee: LifecycleEmployee; account: LockedEmployeeAccount | null }> {
    await lockEmployeeRows(tx, [employeeId]);
    const employee = await findLifecycleEmployee(tx, employeeId);
    if (!employee || (!allowDeleted && employee.deletedAt !== null)) {
        throw new EmployeeMutationError(MESSAGES.employeeNotFound, 404);
    }
    if (employee.user) await lockEmployeeAccountForLifecycle(tx, employee.user.id);
    const lockedEmployee = await findLifecycleEmployee(tx, employeeId);
    if (!lockedEmployee || (!allowDeleted && lockedEmployee.deletedAt !== null)) {
        throw new EmployeeMutationError(MESSAGES.employeeNotFound, 404);
    }
    return { employee: lockedEmployee, account: lockedEmployee.user };
}

async function assertCanDeactivateEmployee(
    tx: Prisma.TransactionClient,
    employee: LifecycleEmployee,
    account: LockedEmployeeAccount | null,
    actor: EmployeeLifecycleActor,
    offboardingDependencyProvider: EmployeeOffboardingDependencyProvider,
): Promise<void> {
    if (account) await assertEmployeeAccountCanDeactivate(tx, account, actor.userId);
    const [subordinates, leaveDependencies] = await Promise.all([
        tx.employee.findMany({
            where: { managerId: employee.id, deletedAt: null },
            select: { id: true, firstName: true, lastName: true, nickname: true },
            orderBy: { id: "asc" },
        }),
        offboardingDependencyProvider(tx, employee.id),
    ]);
    if (subordinates.length > 0) {
        await lockEmployeeRows(tx, subordinates.map((subordinate) => subordinate.id));
    }
    if (subordinates.length > 0 || leaveDependencies.length > 0) {
        throw new EmployeeMutationError(
            managerDependenciesMessage(subordinates, leaveDependencies),
            409,
        );
    }
}

function generateTempEmail(): string {
    return `no-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@temp.local`;
}

function buildEmployeeUpdateData(data: UpdateEmployeeData): Prisma.EmployeeUncheckedUpdateInput {
    const result: Prisma.EmployeeUncheckedUpdateInput = {};
    if (data.firstName) result.firstName = data.firstName.trim();
    if (data.lastName) result.lastName = data.lastName.trim();
    if (data.nickname !== undefined) result.nickname = data.nickname?.trim() || null;
    if (data.phone !== undefined) result.phone = data.phone?.trim() || null;
    if (data.position) result.position = data.position.trim();
    if (data.affiliation !== undefined) result.affiliation = data.affiliation?.trim() || null;
    if (data.departmentId) result.departmentId = data.departmentId;
    return result;
}

async function prepareEmployeeUpdate(
    tx: Prisma.TransactionClient,
    employee: LifecycleEmployee,
    account: LockedEmployeeAccount | null,
    data: UpdateEmployeeData,
): Promise<{ employeeData: Prisma.EmployeeUncheckedUpdateInput; identity: IdentityUpdate }> {
    const employeeData = buildEmployeeUpdateData(data);
    const identity: IdentityUpdate = {};
    if (data.firstName !== undefined || data.lastName !== undefined) {
        const name = getEmployeeFullName(
            data.firstName?.trim() || employee.firstName,
            data.lastName?.trim() || employee.lastName,
        );
        if (account && account.name !== name) identity.name = name;
    }
    if (data.email === undefined) return { employeeData, identity };

    const trimmed = data.email.trim();
    if (trimmed === "" || trimmed === "-") {
        if (account) throw new EmployeeMutationError(MESSAGES.linkedUserEmailRequired, 400);
        employeeData.email = generateTempEmail();
        return { employeeData, identity };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        throw new EmployeeMutationError(MESSAGES.invalidEmail, 400);
    }
    const normalizedEmail = trimmed.toLowerCase();
    if (!normalizedEmail.endsWith("@thainhf.org")) {
        throw new EmployeeMutationError(MESSAGES.organizationEmailOnly, 400);
    }
    const [employeeWithEmail, userWithEmail] = await Promise.all([
        tx.employee.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
        tx.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    ]);
    if ((employeeWithEmail && employeeWithEmail.id !== employee.id)
        || (userWithEmail && userWithEmail.id !== account?.id)) {
        throw new EmployeeMutationError(MESSAGES.emailAlreadyUsed, 400);
    }
    employeeData.email = normalizedEmail;
    if (account && account.email !== normalizedEmail) identity.email = normalizedEmail;
    return { employeeData, identity };
}

async function writeLifecycleAudit(
    tx: Prisma.TransactionClient,
    employee: LifecycleEmployee,
    account: LockedEmployeeAccount | null,
    operation: EmployeeLifecycleOperation,
    actor: EmployeeLifecycleActor,
    beforeData: Record<string, unknown>,
    status: EmployeeStatusValue,
    deletedAt: Date | null,
): Promise<void> {
    await tx.auditLog.create({
        data: {
            action: operation === "OFFBOARD" ? "EMPLOYEE_DELETE" : "EMPLOYEE_STATUS_CHANGE",
            entityType: "Employee",
            entityId: employee.id,
            userId: actor.userId,
            userEmail: actor.email,
            details: JSON.stringify({
                before: beforeData,
                after: {
                    status,
                    deletedAt,
                    userId: account?.id ?? null,
                    userIsActive: isEmployeeDeactivation(operation) ? false : true,
                },
                metadata: { employeeName: getEmployeeDisplayName(employee) },
            }),
        },
    });
}

async function runEmployeeLifecycle(
    employeeId: number,
    operation: EmployeeLifecycleOperation,
    actor: EmployeeLifecycleActor,
    data: UpdateEmployeeData = {},
    offboardingDependencyProvider?: EmployeeOffboardingDependencyProvider,
): Promise<EmployeeMutationResult> {
    try {
        return await runSerializableTransaction(async (tx) => {
            const { employee, account } = await lockEmployeeForMutation(
                tx,
                employeeId,
                !isEmployeeDeactivation(operation),
            );
            const { employeeData, identity } = await prepareEmployeeUpdate(tx, employee, account, data);
            const beforeData = buildBeforeData(employee, account);
            if (!employeeLifecycleNeedsWrite(operation, employee, account)) {
                if (Object.keys(employeeData).length > 0) {
                    await tx.employee.update({
                        where: { id: employeeId },
                        data: employeeData,
                        include: EMPLOYEE_WITH_RELATIONS_INCLUDE,
                    });
                }
                if (account) await synchronizeEmployeeAccountIdentity(tx, account.id, identity);
                return { success: true, employee: await findCommittedEmployee(tx, employeeId), beforeData };
            }
            if (isEmployeeDeactivation(operation)) {
                if (!offboardingDependencyProvider) {
                    throw new EmployeeMutationError(
                        "ไม่สามารถตรวจสอบความรับผิดชอบด้านการลาได้",
                        500,
                    );
                }
                await assertCanDeactivateEmployee(
                    tx,
                    employee,
                    account,
                    actor,
                    offboardingDependencyProvider,
                );
            }
            const now = new Date();
            const status: EmployeeStatusValue = operation === "OFFBOARD"
                ? "INACTIVE"
                : operation === "SUSPEND" ? "SUSPENDED" : "ACTIVE";
            const employeeResult = await tx.employee.update({
                where: { id: employeeId },
                data: { ...employeeData, status, deletedAt: operation === "OFFBOARD" ? now : null },
                include: EMPLOYEE_WITH_RELATIONS_INCLUDE,
            });
            if (account) {
                await applyEmployeeAccountLifecycle(tx, {
                    accountId: account.id,
                    operation,
                    identity,
                    revokedAt: now,
                });
            }
            await writeLifecycleAudit(
                tx,
                employee,
                account,
                operation,
                actor,
                beforeData,
                employeeResult.status,
                employeeResult.deletedAt,
            );
            return {
                success: true,
                employee: await findCommittedEmployee(tx, employeeId),
                beforeData,
                lifecycle: operation,
                auditRecorded: true,
            };
        });
    } catch (error) {
        if (error instanceof EmployeeMutationError || error instanceof EmployeeAccountLifecycleError) {
            return { success: false, error: error.message, status: error.statusCode };
        }
        if (hasPrismaErrorCode(error, "P2002")) {
            return { success: false, error: MESSAGES.emailAlreadyUsed, status: 400 };
        }
        throw error;
    }
}

async function runEmployeeProfileUpdate(
    employeeId: number,
    data: UpdateEmployeeData,
): Promise<EmployeeMutationResult> {
    try {
        return await runSerializableTransaction(async (tx) => {
            const { employee, account } = await lockEmployeeForMutation(tx, employeeId, false);
            const { employeeData, identity } = await prepareEmployeeUpdate(tx, employee, account, data);
            await tx.employee.update({
                where: { id: employeeId },
                data: employeeData,
                include: EMPLOYEE_WITH_RELATIONS_INCLUDE,
            });
            if (account) await synchronizeEmployeeAccountIdentity(tx, account.id, identity);
            return {
                success: true,
                employee: await findCommittedEmployee(tx, employeeId),
                beforeData: buildBeforeData(employee, account),
            };
        });
    } catch (error) {
        if (error instanceof EmployeeMutationError) {
            return { success: false, error: error.message, status: error.statusCode };
        }
        if (hasPrismaErrorCode(error, "P2002")) {
            return { success: false, error: MESSAGES.emailAlreadyUsed, status: 400 };
        }
        throw error;
    }
}

export async function createEmployee(data: CreateEmployeeData): Promise<EmployeeMutationResult> {
    if (await employeeEmailExists(data.email)) {
        return { success: false, error: MESSAGES.emailAlreadyUsed, status: 400 };
    }
    if (data.email && !data.email.endsWith("@thainhf.org")) {
        return { success: false, error: MESSAGES.organizationEmailOnly, status: 400 };
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
    return { success: true, employee: employee as EmployeeRecord };
}

export async function updateEmployee(
    employeeId: number,
    data: Omit<UpdateEmployeeData, "status"> & { status?: never },
): Promise<EmployeeMutationResult>;

export async function updateEmployee(
    employeeId: number,
    data: UpdateEmployeeData,
    actor: EmployeeLifecycleActor,
    offboardingDependencyProvider: EmployeeOffboardingDependencyProvider,
): Promise<EmployeeMutationResult>;

export async function updateEmployee(
    employeeId: number,
    data: UpdateEmployeeData,
    actor?: EmployeeLifecycleActor,
    offboardingDependencyProvider?: EmployeeOffboardingDependencyProvider,
): Promise<EmployeeMutationResult> {
    if (!data.status) return runEmployeeProfileUpdate(employeeId, data);
    if (!actor) {
        return { success: false, error: MESSAGES.lifecycleActorRequired, status: 403 };
    }
    const operation: EmployeeLifecycleOperation = data.status === "INACTIVE"
        ? "OFFBOARD"
        : data.status === "SUSPENDED" ? "SUSPEND" : "REACTIVATE";
    return runEmployeeLifecycle(
        employeeId,
        operation,
        actor,
        data,
        offboardingDependencyProvider,
    );
}

export async function deleteEmployee(
    employeeId: number,
    actor: EmployeeLifecycleActor,
    offboardingDependencyProvider: EmployeeOffboardingDependencyProvider,
): Promise<EmployeeMutationResult> {
    return runEmployeeLifecycle(
        employeeId,
        "OFFBOARD",
        actor,
        {},
        offboardingDependencyProvider,
    );
}

export async function suspendEmployee(
    employeeId: number,
    actor: EmployeeLifecycleActor,
    offboardingDependencyProvider: EmployeeOffboardingDependencyProvider,
): Promise<EmployeeMutationResult> {
    return runEmployeeLifecycle(
        employeeId,
        "SUSPEND",
        actor,
        {},
        offboardingDependencyProvider,
    );
}

export async function reactivateEmployee(
    employeeId: number,
    actor: EmployeeLifecycleActor,
): Promise<EmployeeMutationResult> {
    return runEmployeeLifecycle(employeeId, "REACTIVATE", actor);
}

export async function offboardEmployee(
    employeeId: number,
    actor: EmployeeLifecycleActor,
    offboardingDependencyProvider: EmployeeOffboardingDependencyProvider,
): Promise<EmployeeMutationResult> {
    return runEmployeeLifecycle(
        employeeId,
        "OFFBOARD",
        actor,
        {},
        offboardingDependencyProvider,
    );
}
