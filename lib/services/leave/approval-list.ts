import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    createLeaveApprovalMetadata,
    getAssignedLeaveApproverWhere,
    LEAVE_APPROVALS_PAGE_SIZE,
    LEAVE_APPROVAL_REQUEST_INCLUDE,
    type LeaveApprovalPaginationMetadata,
} from "@/lib/services/leave/approval-queries";
import {
    type LeaveAttachmentUrlBuilder,
    withLeaveAttachmentSummaries,
} from "@/lib/services/leave/attachment-summary";
import {
    buildApproverLeaveHistoryFilterWhere,
    getAvailableLeaveHistoryYears,
    type LeaveHistoryFilters,
    type LeaveHistoryMetadata,
} from "@/lib/services/leave/history-filters";
import { toLeaveRequestDays } from "@/lib/services/leave/half-days";

type StoredApprovalRequest = Prisma.LeaveRequestGetPayload<{
    include: typeof LEAVE_APPROVAL_REQUEST_INCLUDE;
}>;
type ApprovalRequestWithAttachments = ReturnType<
    typeof withLeaveAttachmentSummaries<StoredApprovalRequest>
>;
export type SerializedLeaveApprovalRequest = ReturnType<
    typeof toLeaveRequestDays<ApprovalRequestWithAttachments>
>;

export interface LeaveApprovalListData {
    pending: SerializedLeaveApprovalRequest[];
    notTakenPending: SerializedLeaveApprovalRequest[];
    history: SerializedLeaveApprovalRequest[];
    cancellationPending: SerializedLeaveApprovalRequest[];
    metadata: {
        pending: LeaveApprovalPaginationMetadata;
        notTakenPending: LeaveApprovalPaginationMetadata;
        history: LeaveHistoryMetadata;
        cancellationPending: LeaveApprovalPaginationMetadata;
    };
}

export interface LeaveApprovalListQuery {
    managerId: number;
    pendingPage: number;
    notTakenPage: number;
    historyPage: number;
    cancellationPage: number;
    historyFilters: LeaveHistoryFilters;
    includeHistory?: boolean;
    buildAttachmentUrl?: LeaveAttachmentUrlBuilder;
}

export async function getLeaveApprovalList(
    input: LeaveApprovalListQuery,
): Promise<LeaveApprovalListData> {
    const assignedApproverWhere = getAssignedLeaveApproverWhere(input.managerId);
    const pendingWhere: Prisma.LeaveRequestWhereInput = {
        ...assignedApproverWhere,
        status: "PENDING",
    };
    const notTakenWhere: Prisma.LeaveRequestWhereInput = {
        ...assignedApproverWhere,
        status: "APPROVED",
        notTakenRequestedAt: { not: null },
        notTakenConfirmedAt: null,
    };
    const cancellationWhere: Prisma.LeaveRequestWhereInput = {
        ...assignedApproverWhere,
        status: "CANCELLATION_REQUESTED",
    };
    const historyScopeConditions: Prisma.LeaveRequestWhereInput[] = [
        assignedApproverWhere,
        {
            OR: [
                { status: { in: ["REJECTED", "NOT_TAKEN", "CANCELLED_AFTER_APPROVAL"] } },
                {
                    status: "APPROVED",
                    OR: [
                        { notTakenRequestedAt: null },
                        { notTakenConfirmedAt: { not: null } },
                    ],
                },
            ],
        },
    ];
    const historyScopeWhere: Prisma.LeaveRequestWhereInput = {
        AND: historyScopeConditions,
    };
    const historyFilterWhere = buildApproverLeaveHistoryFilterWhere(
        input.historyFilters,
    );
    const historyWhere: Prisma.LeaveRequestWhereInput = historyFilterWhere
        ? { AND: [...historyScopeConditions, historyFilterWhere] }
        : historyScopeWhere;
    const includeHistory = input.includeHistory ?? true;

    const [
        pending,
        pendingCount,
        notTakenPending,
        notTakenCount,
        history,
        historyCount,
        cancellationPending,
        cancellationCount,
        availableYearRange,
    ] = await Promise.all([
        prisma.leaveRequest.findMany({
            where: pendingWhere,
            skip: (input.pendingPage - 1) * LEAVE_APPROVALS_PAGE_SIZE,
            take: LEAVE_APPROVALS_PAGE_SIZE,
            orderBy: { createdAt: "asc" },
            include: LEAVE_APPROVAL_REQUEST_INCLUDE,
        }),
        prisma.leaveRequest.count({ where: pendingWhere }),
        prisma.leaveRequest.findMany({
            where: notTakenWhere,
            skip: (input.notTakenPage - 1) * LEAVE_APPROVALS_PAGE_SIZE,
            take: LEAVE_APPROVALS_PAGE_SIZE,
            orderBy: { notTakenRequestedAt: "asc" },
            include: LEAVE_APPROVAL_REQUEST_INCLUDE,
        }),
        prisma.leaveRequest.count({ where: notTakenWhere }),
        includeHistory
            ? prisma.leaveRequest.findMany({
                where: historyWhere,
                skip: (input.historyPage - 1) * LEAVE_APPROVALS_PAGE_SIZE,
                take: LEAVE_APPROVALS_PAGE_SIZE,
                orderBy: { updatedAt: "desc" },
                include: LEAVE_APPROVAL_REQUEST_INCLUDE,
            })
            : Promise.resolve([] as StoredApprovalRequest[]),
        includeHistory
            ? prisma.leaveRequest.count({ where: historyWhere })
            : Promise.resolve(0),
        prisma.leaveRequest.findMany({
            where: cancellationWhere,
            skip: (input.cancellationPage - 1) * LEAVE_APPROVALS_PAGE_SIZE,
            take: LEAVE_APPROVALS_PAGE_SIZE,
            orderBy: { cancellationRequestedAt: "asc" },
            include: LEAVE_APPROVAL_REQUEST_INCLUDE,
        }),
        prisma.leaveRequest.count({ where: cancellationWhere }),
        includeHistory
            ? prisma.leaveRequest.aggregate({
                where: historyScopeWhere,
                _min: { startDate: true },
                _max: { startDate: true },
            })
            : Promise.resolve({
                _min: { startDate: null },
                _max: { startDate: null },
            }),
    ]);
    const availableYears = getAvailableLeaveHistoryYears(
        availableYearRange._min.startDate,
        availableYearRange._max.startDate,
    );

    const serialize = (request: StoredApprovalRequest): SerializedLeaveApprovalRequest =>
        toLeaveRequestDays(
            withLeaveAttachmentSummaries(request, input.buildAttachmentUrl),
        );

    return {
        pending: pending.map(serialize),
        notTakenPending: notTakenPending.map(serialize),
        history: history.map(serialize),
        cancellationPending: cancellationPending.map(serialize),
        metadata: {
            pending: createLeaveApprovalMetadata(input.pendingPage, pendingCount),
            notTakenPending: createLeaveApprovalMetadata(
                input.notTakenPage,
                notTakenCount,
            ),
            history: {
                ...createLeaveApprovalMetadata(input.historyPage, historyCount),
                availableYears,
            },
            cancellationPending: createLeaveApprovalMetadata(
                input.cancellationPage,
                cancellationCount,
            ),
        },
    };
}
