import { NotificationOutboxType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { after, NextResponse } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { processOutbox } from "@/lib/services/outbox/processor";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { isActiveEmployeeInTransaction } from "@/lib/services/leave/active-employee-session";
import {
    buildLeaveRecipientSnapshot,
    type LeaveResultPayload,
} from "@/lib/services/leave/notification-payloads";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";
import { getLeaveYearFromDateValue } from "@/lib/services/leave/quota-year";
import { halfDaysToDays, toLeaveRequestDays } from "@/lib/services/leave/half-days";
import { calculateAdditionalOverQuotaHalfDays } from "@/lib/services/leave/over-quota";
import { calculateEffectiveEntitlementHalfDays } from "@/lib/services/leave/quota-accounting";
import {
    ensureLeaveQuotaForYear,
    reconcileLeaveQuotaForward,
} from "@/lib/services/leave/quota-entitlement";
import { jsonError, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { isAdminRole } from "@/lib/ssot/permissions";
import { leaveActionSchema } from "@/lib/validations/leave";
import { buildLeaveAuditContext } from "@/lib/services/leave/audit-details";
import { createLeaveAuditInTransaction } from "@/lib/services/leave/transaction";

const LEAVE_APPROVAL_MESSAGES = {
    requestNotFound: "ไม่พบคำขอลา",
    alreadyProcessed: "คำขอนี้ถูกดำเนินการไปแล้ว",
    forbidden: "คุณไม่มีสิทธิ์อนุมัติคำขอนี้",
    specialReasonRequired: "สิทธิ์ลาคงเหลือไม่เพียงพอ ต้องมีเหตุผลพิเศษก่อนอนุมัติ",
} as const;

class LeaveApprovalError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "LeaveApprovalError";
        this.statusCode = statusCode;
    }
}

export async function POST(req: Request): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;
        if (isAdminRole(auth.user.role)) {
            return jsonError(COMMON_API_MESSAGES.forbidden, 403);
        }

        const userId = auth.user.id;
        const managerId = auth.employeeId;

        const body = await req.json();
        const parsed = leaveActionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: COMMON_API_MESSAGES.invalidActionParameters,
                    details: parsed.error.flatten().fieldErrors,
                },
                { status: 400 },
            );
        }
        const { leaveId, action, reason } = parsed.data;

        const result = await runSerializableTransaction(async (tx) => {
            if (!await isActiveEmployeeInTransaction(tx, userId, managerId)) {
                throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.forbidden, 403);
            }
            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: leaveId },
                include: {
                    employee: {
                        include: { user: { select: { id: true } } },
                    },
                    approver: true,
                },
            });

            if (!leaveRequest) {
                throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.requestNotFound, 404);
            }
            if (leaveRequest.employeeId === managerId) {
                throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.forbidden, 403);
            }
            if (leaveRequest.approverId !== managerId) {
                throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.forbidden, 403);
            }
            if (leaveRequest.status !== "PENDING") {
                throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.alreadyProcessed, 409);
            }

            const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
            const updateData: Prisma.LeaveRequestUpdateInput = {
                status: newStatus,
                approvedAt: new Date(),
                rejectReason: action === "REJECT" ? reason : null,
            };

            const claimedRequest = await tx.leaveRequest.updateMany({
                where: { id: leaveId, status: "PENDING", approverId: managerId },
                data: updateData,
            });
            if (claimedRequest.count !== 1) {
                throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.alreadyProcessed, 409);
            }

            if (action === "APPROVE") {
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
                    data: {
                        usedHalfDays: { increment: leaveRequest.durationHalfDays },
                    },
                });
                await reconcileLeaveQuotaForward(tx, {
                    ...quota,
                    usedHalfDays:
                        quota.usedHalfDays + leaveRequest.durationHalfDays,
                });

                if (overQuotaHalfDays !== leaveRequest.overQuotaHalfDays) {
                    await tx.leaveRequest.updateMany({
                        where: { id: leaveId, status: "APPROVED" },
                        data: { overQuotaHalfDays },
                    });
                }
            }

            const updatedRequest = await tx.leaveRequest.findUniqueOrThrow({ where: { id: leaveId } });

            await tx.notification.updateMany({
                where: {
                    userId,
                    type: "LEAVE_REQUESTED",
                    referenceId: leaveId,
                    isRead: false,
                },
                data: { isRead: true },
            });

            const payload: LeaveResultPayload = {
                leaveId,
                employee: buildLeaveRecipientSnapshot(leaveRequest.employee),
                approverName: leaveRequest.approver
                    ? getEmployeeDisplayName(leaveRequest.approver)
                    : auth.user.name,
                leaveType: leaveRequest.leaveType,
                startDate: leaveRequest.startDate.toISOString(),
                endDate: leaveRequest.endDate.toISOString(),
                period: leaveRequest.period,
                durationDays: halfDaysToDays(leaveRequest.durationHalfDays),
                status: newStatus,
                reason: action === "REJECT" ? reason ?? null : null,
            };

            await tx.notificationOutbox.create({
                data: {
                    type: NotificationOutboxType.LEAVE_RESULT,
                    payload: JSON.stringify(payload),
                },
            });

            const auditAction = action === "APPROVE"
                ? "LEAVE_REQUEST_APPROVE"
                : "LEAVE_REQUEST_REJECT";
            await createLeaveAuditInTransaction(
                tx,
                auditAction,
                leaveId,
                userId,
                auth.user.email || `User ${userId}`,
                {
                    before: { status: "PENDING" },
                    after: {
                        status: newStatus,
                        ...(action === "REJECT" ? { reason: reason ?? null } : {}),
                    },
                    metadata: buildLeaveAuditContext(leaveRequest, {
                        reason: action === "REJECT" ? reason ?? null : undefined,
                    }),
                },
            );

            return updatedRequest;
        });

        after(() => {
            processOutbox().catch((err) =>
                console.error("Failed to process leave outbox in background:", err),
            );
        });

        return NextResponse.json({ success: true, data: toLeaveRequestDays(result) });
    } catch (error) {
        console.error("Intranet Leave Approval Error:", error);
        if (error instanceof LeaveApprovalError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.failedToProcessLeaveApproval, 500);
    }
}
