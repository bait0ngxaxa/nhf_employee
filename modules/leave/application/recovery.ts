import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    createLeaveApprovalMetadata,
    getAdminLeaveRecoveryCandidateWhere,
    LEAVE_APPROVALS_PAGE_SIZE,
    LEAVE_APPROVAL_REQUEST_INCLUDE,
} from "@/modules/leave/application/approvals/approval-queries";
import {
    withLeaveAttachmentSummaries,
} from "@/modules/leave/application/queries/attachment-summary";
import { toLeaveRequestDays } from "@/modules/leave/domain/half-days";
import type { LeaveAttachmentSummary } from "@/modules/leave/presentation/types";

type StoredLeaveRecoveryRequest = Prisma.LeaveRequestGetPayload<{
    include: typeof LEAVE_APPROVAL_REQUEST_INCLUDE;
}>;

type LeaveRecoveryRequestWithSummaries = Omit<
    StoredLeaveRecoveryRequest,
    "attachments"
> & {
    attachments: LeaveAttachmentSummary[];
};

export type SerializedLeaveRecoveryRequest = Omit<
    LeaveRecoveryRequestWithSummaries,
    "durationHalfDays" | "overQuotaHalfDays" | "approvalActionVersion"
> & {
    durationDays: number;
    overQuotaDays: number;
};

export interface LeaveAdminRecoveryData {
    notTakenPending: SerializedLeaveRecoveryRequest[];
    cancellationPending: SerializedLeaveRecoveryRequest[];
    metadata: {
        notTakenPending: ReturnType<typeof createLeaveApprovalMetadata>;
        cancellationPending: ReturnType<typeof createLeaveApprovalMetadata>;
    };
}

export interface LeaveAdminRecoveryQuery {
    employeeId: number;
    notTakenPage: number;
    cancellationPage: number;
}

export async function getAdminLeaveRecoveryData(
    query: LeaveAdminRecoveryQuery,
): Promise<LeaveAdminRecoveryData> {
    const recoveryCandidateWhere = getAdminLeaveRecoveryCandidateWhere(
        query.employeeId,
    );
    const notTakenWhere: Prisma.LeaveRequestWhereInput = {
        ...recoveryCandidateWhere,
        status: "APPROVED",
        notTakenRequestedAt: { not: null },
        notTakenConfirmedAt: null,
    };
    const cancellationWhere: Prisma.LeaveRequestWhereInput = {
        ...recoveryCandidateWhere,
        status: "CANCELLATION_REQUESTED",
    };

    const [
        notTakenPending,
        notTakenCount,
        cancellationPending,
        cancellationCount,
    ] = await Promise.all([
        prisma.leaveRequest.findMany({
            where: notTakenWhere,
            skip: (query.notTakenPage - 1) * LEAVE_APPROVALS_PAGE_SIZE,
            take: LEAVE_APPROVALS_PAGE_SIZE,
            orderBy: { notTakenRequestedAt: "asc" },
            include: LEAVE_APPROVAL_REQUEST_INCLUDE,
        }),
        prisma.leaveRequest.count({ where: notTakenWhere }),
        prisma.leaveRequest.findMany({
            where: cancellationWhere,
            skip: (query.cancellationPage - 1) * LEAVE_APPROVALS_PAGE_SIZE,
            take: LEAVE_APPROVALS_PAGE_SIZE,
            orderBy: { cancellationRequestedAt: "asc" },
            include: LEAVE_APPROVAL_REQUEST_INCLUDE,
        }),
        prisma.leaveRequest.count({ where: cancellationWhere }),
    ]);

    const serialize = (
        request: StoredLeaveRecoveryRequest,
    ): SerializedLeaveRecoveryRequest =>
        toLeaveRequestDays(withLeaveAttachmentSummaries(request));

    return {
        notTakenPending: notTakenPending.map(serialize),
        cancellationPending: cancellationPending.map(serialize),
        metadata: {
            notTakenPending: createLeaveApprovalMetadata(
                query.notTakenPage,
                notTakenCount,
            ),
            cancellationPending: createLeaveApprovalMetadata(
                query.cancellationPage,
                cancellationCount,
            ),
        },
    };
}
