import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { sendLeaveActionNotifications } from "@/lib/services/leave/notifications";
import {
    buildConfiguredApproverSnapshot,
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

    return { ...payload, approver: buildConfiguredApproverSnapshot(approver) };
}

export async function dispatchCurrentLeaveAction(
    notificationId: number,
    payload: LeaveActionPayload,
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        // ผูกการตรวจสิทธิ์กับการส่ง เพื่อให้การโอน commit ได้ก่อน resolve หรือหลังส่งเดิมจบเท่านั้น
        await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM leave_requests WHERE id = ${payload.leaveId} FOR UPDATE
        `;
        const claimed = await tx.notificationOutbox.findFirst({
            where: { id: notificationId, status: "PROCESSING" },
            select: { id: true },
        });
        if (!claimed) return;

        const currentPayload = await resolveCurrentLeaveAction(tx, payload);
        if (!currentPayload) return;
        await sendLeaveActionNotifications(currentPayload);
    }, { timeout: 30_000, maxWait: 5_000 });
}
