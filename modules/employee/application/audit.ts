import { appendAuditBestEffort } from "@/modules/audit";

import {
    getEmployeeDisplayName,
    type EmployeeDisplayNameSource,
} from "../domain/identity";

export interface EmployeeAuditActor {
    userId: number;
    email: string;
    ipAddress: string | null;
    userAgent: string | null;
}

export interface EmployeeAuditCreateEmployee extends EmployeeDisplayNameSource {
    id: number;
    email: string;
    position: string;
    departmentId: number;
}

export interface EmployeeAuditUpdateInput {
    employeeId: number;
    actor: EmployeeAuditActor;
    before?: Record<string, unknown>;
    after: Record<string, unknown>;
    employee?: EmployeeDisplayNameSource;
    statusChanged: boolean;
}

export interface EmployeeAuditDeleteInput {
    employeeId: number;
    actor: EmployeeAuditActor;
    before?: Record<string, unknown>;
}

export async function appendEmployeeCreateAudit(
    employee: EmployeeAuditCreateEmployee,
    actor: EmployeeAuditActor,
): Promise<void> {
    await appendAuditBestEffort({
        action: "EMPLOYEE_CREATE",
        entityType: "Employee",
        entityId: employee.id,
        userId: actor.userId,
        userEmail: actor.email,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        details: {
            after: {
                firstName: employee.firstName,
                lastName: employee.lastName,
                nickname: employee.nickname,
                email: employee.email,
                position: employee.position,
                departmentId: employee.departmentId,
            },
            metadata: {
                employeeName: getEmployeeDisplayName(employee),
            },
        },
    });
}

export async function appendEmployeeUpdateAudit(
    input: EmployeeAuditUpdateInput,
): Promise<void> {
    await appendAuditBestEffort({
        action: input.statusChanged
            ? "EMPLOYEE_STATUS_CHANGE"
            : "EMPLOYEE_UPDATE",
        entityType: "Employee",
        entityId: input.employeeId,
        userId: input.actor.userId,
        userEmail: input.actor.email,
        ipAddress: input.actor.ipAddress,
        userAgent: input.actor.userAgent,
        details: {
            before: input.before,
            after: input.after,
            metadata: input.employee
                ? { employeeName: getEmployeeDisplayName(input.employee) }
                : undefined,
        },
    });
}

export async function appendEmployeeDeleteAudit(
    input: EmployeeAuditDeleteInput,
): Promise<void> {
    await appendAuditBestEffort({
        action: "EMPLOYEE_DELETE",
        entityType: "Employee",
        entityId: input.employeeId,
        userId: input.actor.userId,
        userEmail: input.actor.email,
        ipAddress: input.actor.ipAddress,
        userAgent: input.actor.userAgent,
        details: { before: input.before },
    });
}
