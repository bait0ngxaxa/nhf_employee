import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    ACTIVE_LEAVE_APPROVER_USER_SELECT,
    isActiveLeaveApprover,
} from "@/lib/services/leave/approver-eligibility";

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
    approverUnavailable: "ผู้อนุมัติต้องเป็นพนักงานที่ใช้งานอยู่และมีบัญชีผู้ใช้ที่พร้อมใช้งาน",
    selfAssignment: "ไม่สามารถตั้งตนเองเป็นผู้อนุมัติได้",
    pendingRequests: "พนักงานมีคำขอลารออนุมัติ กรุณาให้พนักงานยกเลิกคำขอก่อนเปลี่ยนผู้อนุมัติ",
    duplicateEmployee: "ห้ามกำหนดผู้อนุมัติซ้ำสำหรับพนักงานคนเดียวกัน",
} as const;

type TransactionClient = Prisma.TransactionClient;
type ApproverRecord = Awaited<ReturnType<typeof loadApprovers>>[number];

function isUsableAccount(email: string): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    return normalizedEmail.includes("@") && !normalizedEmail.endsWith("@temp.local");
}

function validateApprover(approver: ApproverRecord | undefined): ApproverRecord {
    if (!approver) {
        throw new ApproverAssignmentError(APPROVER_MESSAGES.approverNotFound, 404);
    }
    if (!isActiveLeaveApprover(approver) || !isUsableAccount(approver.user.email)) {
        throw new ApproverAssignmentError(APPROVER_MESSAGES.approverUnavailable);
    }
    return approver;
}

async function loadApprovers(
    tx: TransactionClient,
    managerIds: number[],
) {
    return tx.employee.findMany({
        where: { id: { in: managerIds } },
        select: {
            id: true,
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

export async function assignLeaveApprovers(
    assignments: ApproverAssignment[],
    actor: ApproverAssignmentActor,
): Promise<void> {
    const employeeIds = assignments.map(({ employeeId }) => employeeId);
    if (new Set(employeeIds).size !== employeeIds.length) {
        throw new ApproverAssignmentError(APPROVER_MESSAGES.duplicateEmployee);
    }

    await prisma.$transaction(async (tx) => {
        const managerIds = assignments.flatMap(({ managerId }) => managerId ? [managerId] : []);
        const [employees, approvers, pendingRequests] = await Promise.all([
            tx.employee.findMany({
                where: { id: { in: employeeIds }, deletedAt: null },
                select: { id: true, managerId: true },
            }),
            loadApprovers(tx, managerIds),
            tx.leaveRequest.findMany({
                where: { employeeId: { in: employeeIds }, status: "PENDING" },
                select: { employeeId: true },
            }),
        ]);
        const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
        const approverMap = new Map(approvers.map((approver) => [approver.id, approver]));
        const pendingEmployeeIds = new Set(pendingRequests.map((request) => request.employeeId));

        for (const assignment of assignments) {
            const employee = employeeMap.get(assignment.employeeId);
            if (!employee) throw new ApproverAssignmentError(APPROVER_MESSAGES.employeeNotFound, 404);
            if (employee.managerId === assignment.managerId) continue;
            if (pendingEmployeeIds.has(assignment.employeeId)) {
                throw new ApproverAssignmentError(APPROVER_MESSAGES.pendingRequests, 409);
            }
            if (assignment.employeeId === assignment.managerId) {
                throw new ApproverAssignmentError(APPROVER_MESSAGES.selfAssignment);
            }
            if (assignment.managerId) validateApprover(approverMap.get(assignment.managerId));

            await tx.employee.update({
                where: { id: assignment.employeeId },
                data: { managerId: assignment.managerId },
            });
            await writeAudit(tx, assignment, employee.managerId, actor);
        }
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
}
