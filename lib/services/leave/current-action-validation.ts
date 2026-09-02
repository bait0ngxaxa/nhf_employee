import type { Prisma } from "@prisma/client";

import { getApproverLeaveActions } from "@/lib/services/leave/action-availability";
import {
    buildConfiguredApproverSnapshot,
    buildLeaveActionDeliveryIdentity,
    getLeaveActionDeliveryIdentity,
    type LeaveActionPayload,
    type LeaveCancellationRequestedPayload,
    type LeaveNotTakenRequestedPayload,
} from "@/lib/services/leave/notification-payloads";
import {
    ACTIVE_LEAVE_APPROVER_USER_SELECT,
    isActiveLeaveApprover,
} from "@/lib/services/leave/approver-eligibility";
import {
    getEffectiveLeaveApprover,
    getEffectiveLeaveApproverId,
} from "@/lib/services/leave/exception-approver";

const CURRENT_LEAVE_ACTION_SELECT = {
    status: true,
    startDate: true,
    notTakenRequestedAt: true,
    notTakenConfirmedAt: true,
    cancellationRequestedAt: true,
    cancellationConfirmedAt: true,
    approverId: true,
    exceptionApproverId: true,
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
    const approver = leaveRequest?.approver;
    if (
        leaveRequest?.status !== "PENDING"
        || !isActiveLeaveApprover(approver)
        || !getApproverLeaveActions(leaveRequest).some((action) =>
            action === "APPROVE" || action === "REJECT"
        )
        || approver.id !== payload.approver.employeeId
        || approver.user.id !== payload.approver.userId
    ) {
        return null;
    }

    const currentIdentity = buildLeaveActionDeliveryIdentity(
        payload.leaveId,
        approver.user.id,
    );
    if (getLeaveActionDeliveryIdentity(payload) !== currentIdentity) {
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

