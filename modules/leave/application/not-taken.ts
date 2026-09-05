import type { LeaveRequest } from "@prisma/client";

import { isActiveEmployeeInTransaction } from "./queries/active-employee-session";
import {
    getEffectiveLeaveApprover,
    getEffectiveLeaveApproverId,
    getLeaveDecisionAuthorization,
    normalizeLeaveRecoveryReason,
    persistLeaveExceptionApprover,
    resolveLeaveExceptionApprover,
} from "./approvals/exception-approver";
import { buildLeaveAuditContext } from "./notifications/audit-details";
import {
    buildConfiguredApproverSnapshot,
    buildLeaveRecipientSnapshot,
    type LeaveNotTakenConfirmedPayload,
    type LeaveNotTakenRequestedPayload,
} from "./notifications/notification-payloads";
import { formatLeaveSummary, getLeaveTypeLabel } from "./notifications/notification-format";
import {
    ACTIVE_LEAVE_APPROVER_USER_SELECT,
    isActiveLeaveApprover,
} from "../domain/approver-eligibility";
import { halfDaysToDays } from "../domain/half-days";
import { reconcileLeaveQuotaForward } from "../domain/quota-entitlement";
import { getLeaveYearFromDateValue } from "../domain/quota-year";
import { isAfterLeaveEnd } from "../domain/utils";
import {
    createLeaveAuditInTransaction,
    lockLeaveRequestRow,
} from "../infrastructure/persistence/transaction";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";
import { isAdminRole } from "@/lib/ssot/permissions";
import { APP_DASHBOARD_TABS, toDashboardMenuPath } from "@/lib/ssot/routes";

const NOT_TAKEN_MESSAGES = {
    requestNotFound: "ไม่พบคำขอลาที่แจ้งไม่ได้ใช้วันลาได้",
    confirmNotFound: "ไม่พบคำขอคืนโควต้าที่รอยืนยัน",
    invalidStatus: "แจ้งไม่ได้ใช้วันลาได้เฉพาะคำขอที่อนุมัติแล้ว",
    tooEarly: "แจ้งไม่ได้ใช้วันลาได้หลังวันสิ้นสุดการลาผ่านไปแล้ว",
    alreadyRequested: "คำขอนี้ถูกแจ้งว่าไม่ได้ใช้วันลาแล้ว",
    forbidden: "คุณไม่มีสิทธิ์ดำเนินการกับคำขอนี้",
    adminOverrideReasonRequired: "กรุณาระบุเหตุผลสำหรับการกู้คืนรายการโดยผู้ดูแลระบบ",
    quotaNotFound: "ไม่สามารถตรวจสอบสิทธิ์ลาของคำขอนี้ได้ กรุณาติดต่อผู้ดูแลระบบ",
    approverUnavailable: "ไม่พบผู้ดำเนินการคืนโควต้าที่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
} as const;

export class LeaveNotTakenError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "LeaveNotTakenError";
        this.statusCode = statusCode;
    }
}

export interface LeaveNotTakenActor {
    user: {
        id: number;
        role: string;
        email: string;
        name: string | null;
    };
    employeeId: number;
}

export interface RequestLeaveNotTakenInput {
    actor: LeaveNotTakenActor;
    leaveId: string;
    note: string;
}

export interface ConfirmLeaveNotTakenInput {
    actor: LeaveNotTakenActor;
    leaveId: string;
    reason?: string | null;
    allowAdminOverride: boolean;
}

export interface LeaveNotTakenResult {
    request: LeaveRequest;
}

export async function requestLeaveNotTaken(
    input: RequestLeaveNotTakenInput,
): Promise<LeaveNotTakenResult> {
    const userId = input.actor.user.id;
    const employeeId = input.actor.employeeId;

    return runSerializableTransaction(async (tx) => {
        if (!await isActiveEmployeeInTransaction(tx, userId, employeeId)) {
            throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.forbidden, 403);
        }

        await lockLeaveRequestRow(tx, input.leaveId);
        const leaveRequest = await tx.leaveRequest.findUnique({
            where: { id: input.leaveId },
            include: {
                employee: { include: { user: { select: { id: true } } } },
                approver: {
                    include: { user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT } },
                },
                exceptionApprover: {
                    include: { user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT } },
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
            throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.approverUnavailable, 409);
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
                notTakenReason: input.note,
                notTakenRequestedAt: requestedAt,
            },
        });
        if (claimedRequest.count !== 1) {
            throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.alreadyRequested, 409);
        }

        const updatedRequest = {
            ...leaveRequest,
            notTakenReason: input.note,
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
            note: input.note,
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
                actionUrl: toDashboardMenuPath(APP_DASHBOARD_TABS.leaveHistory),
                referenceId: leaveRequest.id,
            },
        });
        await createLeaveAuditInTransaction(
            tx,
            "LEAVE_REQUEST_NOT_TAKEN_REQUEST",
            leaveRequest.id,
            userId,
            input.actor.user.email,
            {
                before: { status: "APPROVED" },
                after: { status: "APPROVED" },
                metadata: {
                    ...buildLeaveAuditContext(leaveRequest, { reason: input.note }),
                    originalApproverId: leaveRequest.approverId,
                    exceptionApproverId: exceptionApprover.exceptionApproverId,
                    exceptionApproverSource: exceptionApprover.source,
                },
            },
        );

        return { request: updatedRequest };
    });
}

export async function confirmLeaveNotTaken(
    input: ConfirmLeaveNotTakenInput,
): Promise<LeaveNotTakenResult> {
    const userId = input.actor.user.id;
    const managerId = input.actor.employeeId;
    const isAdmin = input.allowAdminOverride && isAdminRole(input.actor.user.role);

    return runSerializableTransaction(async (tx) => {
        if (!await isActiveEmployeeInTransaction(tx, userId, managerId)) {
            throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.forbidden, 403);
        }

        await lockLeaveRequestRow(tx, input.leaveId);
        let leaveRequest = await tx.leaveRequest.findUnique({
            where: { id: input.leaveId },
            include: {
                employee: { include: { user: { select: { id: true } } } },
                approver: {
                    include: { user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT } },
                },
                exceptionApprover: {
                    include: { user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT } },
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

        const decisionAuthorization = getLeaveDecisionAuthorization(
            managerId,
            isAdmin,
            leaveRequest,
        );
        if (decisionAuthorization === "OWNER") {
            throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.forbidden, 403);
        }
        if (isAdmin && decisionAuthorization === "FORBIDDEN") {
            throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.forbidden, 403);
        }

        const adminOverride = decisionAuthorization === "ADMIN_OVERRIDE";
        if (!isAdmin) {
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
                        employee: { include: { user: { select: { id: true } } } },
                        approver: {
                            include: { user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT } },
                        },
                        exceptionApprover: {
                            include: { user: { select: ACTIVE_LEAVE_APPROVER_USER_SELECT } },
                        },
                    },
                });
                if (!refreshedRequest) {
                    throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.confirmNotFound, 404);
                }
                leaveRequest = refreshedRequest;
            }

            const currentApprover = getEffectiveLeaveApprover(leaveRequest);
            if (
                getEffectiveLeaveApproverId(leaveRequest) !== managerId
                || !isActiveLeaveApprover(currentApprover)
            ) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.forbidden, 403);
            }
        }

        const adminOverrideReason = adminOverride
            ? requireAdminOverrideReason(input.reason)
            : null;
        const claimedRequest = await tx.leaveRequest.updateMany({
            where: {
                id: leaveRequest.id,
                status: "APPROVED",
                employeeId: { not: managerId },
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
            data: { usedHalfDays: { decrement: leaveRequest.durationHalfDays } },
        });
        if (updatedQuota.usedHalfDays < 0) {
            throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.quotaNotFound, 409);
        }
        await reconcileLeaveQuotaForward(tx, {
            ...quota,
            usedHalfDays: updatedQuota.usedHalfDays,
        });
        const updatedRequest = await tx.leaveRequest.findUniqueOrThrow({
            where: { id: leaveRequest.id },
        });

        const currentApprover = getEffectiveLeaveApprover(leaveRequest);
        const effectiveApproverUserId = currentApprover?.user?.id;
        if (effectiveApproverUserId) {
            await tx.notification.updateMany({
                where: {
                    userId: effectiveApproverUserId,
                    type: "LEAVE_NOT_TAKEN_REQUESTED",
                    referenceId: leaveRequest.id,
                    isRead: false,
                },
                data: { isRead: true },
            });
        }

        const payload: LeaveNotTakenConfirmedPayload = {
            leaveId: leaveRequest.id,
            employee: buildLeaveRecipientSnapshot(leaveRequest.employee),
            decisionActorName: isAdmin
                ? input.actor.user.name
                : currentApprover
                    ? getEmployeeDisplayName(currentApprover)
                    : null,
            decisionActorRole: input.actor.user.role,
            recoveryOverride: adminOverride,
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
        await createLeaveAuditInTransaction(
            tx,
            "LEAVE_REQUEST_NOT_TAKEN_CONFIRM",
            leaveRequest.id,
            userId,
            input.actor.user.email,
            {
                before: { status: "APPROVED" },
                after: { status: "NOT_TAKEN" },
                metadata: {
                    ...buildLeaveAuditContext(leaveRequest),
                    adminOverride,
                    decision: "CONFIRM_NOT_TAKEN",
                    originalApproverId: leaveRequest.approverId,
                    exceptionApproverId: leaveRequest.exceptionApproverId,
                    ...(adminOverrideReason ? { overrideReason: adminOverrideReason } : {}),
                },
            },
        );

        return { request: updatedRequest };
    });
}

function requireAdminOverrideReason(reason: string | null | undefined): string {
    const normalizedReason = normalizeLeaveRecoveryReason(reason);
    if (!normalizedReason) {
        throw new LeaveNotTakenError(
            NOT_TAKEN_MESSAGES.adminOverrideReasonRequired,
            400,
        );
    }
    return normalizedReason;
}
