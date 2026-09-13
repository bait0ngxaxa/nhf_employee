import type { LeaveStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { ACTIVE_LEAVE_APPROVER_QUERY_WHERE } from "@/modules/leave/domain/approver-eligibility";

export const LEAVE_APPROVALS_PAGE_SIZE = 10;

export const LEAVE_REPORT_STATUSES = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
    "NOT_TAKEN",
    "CANCELLATION_REQUESTED",
    "CANCELLED_AFTER_APPROVAL",
] satisfies LeaveStatus[];

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

/**
 * Matches the original approver ownership exposed by the approver-history report.
 */
export function getApproverHistoryReportWhere(
    employeeId: number,
): Prisma.LeaveRequestWhereInput {
    return {
        approverId: employeeId,
        status: { in: LEAVE_REPORT_STATUSES },
    };
}

export interface CurrentEmployeeLeaveProjection {
    canApproveLeave: boolean;
    canViewLeaveReports: boolean;
}

export interface LiffLeaveRelationshipProjection {
    readonly hasActionableApproval: boolean;
}

export async function getLiffLeaveRelationshipProjection(
    employeeId: number,
): Promise<LiffLeaveRelationshipProjection> {
    const actionableApproval = await prisma.leaveRequest.findFirst({
        where: {
            AND: [
                getAssignedLeaveApproverWhere(employeeId),
                getActionableLeaveApprovalWhere(),
            ],
        },
        select: { id: true },
    });

    return { hasActionableApproval: actionableApproval !== null };
}

export async function getCurrentEmployeeLeaveProjection(
    employeeId: number,
    isManager: boolean,
): Promise<CurrentEmployeeLeaveProjection> {
    const actionableWhere = getActionableLeaveApprovalWhere();
    const [originalApproval, exceptionApproval, approvalHistory] = await Promise.all([
        prisma.leaveRequest.findFirst({
            where: {
                approverId: employeeId,
                exceptionApproverId: null,
                ...actionableWhere,
            },
            select: { id: true },
        }),
        prisma.leaveRequest.findFirst({
            where: {
                exceptionApproverId: employeeId,
                ...actionableWhere,
            },
            select: { id: true },
        }),
        prisma.leaveRequest.findFirst({
            where: getApproverHistoryReportWhere(employeeId),
            select: { id: true },
        }),
    ]);

    const hasActionableApproval = originalApproval !== null
        || exceptionApproval !== null;

    return {
        canApproveLeave: isManager || hasActionableApproval,
        canViewLeaveReports: isManager || approvalHistory !== null,
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
