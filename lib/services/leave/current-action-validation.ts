import type { Prisma } from "@prisma/client";

import {
    buildConfiguredApproverSnapshot,
    buildLeaveActionDeliveryIdentity,
    getLeaveActionDeliveryIdentity,
    type LeaveActionPayload,
} from "@/lib/services/leave/notification-payloads";
import {
    ACTIVE_LEAVE_APPROVER_USER_SELECT,
    isActiveLeaveApprover,
} from "@/lib/services/leave/approver-eligibility";

export async function resolveCurrentLeaveAction(
    tx: Prisma.TransactionClient,
    payload: LeaveActionPayload,
): Promise<LeaveActionPayload | null> {
    const leaveRequest = await tx.leaveRequest.findUnique({
        where: { id: payload.leaveId },
        select: {
            status: true,
            approver: {
                select: {
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
                },
            },
        },
    });
    const approver = leaveRequest?.approver;
    if (
        leaveRequest?.status !== "PENDING"
        || !isActiveLeaveApprover(approver)
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

