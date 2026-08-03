import type { Prisma } from "@prisma/client";

import {
    ACTIVE_LEAVE_APPROVER_USER_SELECT,
    isActiveLeaveApprover,
} from "@/lib/services/leave/approver-eligibility";

const EXCEPTION_APPROVER_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
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

export async function persistLeaveExceptionApprover(
    tx: Prisma.TransactionClient,
    leaveId: string,
    resolution: LeaveExceptionApproverResolution,
): Promise<void> {
    if (!resolution.shouldPersist) return;

    await tx.leaveRequest.update({
        where: { id: leaveId },
        data: {
            exceptionApproverId: resolution.exceptionApproverId,
            exceptionApproverAssignedAt: resolution.assignedAt,
        },
    });
}

export type { ExceptionApprover };
