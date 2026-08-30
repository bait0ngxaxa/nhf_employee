import { NotificationOutboxType, type Prisma } from "@prisma/client";

import { runSerializableTransaction } from "@/lib/db/transaction";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";
import { isActiveEmployeeInTransaction } from "@/lib/services/leave/active-employee-session";
import { getAssignedLeaveApproverWhere } from "@/lib/services/leave/approval-queries";
import { buildLeaveAuditContext } from "@/lib/services/leave/audit-details";
import { getLeaveDecisionAuthorization } from "@/lib/services/leave/exception-approver";
import { halfDaysToDays } from "@/lib/services/leave/half-days";
import {
    buildLeaveRecipientSnapshot,
    type LeaveResultPayload,
} from "@/lib/services/leave/notification-payloads";
import { calculateAdditionalOverQuotaHalfDays } from "@/lib/services/leave/over-quota";
import { calculateEffectiveEntitlementHalfDays } from "@/lib/services/leave/quota-accounting";
import {
    ensureLeaveQuotaForYear,
    reconcileLeaveQuotaForward,
} from "@/lib/services/leave/quota-entitlement";
import { getLeaveYearFromDateValue } from "@/lib/services/leave/quota-year";
import { createLeaveAuditInTransaction } from "@/lib/services/leave/transaction";
import type { LeaveActionValues } from "@/lib/validations/leave";

const LEAVE_APPROVAL_MESSAGES = {
    requestNotFound: "ไม่พบคำขอลา",
    alreadyProcessed: "คำขอนี้ถูกดำเนินการไปแล้ว",
    forbidden: "คุณไม่มีสิทธิ์อนุมัติคำขอนี้",
    specialReasonRequired: "สิทธิ์ลาคงเหลือไม่เพียงพอ ต้องมีเหตุผลพิเศษก่อนอนุมัติ",
} as const;

export class LeaveApprovalError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "LeaveApprovalError";
        this.statusCode = statusCode;
    }
}

export interface LeaveDecisionActor {
    userId: number;
    employeeId: number;
    userEmail: string;
    name: string | null;
}

export async function decideLeaveRequest(
    actor: LeaveDecisionActor,
    input: LeaveActionValues,
): Promise<Prisma.LeaveRequestGetPayload<Record<string, never>>> {
    return runSerializableTransaction(async (tx) => {
        if (!await isActiveEmployeeInTransaction(tx, actor.userId, actor.employeeId)) {
            throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.forbidden, 403);
        }
        const leaveRequest = await tx.leaveRequest.findUnique({
            where: { id: input.leaveId },
            include: {
                employee: {
                    include: { user: { select: { id: true } } },
                },
                approver: true,
                exceptionApprover: true,
            },
        });

        if (!leaveRequest) {
            throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.requestNotFound, 404);
        }
        if (
            getLeaveDecisionAuthorization(actor.employeeId, false, leaveRequest)
            !== "ASSIGNED_APPROVER"
        ) {
            throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.forbidden, 403);
        }
        if (leaveRequest.status !== "PENDING") {
            throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.alreadyProcessed, 409);
        }

        const newStatus = input.action === "APPROVE" ? "APPROVED" : "REJECTED";
        const updateData: Prisma.LeaveRequestUpdateInput = {
            status: newStatus,
            approvedAt: new Date(),
            rejectReason: input.action === "REJECT" ? input.reason : null,
        };
        const claimedRequest = await tx.leaveRequest.updateMany({
            where: {
                id: input.leaveId,
                status: "PENDING",
                ...getAssignedLeaveApproverWhere(actor.employeeId),
            },
            data: updateData,
        });
        if (claimedRequest.count !== 1) {
            throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.alreadyProcessed, 409);
        }

        if (input.action === "APPROVE") {
            const quota = await ensureLeaveQuotaForYear(tx, {
                employeeId: leaveRequest.employeeId,
                leaveType: leaveRequest.leaveType,
                year: getLeaveYearFromDateValue(leaveRequest.startDate),
            });
            const effectiveTotalHalfDays = calculateEffectiveEntitlementHalfDays(
                quota.totalHalfDays,
                quota.carryBalanceHalfDays,
            );
            const overQuotaHalfDays = calculateAdditionalOverQuotaHalfDays(
                effectiveTotalHalfDays,
                quota.usedHalfDays,
                leaveRequest.durationHalfDays,
            );
            if (overQuotaHalfDays > 0 && !leaveRequest.specialReason) {
                throw new LeaveApprovalError(
                    LEAVE_APPROVAL_MESSAGES.specialReasonRequired,
                    409,
                );
            }

            await tx.leaveQuota.update({
                where: { id: quota.id },
                data: { usedHalfDays: { increment: leaveRequest.durationHalfDays } },
            });
            await reconcileLeaveQuotaForward(tx, {
                ...quota,
                usedHalfDays: quota.usedHalfDays + leaveRequest.durationHalfDays,
            });
            if (overQuotaHalfDays !== leaveRequest.overQuotaHalfDays) {
                await tx.leaveRequest.updateMany({
                    where: { id: input.leaveId, status: "APPROVED" },
                    data: { overQuotaHalfDays },
                });
            }
        }

        const updatedRequest = await tx.leaveRequest.findUniqueOrThrow({
            where: { id: input.leaveId },
        });
        await tx.notification.updateMany({
            where: {
                userId: actor.userId,
                type: "LEAVE_REQUESTED",
                referenceId: input.leaveId,
                isRead: false,
            },
            data: { isRead: true },
        });

        const payload: LeaveResultPayload = {
            leaveId: input.leaveId,
            employee: buildLeaveRecipientSnapshot(leaveRequest.employee),
            approverName: leaveRequest.approver
                ? getEmployeeDisplayName(leaveRequest.approver)
                : actor.name,
            leaveType: leaveRequest.leaveType,
            startDate: leaveRequest.startDate.toISOString(),
            endDate: leaveRequest.endDate.toISOString(),
            period: leaveRequest.period,
            durationDays: halfDaysToDays(leaveRequest.durationHalfDays),
            status: newStatus,
            reason: input.action === "REJECT" ? input.reason ?? null : null,
        };
        await tx.notificationOutbox.create({
            data: {
                type: NotificationOutboxType.LEAVE_RESULT,
                payload: JSON.stringify(payload),
            },
        });

        await createLeaveAuditInTransaction(
            tx,
            input.action === "APPROVE"
                ? "LEAVE_REQUEST_APPROVE"
                : "LEAVE_REQUEST_REJECT",
            input.leaveId,
            actor.userId,
            actor.userEmail || `User ${actor.userId}`,
            {
                before: { status: "PENDING" },
                after: {
                    status: newStatus,
                    ...(input.action === "REJECT"
                        ? { reason: input.reason ?? null }
                        : {}),
                },
                metadata: buildLeaveAuditContext(leaveRequest, {
                    reason: input.action === "REJECT"
                        ? input.reason ?? null
                        : undefined,
                }),
            },
        );

        return updatedRequest;
    });
}
