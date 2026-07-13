import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { MAX_OUTBOX_ATTEMPTS } from "@/lib/services/outbox/types";
import {
    buildConfiguredApproverSnapshot,
    buildLeaveRecipientSnapshot,
    type LeaveActionPayload,
} from "@/lib/services/leave/notification-payloads";
import {
    ACTIVE_LEAVE_APPROVER_USER_SELECT,
    isActiveLeaveApprover,
} from "@/lib/services/leave/approver-eligibility";

export type ApproverAssignment = {
    employeeId: number;
    managerId: number | null;
    transferPendingRequests?: boolean;
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
    pendingRequestsRequireApprover: "ไม่สามารถยกเลิกผู้อนุมัติขณะที่มีคำขอลารออนุมัติ",
    duplicateEmployee: "ห้ามกำหนดผู้อนุมัติซ้ำสำหรับพนักงานคนเดียวกัน",
} as const;

type TransactionClient = Prisma.TransactionClient;
type ApproverRecord = Awaited<ReturnType<typeof loadApprovers>>[number];
type PendingRequest = Awaited<ReturnType<typeof loadPendingRequests>>[number];
type PendingOutbox = { id: number; payload: string };

function isUsableAccount(email: string): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    return normalizedEmail.includes("@") && !normalizedEmail.endsWith("@temp.local");
}

function validateApprover(approver: ApproverRecord | undefined): ApproverRecord {
    if (!approver) {
        throw new ApproverAssignmentError(APPROVER_MESSAGES.approverNotFound, 404);
    }
    if (
        !isActiveLeaveApprover(approver)
        || !isUsableAccount(approver.user.email)
    ) {
        throw new ApproverAssignmentError(APPROVER_MESSAGES.approverUnavailable);
    }
    return approver;
}

async function loadApprovers(tx: TransactionClient, managerIds: number[]) {
    return tx.employee.findMany({
        where: { id: { in: managerIds } },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            deletedAt: true,
            user: {
                select: ACTIVE_LEAVE_APPROVER_USER_SELECT,
            },
        },
    });
}

async function loadPendingRequests(tx: TransactionClient, employeeIds: number[]) {
    return tx.leaveRequest.findMany({
        where: { employeeId: { in: employeeIds }, status: "PENDING" },
        include: {
            employee: { include: { user: { select: { id: true } } } },
        },
    });
}

function buildTransferredPayload(
    request: PendingRequest,
    approver: ApproverRecord,
): LeaveActionPayload {
    return {
        leaveId: request.id,
        employee: buildLeaveRecipientSnapshot(request.employee),
        approver: buildConfiguredApproverSnapshot(approver),
        leaveType: request.leaveType,
        startDate: request.startDate.toISOString(),
        endDate: request.endDate.toISOString(),
        period: request.period,
        durationDays: request.durationDays,
        reason: request.reason,
        emergencyReason: request.emergencyReason,
        specialReason: request.specialReason,
        overQuotaDays: request.overQuotaDays,
    };
}

async function transferNotification(
    tx: TransactionClient,
    request: PendingRequest,
    approver: ApproverRecord,
    current: PendingOutbox[],
): Promise<void> {
    if (!approver.user) return;
    const payload = JSON.stringify(buildTransferredPayload(request, approver));
    await tx.notification.updateMany({
        where: {
            type: "LEAVE_REQUESTED",
            referenceId: request.id,
            userId: { not: approver.user.id },
            isRead: false,
        },
        data: { isRead: true },
    });
    const [primary, ...duplicates] = current;
    if (primary) {
        await tx.notificationOutbox.update({ where: { id: primary.id }, data: { payload } });
        if (duplicates.length > 0) {
            await tx.notificationOutbox.updateMany({
                where: { id: { in: duplicates.map(({ id }) => id) } },
                data: { status: "SENT", lastError: "Superseded by approver transfer" },
            });
        }
        return;
    }
    await tx.notificationOutbox.create({ data: { type: "LEAVE_ACTION", payload } });
}

async function writeAudit(
    tx: TransactionClient,
    assignment: ApproverAssignment,
    previousManagerId: number | null,
    transferredIds: string[],
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
                metadata: { transferredLeaveRequestIds: transferredIds },
            }),
        },
    });
}

type ApplyAssignmentContext = {
    tx: TransactionClient;
    assignment: ApproverAssignment;
    previousManagerId: number | null;
    requests: PendingRequest[];
    approver: ApproverRecord | null;
    actor: ApproverAssignmentActor;
    outboxMap: Map<string, PendingOutbox[]>;
};

async function applyAssignment(context: ApplyAssignmentContext): Promise<number> {
    const { tx, assignment, previousManagerId, requests, approver, actor, outboxMap } = context;
    if (!approver && requests.length > 0) {
        throw new ApproverAssignmentError(APPROVER_MESSAGES.pendingRequestsRequireApprover);
    }
    await tx.employee.update({
        where: { id: assignment.employeeId },
        data: { managerId: assignment.managerId },
    });
    const transferredIds: string[] = [];
    if (approver) {
        for (const request of requests) {
            const transferred = await tx.leaveRequest.updateMany({
                where: { id: request.id, status: "PENDING" },
                data: { approverId: approver.id },
            });
            if (transferred.count !== 1) continue;
            transferredIds.push(request.id);
            await transferNotification(tx, request, approver, outboxMap.get(request.id) ?? []);
        }
    }
    await writeAudit(tx, assignment, previousManagerId, transferredIds, actor);
    return approver ? transferredIds.length : 0;
}

function indexRequests(requests: PendingRequest[]): Map<number, PendingRequest[]> {
    const result = new Map<number, PendingRequest[]>();
    for (const request of requests) {
        const employeeRequests = result.get(request.employeeId) ?? [];
        employeeRequests.push(request);
        result.set(request.employeeId, employeeRequests);
    }
    return result;
}

function indexOutboxes(outboxes: PendingOutbox[]): Map<string, PendingOutbox[]> {
    const result = new Map<string, PendingOutbox[]>();
    for (const outbox of outboxes) {
        try {
            const parsed = JSON.parse(outbox.payload) as { leaveId?: unknown };
            if (typeof parsed.leaveId !== "string") continue;
            const requestOutboxes = result.get(parsed.leaveId) ?? [];
            requestOutboxes.push(outbox);
            result.set(parsed.leaveId, requestOutboxes);
        } catch {
            continue;
        }
    }
    return result;
}

export async function assignLeaveApprovers(
    assignments: ApproverAssignment[],
    actor: ApproverAssignmentActor,
): Promise<{ transferredLeaveRequestCount: number }> {
    const employeeIds = assignments.map(({ employeeId }) => employeeId);
    if (new Set(employeeIds).size !== employeeIds.length) {
        throw new ApproverAssignmentError(APPROVER_MESSAGES.duplicateEmployee);
    }

    return prisma.$transaction(async (tx) => {
        const managerIds = assignments.flatMap(({ managerId }) => managerId ? [managerId] : []);
        const [employees, approvers, pendingRequests, pendingOutboxes] = await Promise.all([
            tx.employee.findMany({
                where: { id: { in: employeeIds }, deletedAt: null },
                select: { id: true, managerId: true },
            }),
            loadApprovers(tx, managerIds),
            loadPendingRequests(tx, employeeIds),
            tx.notificationOutbox.findMany({
                where: {
                    type: "LEAVE_ACTION",
                    status: { in: ["PENDING", "FAILED", "PROCESSING"] },
                    attempts: { lt: MAX_OUTBOX_ATTEMPTS },
                },
                select: { id: true, payload: true },
                orderBy: { id: "asc" },
            }),
        ]);
        const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
        const approverMap = new Map(approvers.map((approver) => [approver.id, approver]));
        const requestMap = indexRequests(pendingRequests);
        const outboxMap = indexOutboxes(pendingOutboxes);
        let transferredLeaveRequestCount = 0;

        for (const assignment of assignments) {
            const employee = employeeMap.get(assignment.employeeId);
            if (!employee) throw new ApproverAssignmentError(APPROVER_MESSAGES.employeeNotFound, 404);
            if (employee.managerId === assignment.managerId) continue;
            if (assignment.employeeId === assignment.managerId) {
                throw new ApproverAssignmentError(APPROVER_MESSAGES.selfAssignment);
            }
            const approver = assignment.managerId
                ? validateApprover(approverMap.get(assignment.managerId))
                : null;
            transferredLeaveRequestCount += await applyAssignment({
                tx,
                assignment,
                previousManagerId: employee.managerId,
                requests: assignment.transferPendingRequests
                    ? requestMap.get(assignment.employeeId) ?? []
                    : [],
                approver,
                actor,
                outboxMap,
            });
        }
        return { transferredLeaveRequestCount };
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
}
