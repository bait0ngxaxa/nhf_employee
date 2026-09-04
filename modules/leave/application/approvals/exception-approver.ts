import type { Prisma } from "@prisma/client";

import {
    ACTIVE_LEAVE_APPROVER_USER_SELECT,
    isActiveLeaveApprover,
    type LeaveApproverState,
} from "@/modules/leave/domain/approver-eligibility";

const EXCEPTION_APPROVER_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    nickname: true,
    email: true,
    status: true,
    deletedAt: true,
    user: {
        select: ACTIVE_LEAVE_APPROVER_USER_SELECT,
    },
} as const satisfies Prisma.EmployeeSelect;

type ExceptionApprover = Prisma.EmployeeGetPayload<{
    select: typeof EXCEPTION_APPROVER_SELECT;
}>;

export type LeaveExceptionApproverSource =
    | "ORIGINAL_APPROVER"
    | "ASSIGNED_APPROVER"
    | "CURRENT_MANAGER"
    | "ADMIN";

export type LeaveExceptionApproverResolution = {
    approver: ExceptionApprover;
    source: LeaveExceptionApproverSource;
    exceptionApproverId: number | null;
    assignedAt: Date | null;
    shouldPersist: boolean;
};

export type LeaveDecisionAuthorization =
    | "OWNER"
    | "ASSIGNED_APPROVER"
    | "ADMIN_OVERRIDE"
    | "FORBIDDEN";

export function getEffectiveLeaveApprover<T>(input: {
    approver: T | null | undefined;
    exceptionApprover: T | null | undefined;
}): T | null {
    return input.exceptionApprover ?? input.approver ?? null;
}

export function getEffectiveLeaveApproverId(input: {
    approverId: number | null;
    exceptionApproverId: number | null;
}): number | null {
    return input.exceptionApproverId ?? input.approverId;
}

export function getLeaveDecisionAuthorization<T extends LeaveApproverState>(
    actorEmployeeId: number,
    isAdmin: boolean,
    leaveRequest: {
        employeeId: number;
        approverId: number | null;
        exceptionApproverId: number | null;
        approver: T | null | undefined;
        exceptionApprover: T | null | undefined;
    },
): LeaveDecisionAuthorization {
    if (leaveRequest.employeeId === actorEmployeeId) {
        return "OWNER";
    }

    if (getEffectiveLeaveApproverId(leaveRequest) === actorEmployeeId) {
        return "ASSIGNED_APPROVER";
    }

    return isAdmin && !isActiveLeaveApprover(getEffectiveLeaveApprover(leaveRequest))
        ? "ADMIN_OVERRIDE"
        : "FORBIDDEN";
}

export function normalizeLeaveRecoveryReason(
    reason: string | null | undefined,
): string | null {
    const normalizedReason = reason?.trim();
    return normalizedReason || null;
}

type ResolveLeaveExceptionApproverInput = {
    employeeId: number;
    originalApprover: ExceptionApprover | null | undefined;
    existingApprover: ExceptionApprover | null | undefined;
    reuseExisting: boolean;
};

export async function resolveLeaveExceptionApprover(
    tx: Prisma.TransactionClient,
    input: ResolveLeaveExceptionApproverInput,
): Promise<LeaveExceptionApproverResolution | null> {
    if (input.reuseExisting && isActiveLeaveApprover(input.existingApprover)) {
        return {
            approver: input.existingApprover,
            source: "ASSIGNED_APPROVER",
            exceptionApproverId: input.existingApprover.id,
            assignedAt: null,
            shouldPersist: false,
        };
    }

    if (isActiveLeaveApprover(input.originalApprover)) {
        return {
            approver: input.originalApprover,
            source: "ORIGINAL_APPROVER",
            exceptionApproverId: null,
            assignedAt: null,
            shouldPersist: input.existingApprover?.id !== undefined,
        };
    }

    const employee = await tx.employee.findUnique({
        where: { id: input.employeeId },
        select: {
            manager: {
                select: EXCEPTION_APPROVER_SELECT,
            },
        },
    });
    const currentManager = employee?.manager;
    if (
        currentManager
        && currentManager.id !== input.employeeId
        && isActiveLeaveApprover(currentManager)
    ) {
        return {
            approver: currentManager,
            source: "CURRENT_MANAGER",
            exceptionApproverId: currentManager.id,
            assignedAt: new Date(),
            shouldPersist: true,
        };
    }

    const admins = await tx.employee.findMany({
        where: {
            id: { not: input.employeeId },
            status: "ACTIVE",
            deletedAt: null,
            user: {
                is: {
                    role: "ADMIN",
                    isActive: true,
                    deletedAt: null,
                },
            },
        },
        orderBy: { id: "asc" },
        select: EXCEPTION_APPROVER_SELECT,
    });
    const admin = admins.find(isActiveLeaveApprover);
    if (!admin) {
        return null;
    }

    return {
        approver: admin,
        source: "ADMIN",
        exceptionApproverId: admin.id,
        assignedAt: new Date(),
        shouldPersist: true,
    };
}

/**
 * Persist the effective exception assignment and its generation together.
 * Callers must hold the LeaveRequest row lock before resolving this assignment.
 */
export async function persistLeaveExceptionApprover(
    tx: Prisma.TransactionClient,
    leaveId: string,
    resolution: LeaveExceptionApproverResolution,
): Promise<void> {
    if (!resolution.shouldPersist) return;

    const currentLeaveRequest = await tx.leaveRequest.findUnique({
        where: { id: leaveId },
        select: {
            approverId: true,
            exceptionApproverId: true,
        },
    });
    if (!currentLeaveRequest) {
        throw new Error("Leave request not found");
    }

    const assignmentChanged = getEffectiveLeaveApproverId(currentLeaveRequest)
        !== resolution.approver.id;

    await tx.leaveRequest.update({
        where: { id: leaveId },
        data: {
            exceptionApproverId: resolution.exceptionApproverId,
            exceptionApproverAssignedAt: resolution.assignedAt,
            ...(assignmentChanged
                ? { approvalActionVersion: { increment: 1 } }
                : {}),
        },
    });
}

export type { ExceptionApprover };
