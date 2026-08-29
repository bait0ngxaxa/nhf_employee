import type { Prisma } from "@prisma/client";

import { ACTIVE_LEAVE_APPROVER_QUERY_WHERE } from "@/lib/services/leave/approver-eligibility";

export const LEAVE_APPROVALS_PAGE_SIZE = 10;

/**
 * Matches leave requests that still need a normal approver action.
 * Historical approval records are intentionally excluded.
 */
export function getActionableLeaveApprovalWhere(): Prisma.LeaveRequestWhereInput {
    return {
        OR: [
            { status: "PENDING" },
            {
                status: "APPROVED",
                notTakenRequestedAt: { not: null },
                notTakenConfirmedAt: null,
            },
            { status: "CANCELLATION_REQUESTED" },
        ],
    };
}

export interface LeaveApprovalPaginationMetadata {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
}

export type LeaveApprovalPageKey =
    | "pendingPage"
    | "notTakenPage"
    | "historyPage"
    | "cancellationPage";

export const LEAVE_APPROVAL_REQUEST_INCLUDE = {
    employee: {
        select: {
            firstName: true,
            lastName: true,
            nickname: true,
            position: true,
            departmentId: true,
            dept: {
                select: {
                    name: true,
                },
            },
        },
    },
    attachments: {
        select: {
            id: true,
            contentType: true,
            sizeBytes: true,
            width: true,
            height: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    },
} as const satisfies Prisma.LeaveRequestInclude;

export function parseLeaveApprovalPage(
    url: URL,
    key: LeaveApprovalPageKey,
): number | null {
    const page = Number.parseInt(url.searchParams.get(key) || "1", 10);
    return Number.isInteger(page) && page > 0 ? page : null;
}

export function createLeaveApprovalMetadata(
    page: number,
    totalItems: number,
): LeaveApprovalPaginationMetadata {
    return {
        currentPage: page,
        totalPages: Math.ceil(totalItems / LEAVE_APPROVALS_PAGE_SIZE),
        totalItems,
        itemsPerPage: LEAVE_APPROVALS_PAGE_SIZE,
    };
}

/**
 * Matches the effective leave approver without granting access based on role.
 * The exception approver takes precedence when present.
 */
export function getAssignedLeaveApproverWhere(
    employeeId: number,
): Prisma.LeaveRequestWhereInput {
    return {
        employeeId: { not: employeeId },
        OR: [
            { exceptionApproverId: employeeId },
            { exceptionApproverId: null, approverId: employeeId },
        ],
    };
}

/**
 * Recovery is limited to requests whose effective approver is unavailable.
 * Requests actively assigned to the current admin stay in the normal workload.
 */
export function getAdminLeaveRecoveryCandidateWhere(
    employeeId: number,
): Prisma.LeaveRequestWhereInput {
    return {
        employeeId: { not: employeeId },
        AND: [
            { NOT: { exceptionApproverId: employeeId } },
            { NOT: { exceptionApproverId: null, approverId: employeeId } },
        ],
        OR: [
            {
                exceptionApproverId: null,
                OR: [
                    { approverId: null },
                    { approver: { isNot: ACTIVE_LEAVE_APPROVER_QUERY_WHERE } },
                ],
            },
            {
                exceptionApproverId: { not: null },
                exceptionApprover: { isNot: ACTIVE_LEAVE_APPROVER_QUERY_WHERE },
            },
        ],
    };
}
