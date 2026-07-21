import type { Prisma } from "@prisma/client";

import {
    createLeaveActionInAppNotification,
    sendLeaveActionNotifications,
} from "@/lib/services/leave/notifications";
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
import { runSerializableTransaction } from "@/lib/db/transaction";
import { lockLeaveRequestRow } from "@/lib/services/leave/transaction";

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

export async function dispatchCurrentLeaveAction(
    notificationId: number,
    payload: LeaveActionPayload,
): Promise<"SENT" | "SUPERSEDED"> {
    const currentPayload = await runSerializableTransaction(async (tx) => {
        const claimed = await tx.notificationOutbox.findFirst({
            where: { id: notificationId, status: "PROCESSING" },
            select: { id: true },
        });
        if (!claimed) return null;

        await lockLeaveRequestRow(tx, payload.leaveId);
        const resolved = await resolveCurrentLeaveAction(tx, payload);
        if (resolved) {
            await createLeaveActionInAppNotification(tx, resolved);
            return resolved;
        }

        await tx.notificationOutbox.updateMany({
            where: { id: notificationId, status: "PROCESSING" },
            data: {
                status: "SUPERSEDED",
                lastError: "Superseded by stale leave-action delivery",
            },
        });
        return null;
    });

    if (!currentPayload) return "SUPERSEDED";

    await sendLeaveActionNotifications(currentPayload, { createInApp: false });
    return "SENT";
}
