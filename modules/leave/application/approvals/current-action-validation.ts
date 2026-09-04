import type { Prisma } from "@prisma/client";

import { getApproverLeaveActions } from "@/modules/leave/domain/action-availability";
import {
    buildConfiguredApproverSnapshot,
    buildLegacyLeaveActionDeliveryIdentity,
    buildLeaveActionDeliveryIdentity,
    getLeaveActionDeliveryIdentity,
    type LeaveActionPayload,
    type LeaveCancellationRequestedPayload,
    type LeaveNotTakenRequestedPayload,
} from "@/modules/leave/application/notifications/notification-payloads";
import {
    ACTIVE_LEAVE_APPROVER_USER_SELECT,
    isActiveLeaveApprover,
} from "@/modules/leave/domain/approver-eligibility";
import {
    INITIAL_LEAVE_APPROVAL_ACTION_VERSION,
} from "@/modules/leave/domain/approval-action-version";
import {
    getEffectiveLeaveApprover,
    getEffectiveLeaveApproverId,
} from "@/modules/leave/application/approvals/exception-approver";

const CURRENT_LEAVE_ACTION_SELECT = {
    id: true,
    status: true,
    startDate: true,
    notTakenRequestedAt: true,
    notTakenConfirmedAt: true,
    cancellationRequestedAt: true,
    cancellationConfirmedAt: true,
    approverId: true,
    exceptionApproverId: true,
    approvalActionVersion: true,
    approver: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
            email: true,
            status: true,
            deletedAt: true,
            user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT },
        },
    },
    exceptionApprover: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
            email: true,
            status: true,
            deletedAt: true,
            user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT },
        },
    },
} as const satisfies Prisma.LeaveRequestSelect;

type CurrentLeaveActionRequest = Prisma.LeaveRequestGetPayload<{
    select: typeof CURRENT_LEAVE_ACTION_SELECT;
}>;

async function findCurrentLeaveActionRequest(
    tx: Prisma.TransactionClient,
    leaveId: string,
): Promise<CurrentLeaveActionRequest | null> {
    return tx.leaveRequest.findUnique({
        where: { id: leaveId },
        select: CURRENT_LEAVE_ACTION_SELECT,
    });
}

function hasCurrentApprover(
    leaveRequest: CurrentLeaveActionRequest,
    approver: { employeeId: number; userId: number },
): boolean {
    const currentApprover = getEffectiveLeaveApprover(leaveRequest);
    return Boolean(
        currentApprover
        && isActiveLeaveApprover(currentApprover)
        && getEffectiveLeaveApproverId(leaveRequest) === approver.employeeId
        && currentApprover.user.id === approver.userId,
    );
}

export async function resolveCurrentLeaveAction(
    tx: Prisma.TransactionClient,
    payload: LeaveActionPayload,
): Promise<LeaveActionPayload | null> {
    const leaveRequest = await findCurrentLeaveActionRequest(tx, payload.leaveId);
    const approver = leaveRequest
        ? getEffectiveLeaveApprover(leaveRequest)
        : null;
    if (
        leaveRequest?.status !== "PENDING"
        || !isActiveLeaveApprover(approver)
        || !getApproverLeaveActions(leaveRequest).some((action) =>
            action === "APPROVE" || action === "REJECT"
        )
        || !hasCurrentApprover(leaveRequest, payload.approver)
    ) {
        return null;
    }

    const currentIdentity = buildLeaveActionDeliveryIdentity(
        leaveRequest.id,
        approver.user.id,
        leaveRequest.approvalActionVersion,
    );
    const payloadIdentity = getLeaveActionDeliveryIdentity(payload);
    const isLegacyVersionOneIdentity =
        leaveRequest.approvalActionVersion === INITIAL_LEAVE_APPROVAL_ACTION_VERSION
        && leaveRequest.exceptionApproverId === null
        && payloadIdentity === buildLegacyLeaveActionDeliveryIdentity(
            leaveRequest.id,
            approver.user.id,
        );
    if (payloadIdentity !== currentIdentity && !isLegacyVersionOneIdentity) {
        return null;
    }

    return {
        ...payload,
        deliveryIdentity: currentIdentity,
        approver: buildConfiguredApproverSnapshot(approver),
    };
}

export async function resolveCurrentLeaveCancellationAction(
    tx: Prisma.TransactionClient,
    payload: LeaveCancellationRequestedPayload,
): Promise<LeaveCancellationRequestedPayload | null> {
    const leaveRequest = await findCurrentLeaveActionRequest(tx, payload.leaveId);
    if (
        !leaveRequest
        || leaveRequest.status !== "CANCELLATION_REQUESTED"
        || leaveRequest.cancellationRequestedAt === null
        || leaveRequest.cancellationConfirmedAt !== null
        || !getApproverLeaveActions(leaveRequest).some((action) =>
            action === "CONFIRM_CANCELLATION" || action === "REJECT_CANCELLATION"
        )
        || !hasCurrentApprover(leaveRequest, payload.approver)
    ) {
        return null;
    }

    return payload;
}

export async function resolveCurrentLeaveNotTakenAction(
    tx: Prisma.TransactionClient,
    payload: LeaveNotTakenRequestedPayload,
): Promise<LeaveNotTakenRequestedPayload | null> {
    const leaveRequest = await findCurrentLeaveActionRequest(tx, payload.leaveId);
    if (
        !leaveRequest
        || leaveRequest.status !== "APPROVED"
        || leaveRequest.notTakenRequestedAt === null
        || leaveRequest.notTakenConfirmedAt !== null
        || !getApproverLeaveActions(leaveRequest).includes("CONFIRM_NOT_TAKEN")
        || !hasCurrentApprover(leaveRequest, payload.approver)
    ) {
        return null;
    }

    return payload;
}

