import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    getEmployeeLeaveActions,
    getApproverLeaveActions,
} from "@/lib/services/leave/action-availability";
import { getAssignedLeaveApproverWhere } from "@/lib/services/leave/approval-queries";
import {
    leaveAttachmentSummaryOrderBy,
    leaveAttachmentSummarySelect,
    type LeaveAttachmentUrlBuilder,
    withLeaveAttachmentSummaries,
} from "@/lib/services/leave/attachment-summary";
import { toLeaveRequestDays } from "@/lib/services/leave/half-days";

const LIFF_LEAVE_DETAIL_INCLUDE = {
    employee: {
        select: {
            firstName: true,
            lastName: true,
            nickname: true,
            position: true,
            departmentId: true,
            dept: { select: { name: true } },
        },
    },
    approver: {
        select: {
            firstName: true,
            lastName: true,
            nickname: true,
        },
    },
    attachments: {
        select: leaveAttachmentSummarySelect,
        orderBy: leaveAttachmentSummaryOrderBy,
    },
} as const satisfies Prisma.LeaveRequestInclude;

type StoredLeaveDetail = Prisma.LeaveRequestGetPayload<{
    include: typeof LIFF_LEAVE_DETAIL_INCLUDE;
}>;
type LeaveDetailWithAttachments = ReturnType<
    typeof withLeaveAttachmentSummaries<StoredLeaveDetail>
>;
type LeaveDetailDays = ReturnType<typeof toLeaveRequestDays<LeaveDetailWithAttachments>>;

export interface AuthorizedLeaveDetail extends LeaveDetailDays {
    viewerRole: "REQUESTER" | "APPROVER";
    availableActions: ReturnType<typeof getEmployeeLeaveActions>
        | ReturnType<typeof getApproverLeaveActions>;
}

export interface AuthorizedLeaveAttachment {
    storageKey: string;
    contentType: string;
}

function getParticipantWhere(employeeId: number): Prisma.LeaveRequestWhereInput {
    return {
        OR: [
            { employeeId },
            getAssignedLeaveApproverWhere(employeeId),
        ],
    };
}

export async function getAuthorizedLeaveDetail(
    requestId: string,
    employeeId: number,
    buildAttachmentUrl: LeaveAttachmentUrlBuilder,
): Promise<AuthorizedLeaveDetail | null> {
    const request = await prisma.leaveRequest.findFirst({
        where: {
            id: requestId,
            ...getParticipantWhere(employeeId),
        },
        include: LIFF_LEAVE_DETAIL_INCLUDE,
    });
    if (!request) return null;

    const viewerRole = request.employeeId === employeeId
        ? "REQUESTER"
        : "APPROVER";
    const serialized = toLeaveRequestDays(
        withLeaveAttachmentSummaries(request, buildAttachmentUrl),
    );
    return {
        ...serialized,
        viewerRole,
        availableActions: viewerRole === "REQUESTER"
            ? getEmployeeLeaveActions(request)
            : getApproverLeaveActions(request),
    };
}

export async function getAuthorizedLeaveAttachment(
    attachmentId: string,
    employeeId: number,
): Promise<AuthorizedLeaveAttachment | null> {
    return prisma.leaveAttachment.findFirst({
        where: {
            id: attachmentId,
            leaveRequest: { is: getParticipantWhere(employeeId) },
        },
        select: {
            storageKey: true,
            contentType: true,
        },
    });
}
