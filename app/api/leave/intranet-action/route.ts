import { NotificationOutboxType } from "@prisma/client";
import { after, NextResponse } from "next/server";

import { logLeaveEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { processOutbox } from "@/lib/services/outbox/processor";
import { getApiAuthSession } from "@/lib/server-auth";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { operationFailed, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

export async function POST(req: Request): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session?.user?.id) {
            return unauthorized();
        }

        const userId = Number(session.user.id);
        if (isNaN(userId)) {
            return NextResponse.json({ error: COMMON_API_MESSAGES.invalidUserId }, { status: 400 });
        }

        const managerId = await getEmployeeIdFromUserId(userId);
        if (!managerId) {
            return operationFailed(404);
        }

        const { leaveId, action, reason } = await req.json();

        if (!leaveId || !action || !["APPROVE", "REJECT"].includes(action)) {
            return NextResponse.json({ error: COMMON_API_MESSAGES.invalidActionParameters }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: leaveId },
                include: { employee: true },
            });

            if (!leaveRequest) throw new Error("Leave request not found");
            if (leaveRequest.status !== "PENDING") throw new Error("This request is already processed");
            if (leaveRequest.approverId !== managerId) {
                throw new Error("You are not authorized to approve this request");
            }

            const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

            const updatedRequest = await tx.leaveRequest.update({
                where: { id: leaveId },
                data: {
                    status: newStatus,
                    approvedAt: new Date(),
                    rejectReason: action === "REJECT" ? reason : null,
                },
            });

            if (action === "APPROVE") {
                const quota = await tx.leaveQuota.findFirst({
                    where: {
                        employeeId: leaveRequest.employeeId,
                        leaveType: leaveRequest.leaveType,
                        year: new Date(leaveRequest.startDate).getFullYear(),
                    },
                });

                if (!quota) throw new Error("Leave quota not found");

                const remaining = quota.totalDays - quota.usedDays;
                if (leaveRequest.durationDays > remaining) {
                    throw new Error(COMMON_API_MESSAGES.operationFailed);
                }

                await tx.leaveQuota.update({
                    where: { id: quota.id },
                    data: { usedDays: quota.usedDays + leaveRequest.durationDays },
                });
            }

            await tx.notificationOutbox.create({
                data: {
                    type: NotificationOutboxType.LEAVE_RESULT,
                    payload: JSON.stringify({
                        leaveId,
                        employeeId: leaveRequest.employeeId,
                        employeeEmail: leaveRequest.employee.email,
                        status: newStatus,
                        reason: action === "REJECT" ? reason : null,
                    }),
                },
            });

            return updatedRequest;
        });

        const auditAction = action === "APPROVE" ? "LEAVE_REQUEST_APPROVE" : "LEAVE_REQUEST_REJECT";
        const userEmail = session.user.email || `User ${userId}`;

        await logLeaveEvent(auditAction, leaveId, userId, userEmail, {
            after: {
                status: action === "APPROVE" ? "APPROVED" : "REJECTED",
                reason: action === "REJECT" ? reason : null,
            },
        }).catch((err) => console.error("Failed to log audit event:", err));

        after(() => {
            processOutbox().catch((err) =>
                console.error("Failed to process leave outbox in background:", err),
            );
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Intranet Leave Approval Error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : COMMON_API_MESSAGES.failedToProcessLeaveApproval,
            },
            { status: 500 },
        );
    }
}
