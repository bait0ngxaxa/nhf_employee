import { NotificationOutboxType, Prisma } from "@prisma/client";
import { after, NextResponse } from "next/server";

import { logLeaveEvent } from "@/lib/server/audit";
import { prisma } from "@/lib/db/prisma";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    isActiveEmployeeInTransaction,
    requireActiveEmployeeSession,
} from "@/lib/services/leave/active-employee-session";
import {
    buildLeaveRecipientSnapshot,
    formatEmployeeName,
    type LeaveResultPayload,
} from "@/lib/services/leave/notification-payloads";
import { getLeaveYearFromDateValue } from "@/lib/services/leave/quota-year";
import { calculateAdditionalOverQuotaDays } from "@/lib/services/leave/over-quota";
import { jsonError, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { leaveActionSchema } from "@/lib/validations/leave";

const LEAVE_APPROVAL_MESSAGES = {
    requestNotFound: "ไม่พบคำขอลา",
    alreadyProcessed: "คำขอนี้ถูกดำเนินการไปแล้ว",
    forbidden: "คุณไม่มีสิทธิ์อนุมัติคำขอนี้",
    quotaNotFound: "ไม่สามารถตรวจสอบสิทธิ์ลาของคำขอนี้ได้ กรุณาติดต่อผู้ดูแลระบบ",
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

        const auth = await requireActiveEmployeeSession();
        if (!auth.ok) return auth.response;

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

        const result = await prisma.$transaction(async (tx) => {
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
            if (leaveRequest.status !== "PENDING") {
                throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.alreadyProcessed, 409);
            }
            if (leaveRequest.approverId !== managerId) {
                throw new LeaveApprovalError(LEAVE_APPROVAL_MESSAGES.forbidden, 403);
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
                const quota = await tx.leaveQuota.findFirst({
                    where: {
                        employeeId: leaveRequest.employeeId,
                        leaveType: leaveRequest.leaveType,
                        year: getLeaveYearFromDateValue(leaveRequest.startDate),
                    },
                });

                if (!quota) {
                    throw new LeaveApprovalError(
                        LEAVE_APPROVAL_MESSAGES.quotaNotFound,
                        409,
                    );
                }

                const overQuotaDays = calculateAdditionalOverQuotaDays(
                    quota.totalDays,
                    quota.usedDays,
                    leaveRequest.durationDays,
                );
                if (overQuotaDays > 0 && !leaveRequest.specialReason) {
                    throw new LeaveApprovalError(
                        LEAVE_APPROVAL_MESSAGES.specialReasonRequired,
                        409,
                    );
                }

                await tx.leaveQuota.update({
                    where: { id: quota.id },
                    data: { usedDays: { increment: leaveRequest.durationDays } },
                });

                if (overQuotaDays !== leaveRequest.overQuotaDays) {
                    await tx.leaveRequest.updateMany({
                        where: { id: leaveId, status: "APPROVED" },
                        data: { overQuotaDays },
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
                    ? formatEmployeeName(leaveRequest.approver)
                    : auth.user.name,
                leaveType: leaveRequest.leaveType,
                startDate: leaveRequest.startDate.toISOString(),
                endDate: leaveRequest.endDate.toISOString(),
                period: leaveRequest.period,
                durationDays: leaveRequest.durationDays,
                status: newStatus,
                reason: action === "REJECT" ? reason ?? null : null,
            };

            await tx.notificationOutbox.create({
                data: {
                    type: NotificationOutboxType.LEAVE_RESULT,
                    payload: JSON.stringify(payload),
                },
            });

            return updatedRequest;
        }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });

        const auditAction = action === "APPROVE" ? "LEAVE_REQUEST_APPROVE" : "LEAVE_REQUEST_REJECT";
        const userEmail = auth.user.email || `User ${userId}`;

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
        if (error instanceof LeaveApprovalError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.failedToProcessLeaveApproval, 500);
    }
}
