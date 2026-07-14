import type { Prisma } from "@prisma/client";

import {
    ACTIVE_LEAVE_APPROVER_USER_SELECT,
    isActiveLeaveApprover,
} from "@/lib/services/leave/approver-eligibility";
import { lockEmployeeRows, runSerializableTransaction } from "@/lib/services/leave/transaction";

export type ApproverAssignment = {
    employeeId: number;
    managerId: number | null;
};

export type ApproverAssignmentActor = {
    userId: number;
    email: string;
};

export class ApproverAssignmentError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
        super(message);
        this.name = "ApproverAssignmentError";
        this.statusCode = statusCode;
    }
}

const APPROVER_MESSAGES = {
    employeeNotFound: "ไม่พบข้อมูลพนักงาน",
    approverNotFound: "ไม่พบข้อมูลผู้อนุมัติ",
    approverUnavailable: "ผู้อนุมัติต้องเป็นพนักงานที่ใช้งานอยู่ มีบัญชีผู้ใช้ที่พร้อมใช้งาน และมีอีเมลที่ใช้งานได้",
    selfAssignment: "ไม่สามารถตั้งตนเองเป็นผู้อนุมัติได้",
    pendingRequests: (employees: Array<{ id: number; name: string }>): string => {
        const details = employees.map(({ id, name }) => `${id} (${name})`).join(", ");
        return `พนักงานที่มีคำขอลารออนุมัติ: ${details} กรุณาให้พนักงานยกเลิกคำขอก่อนเปลี่ยนผู้อนุมัติ รายการทั้งหมดไม่ได้บันทึก`;
    },
    duplicateEmployee: "ห้ามกำหนดผู้อนุมัติซ้ำสำหรับพนักงานคนเดียวกัน",
} as const;

type TransactionClient = Prisma.TransactionClient;

type EmployeeRecord = {
    id: number;
    firstName: string;
    lastName: string;
    managerId: number | null;
};

async function loadApprovers(
    tx: TransactionClient,
    managerIds: number[],
): Promise<Array<{
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    deletedAt: Date | null;
    user: {
        id: number;
        email: string;
        isActive: boolean;
        deletedAt: Date | null;
    } | null;
}>> {
    return tx.employee.findMany({
        where: { id: { in: managerIds } },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            deletedAt: true,
            user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT },
        },
    });
}

async function writeAudit(
    tx: TransactionClient,
    assignment: ApproverAssignment,
    previousManagerId: number | null,
    actor: ApproverAssignmentActor,
): Promise<void> {
    await tx.auditLog.create({
        data: {
            action: "EMPLOYEE_UPDATE",
            entityType: "EmployeeApprover",
            entityId: assignment.employeeId,
            userId: actor.userId,
            userEmail: actor.email,
            details: JSON.stringify({
                before: { managerId: previousManagerId },
                after: { managerId: assignment.managerId },
            }),
        },
    });
}

function formatEmployeeName(employee: { firstName: string; lastName: string }): string {
    return `${employee.firstName} ${employee.lastName}`.trim();
}

export async function assignLeaveApprovers(
    assignments: ApproverAssignment[],
    actor: ApproverAssignmentActor,
): Promise<void> {
    const employeeIds = assignments.map(({ employeeId }) => employeeId);
    if (new Set(employeeIds).size !== employeeIds.length) {
        throw new ApproverAssignmentError(APPROVER_MESSAGES.duplicateEmployee);
    }

    await runSerializableTransaction(async (tx) => {
        await lockEmployeeRows(tx, [...employeeIds].sort((left, right) => left - right));

        const managerIds = assignments.flatMap(({ managerId }) => managerId === null ? [] : [managerId]);
        const [employees, approvers, pendingRequests] = await Promise.all([
            tx.employee.findMany({
                where: { id: { in: employeeIds }, deletedAt: null },
                select: { id: true, firstName: true, lastName: true, managerId: true },
            }),
            loadApprovers(tx, managerIds),
            tx.leaveRequest.findMany({
                where: { employeeId: { in: employeeIds }, status: "PENDING" },
                select: {
                    employeeId: true,
                    employee: { select: { firstName: true, lastName: true } },
                },
            }),
        ]);
        const employeeMap = new Map<number, EmployeeRecord>(employees.map((employee) => [employee.id, employee]));
        const approverMap = new Map(approvers.map((approver) => [approver.id, approver]));
        const pendingByEmployeeId = new Map(
            pendingRequests.map((request) => [request.employeeId, request.employee]),
        );
        const changes: Array<{ assignment: ApproverAssignment; employee: EmployeeRecord }> = [];

        for (const assignment of assignments) {
            const employee = employeeMap.get(assignment.employeeId);
            if (!employee) {
                throw new ApproverAssignmentError(APPROVER_MESSAGES.employeeNotFound, 404);
            }
            if (assignment.employeeId === assignment.managerId) {
                throw new ApproverAssignmentError(APPROVER_MESSAGES.selfAssignment);
            }
            if (employee.managerId === assignment.managerId) continue;

            if (pendingByEmployeeId.has(assignment.employeeId)) {
                const pendingEmployees = [...pendingByEmployeeId.entries()]
                    .map(([id, pending]) => ({
                        id,
                        name: pending ? formatEmployeeName(pending) : "ไม่ทราบชื่อ",
                    }));
                throw new ApproverAssignmentError(APPROVER_MESSAGES.pendingRequests(pendingEmployees), 409);
            }

            if (assignment.managerId !== null) {
                const approver = approverMap.get(assignment.managerId);
                if (!approver) {
                    throw new ApproverAssignmentError(APPROVER_MESSAGES.approverNotFound, 404);
                }
                if (!isActiveLeaveApprover(approver)) {
                    throw new ApproverAssignmentError(APPROVER_MESSAGES.approverUnavailable);
                }
            }

            changes.push({ assignment, employee });
        }

        for (const { assignment, employee } of changes) {
            await tx.employee.update({
                where: { id: assignment.employeeId },
                data: { managerId: assignment.managerId },
            });
            await writeAudit(tx, assignment, employee.managerId, actor);
        }
    });
}
