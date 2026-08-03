import { after, NextResponse, type NextRequest } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { logLeaveEvent } from "@/lib/server/audit";
import {
    isActiveEmployeeInTransaction,
} from "@/lib/services/leave/active-employee-session";
import {
    ACTIVE_LEAVE_APPROVER_USER_SELECT,
    isActiveLeaveApprover,
} from "@/lib/services/leave/approver-eligibility";
import {
    persistLeaveExceptionApprover,
    resolveLeaveExceptionApprover,
} from "@/lib/services/leave/exception-approver";
import {
    buildConfiguredApproverSnapshot,
    buildLeaveRecipientSnapshot,
    formatEmployeeName,
    type LeaveNotTakenConfirmedPayload,
    type LeaveNotTakenRequestedPayload,
} from "@/lib/services/leave/notification-payloads";
import {
    formatLeaveSummary,
    getLeaveTypeLabel,
} from "@/lib/services/leave/notification-format";
import { getLeaveYearFromDateValue } from "@/lib/services/leave/quota-year";
import { isAfterLeaveEnd } from "@/lib/services/leave/utils";
import { processOutbox } from "@/lib/services/outbox/processor";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { jsonError, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { isAdminRole } from "@/lib/ssot/permissions";
import { APP_DASHBOARD_TABS, toDashboardTabPath } from "@/lib/ssot/routes";
import {
    leaveNotTakenConfirmSchema,
    leaveNotTakenRequestSchema,
} from "@/lib/validations/leave";
import { halfDaysToDays, toLeaveRequestDays } from "@/lib/services/leave/half-days";
import {
    createLeaveAuditInTransaction,
    lockLeaveRequestRow,
} from "@/lib/services/leave/transaction";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";

const NOT_TAKEN_MESSAGES = {
    requestNotFound: "ไม่พบคำขอลาที่แจ้งไม่ได้ใช้วันลาได้",
    confirmNotFound: "ไม่พบคำขอคืนโควต้าที่รอยืนยัน",
    invalidStatus: "แจ้งไม่ได้ใช้วันลาได้เฉพาะคำขอที่อนุมัติแล้ว",
    tooEarly: "แจ้งไม่ได้ใช้วันลาได้หลังวันสิ้นสุดการลาผ่านไปแล้ว",
    alreadyRequested: "คำขอนี้ถูกแจ้งว่าไม่ได้ใช้วันลาแล้ว",
    forbidden: "คุณไม่มีสิทธิ์ดำเนินการกับคำขอนี้",
    quotaNotFound: "ไม่สามารถตรวจสอบสิทธิ์ลาของคำขอนี้ได้ กรุณาติดต่อผู้ดูแลระบบ",
    approverUnavailable: "ไม่พบผู้ดำเนินการคืนโควต้าที่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
} as const;

class LeaveNotTakenError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "LeaveNotTakenError";
        this.statusCode = statusCode;
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(req, "leave-not-taken");
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;

        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;

        const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "leave-not-taken",
            auth.user.id,
        );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const userId = auth.user.id;
        const employeeId = auth.employeeId;

        const body = await req.json();
        const parsed = leaveNotTakenRequestSchema.safeParse(body);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const result = await runSerializableTransaction(async (tx) => {
            if (!await isActiveEmployeeInTransaction(tx, userId, employeeId)) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.forbidden, 403);
            }

            await lockLeaveRequestRow(tx, parsed.data.leaveId);

            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: parsed.data.leaveId },
                include: {
                    employee: {
                        include: { user: { select: { id: true } } },
                    },
                    approver: {
                        include: {
                            user: {
                                select: ACTIVE_LEAVE_APPROVER_USER_SELECT,
                            },
                        },
                    },
                    exceptionApprover: {
                        include: {
                            user: {
                                select: ACTIVE_LEAVE_APPROVER_USER_SELECT,
                            },
                        },
                    },
                },
            });

            if (!leaveRequest || leaveRequest.employeeId !== employeeId) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.requestNotFound, 404);
            }
            if (leaveRequest.status !== "APPROVED") {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.invalidStatus, 409);
            }
            if (!isAfterLeaveEnd(leaveRequest.endDate)) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.tooEarly, 400);
            }
            if (leaveRequest.notTakenRequestedAt) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.alreadyRequested, 409);
            }
            const exceptionApprover = await resolveLeaveExceptionApprover(tx, {
                employeeId: leaveRequest.employeeId,
                originalApprover: leaveRequest.approver,
                existingApprover: leaveRequest.exceptionApprover,
                reuseExisting: false,
            });
            if (!exceptionApprover) {
                throw new LeaveNotTakenError(
                    NOT_TAKEN_MESSAGES.approverUnavailable,
                    409,
                );
            }
            await persistLeaveExceptionApprover(tx, leaveRequest.id, exceptionApprover);
            const requestedAt = new Date();
            const claimedRequest = await tx.leaveRequest.updateMany({
                where: {
                    id: leaveRequest.id,
                    employeeId,
                    status: "APPROVED",
                    notTakenRequestedAt: null,
                },
                data: {
                    notTakenReason: parsed.data.note,
                    notTakenRequestedAt: requestedAt,
                },
            });
            if (claimedRequest.count !== 1) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.alreadyRequested, 409);
            }

            const updatedRequest = {
                ...leaveRequest,
                notTakenReason: parsed.data.note,
                notTakenRequestedAt: requestedAt,
                exceptionApproverId: exceptionApprover.exceptionApproverId,
                exceptionApproverAssignedAt: exceptionApprover.assignedAt,
            };
            const leaveSummary = {
                startDate: leaveRequest.startDate.toISOString(),
                endDate: leaveRequest.endDate.toISOString(),
                period: leaveRequest.period,
                durationDays: halfDaysToDays(leaveRequest.durationHalfDays),
            };

            const payload: LeaveNotTakenRequestedPayload = {
                leaveId: leaveRequest.id,
                employee: buildLeaveRecipientSnapshot(leaveRequest.employee),
                approver: buildConfiguredApproverSnapshot(exceptionApprover.approver),
                leaveType: leaveRequest.leaveType,
                ...leaveSummary,
                note: parsed.data.note,
            };

            await tx.notificationOutbox.create({
                data: {
                    type: "LEAVE_NOT_TAKEN_REQUESTED",
                    eventKey: `leave:${leaveRequest.id}:not-taken-requested`,
                    payload: JSON.stringify(payload),
                },
            });

            await tx.notification.create({
                data: {
                    userId,
                    type: "LEAVE_NOT_TAKEN_REQUESTED",
                    title: "แจ้งไม่ได้ใช้วันลาแล้ว",
                    message: `แจ้งไม่ได้ใช้วันลาแล้ว: ${getLeaveTypeLabel(leaveRequest.leaveType)} ${formatLeaveSummary(leaveSummary)}`,
                    actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.leaveHistory),
                    referenceId: leaveRequest.id,
                },
            });

            return {
                request: updatedRequest,
                exceptionApproverSource: exceptionApprover.source,
            };
        });

        await logLeaveEvent(
            "LEAVE_REQUEST_NOT_TAKEN_REQUEST",
            result.request.id,
            userId,
            auth.user.email,
            {
                metadata: {
                    note: parsed.data.note,
                    originalApproverId: result.request.approverId,
                    exceptionApproverId: result.request.exceptionApproverId,
                    exceptionApproverSource: result.exceptionApproverSource,
                },
            },
        ).catch((err) => console.error("Failed to log leave not-taken request:", err));

        after(() => {
            processOutbox().catch((err) =>
                console.error("Failed to process leave not-taken outbox:", err),
            );
        });

        return NextResponse.json({
            success: true,
            data: toLeaveRequestDays(result.request),
        });
    } catch (error) {
        console.error("Leave not-taken request error:", error);
        if (error instanceof LeaveNotTakenError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.operationFailed, 500);
    }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(req, "leave-not-taken");
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;

        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;

        const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "leave-not-taken",
            auth.user.id,
        );
        if (principalRateLimitResponse) return principalRateLimitResponse;
        const userId = auth.user.id;
        const managerId = auth.employeeId;
        const adminOverride = isAdminRole(auth.user.role);

        const body = await req.json();
        const parsed = leaveNotTakenConfirmSchema.safeParse(body);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const result = await runSerializableTransaction(async (tx) => {
            if (!await isActiveEmployeeInTransaction(tx, userId, managerId)) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.forbidden, 403);
            }

            await lockLeaveRequestRow(tx, parsed.data.leaveId);
            let leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: parsed.data.leaveId },
                include: {
                    employee: {
                        include: { user: { select: { id: true } } },
                    },
                    approver: {
                        include: {
                            user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT },
                        },
                    },
                    exceptionApprover: {
                        include: {
                            user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT },
                        },
                    },
                },
            });

            if (
                !leaveRequest
                || leaveRequest.status !== "APPROVED"
                || !leaveRequest.notTakenRequestedAt
                || leaveRequest.notTakenConfirmedAt
            ) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.confirmNotFound, 404);
            }
            if (!adminOverride && leaveRequest.employeeId === managerId) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.forbidden, 403);
            }
            if (!adminOverride) {
                const exceptionApprover = await resolveLeaveExceptionApprover(tx, {
                    employeeId: leaveRequest.employeeId,
                    originalApprover: leaveRequest.approver,
                    existingApprover: leaveRequest.exceptionApprover,
                    reuseExisting: true,
                });
                if (!exceptionApprover) {
                    throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.forbidden, 403);
                }
                if (exceptionApprover.shouldPersist) {
                    await persistLeaveExceptionApprover(tx, leaveRequest.id, exceptionApprover);
                    const refreshedRequest = await tx.leaveRequest.findUnique({
                        where: { id: leaveRequest.id },
                        include: {
                            employee: {
                                include: { user: { select: { id: true } } },
                            },
                            approver: {
                                include: {
                                    user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT },
                                },
                            },
                            exceptionApprover: {
                                include: {
                                    user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT },
                                },
                            },
                        },
                    });
                    if (!refreshedRequest) {
                        throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.confirmNotFound, 404);
                    }
                    leaveRequest = refreshedRequest;
                }
                const currentApprover = leaveRequest.exceptionApprover ?? leaveRequest.approver;
                if (
                    (leaveRequest.exceptionApproverId ?? leaveRequest.approverId) !== managerId
                    || !isActiveLeaveApprover(currentApprover)
                ) {
                    throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.forbidden, 403);
                }
            }

            const claimedRequest = await tx.leaveRequest.updateMany({
                where: {
                    id: leaveRequest.id,
                    status: "APPROVED",
                    ...(adminOverride
                        ? {}
                        : leaveRequest.exceptionApproverId !== null
                            ? { exceptionApproverId: managerId }
                            : { approverId: managerId }),
                    notTakenRequestedAt: { not: null },
                    notTakenConfirmedAt: null,
                },
                data: {
                    status: "NOT_TAKEN",
                    notTakenConfirmedAt: new Date(),
                    notTakenConfirmedById: managerId,
                },
            });
            if (claimedRequest.count !== 1) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.confirmNotFound, 409);
            }

            const quota = await tx.leaveQuota.findFirst({
                where: {
                    employeeId: leaveRequest.employeeId,
                    leaveType: leaveRequest.leaveType,
                    year: getLeaveYearFromDateValue(leaveRequest.startDate),
                },
            });

            if (!quota) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.quotaNotFound, 409);
            }

            const updatedQuota = await tx.leaveQuota.update({
                where: { id: quota.id },
                data: {
                    usedHalfDays: { decrement: leaveRequest.durationHalfDays },
                },
            });
            if (updatedQuota.usedHalfDays < 0) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.quotaNotFound, 409);
            }
            const updatedRequest = await tx.leaveRequest.findUniqueOrThrow({
                where: { id: leaveRequest.id },
            });

            await tx.notification.updateMany({
                where: {
                    userId,
                    type: "LEAVE_NOT_TAKEN_REQUESTED",
                    referenceId: leaveRequest.id,
                    isRead: false,
                },
                data: { isRead: true },
            });

            const currentApprover = leaveRequest.exceptionApprover ?? leaveRequest.approver;
            const payload: LeaveNotTakenConfirmedPayload = {
                leaveId: leaveRequest.id,
                employee: buildLeaveRecipientSnapshot(leaveRequest.employee),
                approverName: currentApprover
                    ? formatEmployeeName(currentApprover)
                    : auth.user.name,
                leaveType: leaveRequest.leaveType,
                startDate: leaveRequest.startDate.toISOString(),
                endDate: leaveRequest.endDate.toISOString(),
                period: leaveRequest.period,
                durationDays: halfDaysToDays(leaveRequest.durationHalfDays),
            };

            await tx.notificationOutbox.create({
                data: {
                    type: "LEAVE_NOT_TAKEN_CONFIRMED",
                    eventKey: `leave:${leaveRequest.id}:not-taken-confirmed`,
                    payload: JSON.stringify(payload),
                },
            });

            if (adminOverride) {
                await createLeaveAuditInTransaction(
                    tx,
                    "LEAVE_REQUEST_NOT_TAKEN_CONFIRM",
                    leaveRequest.id,
                    userId,
                    auth.user.email,
                    {
                        after: { status: "NOT_TAKEN" },
                        metadata: {
                            adminOverride: true,
                            decision: "CONFIRM_NOT_TAKEN",
                            originalApproverId: leaveRequest.approverId,
                            exceptionApproverId: leaveRequest.exceptionApproverId,
                        },
                    },
                );
            }

            return updatedRequest;
        });

        if (!adminOverride) {
            await logLeaveEvent(
                "LEAVE_REQUEST_NOT_TAKEN_CONFIRM",
                result.id,
                userId,
                auth.user.email,
                { after: { status: "NOT_TAKEN" } },
            ).catch((err) => console.error("Failed to log leave not-taken confirm:", err));
        }

        after(() => {
            processOutbox().catch((err) =>
                console.error("Failed to process leave not-taken confirm outbox:", err),
            );
        });

        return NextResponse.json({ success: true, data: toLeaveRequestDays(result) });
    } catch (error) {
        console.error("Leave not-taken confirm error:", error);
        if (error instanceof LeaveNotTakenError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.operationFailed, 500);
    }
}
