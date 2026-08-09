import type { Prisma } from "@prisma/client";

import { runSerializableTransaction } from "@/lib/db/transaction";
import { isActiveEmployeeInTransaction } from "@/lib/services/leave/active-employee-session";
import {
    ACTIVE_LEAVE_APPROVER_USER_SELECT,
    isActiveLeaveApprover,
} from "@/lib/services/leave/approver-eligibility";
import {
    buildConfiguredApproverSnapshot,
    buildLeaveRecipientSnapshot,
    formatEmployeeName,
    type LeaveCancelledPayload,
    type LeaveCancelledAfterApprovalPayload,
    type LeaveCancellationRequestedPayload,
} from "@/lib/services/leave/notification-payloads";
import {
    getEffectiveLeaveApprover,
    getEffectiveLeaveApproverId,
    getLeaveDecisionAuthorization,
    normalizeLeaveRecoveryReason,
    persistLeaveExceptionApprover,
    resolveLeaveExceptionApprover,
    type LeaveExceptionApproverSource,
} from "@/lib/services/leave/exception-approver";
import { isAdminRole } from "@/lib/ssot/permissions";
import { getLeaveYearFromDateValue } from "@/lib/services/leave/quota-year";
import {
    createLeaveAuditInTransaction,
    lockLeaveRequestRow,
} from "@/lib/services/leave/transaction";
import { isBeforeLeaveStart } from "@/lib/services/leave/utils";
import { halfDaysToDays } from "@/lib/services/leave/half-days";
import { buildLeaveAuditContext } from "@/lib/services/leave/audit-details";
import {
    formatLeaveSummary,
    getLeaveTypeLabel,
} from "@/lib/services/leave/notification-format";
import {
    APP_DASHBOARD_TABS,
    toDashboardTabPath,
} from "@/lib/ssot/routes";

export const LEAVE_CANCELLATION_MESSAGES = {
    notFound: "ไม่พบคำขอลาที่ยกเลิกได้",
    invalidStatus: "คำขอนี้ไม่สามารถขอยกเลิกได้แล้ว",
    tooLate: "ขอยกเลิกวันลาได้ก่อนวันลาเริ่มเท่านั้น",
    alreadyRequested: "คำขอนี้อยู่ระหว่างรอการยืนยันยกเลิก",
    alreadyConsidered: "คำขอยกเลิกวันลานี้ได้รับการพิจารณาแล้ว ไม่สามารถส่งคำขอยกเลิกซ้ำได้",
    confirmationTooLate: "ไม่สามารถยืนยันการยกเลิกได้ เนื่องจากวันลาเริ่มแล้ว",
    forbidden: "คุณไม่มีสิทธิ์ดำเนินการกับคำขอนี้",
    adminOverrideReasonRequired: "กรุณาระบุเหตุผลสำหรับการกู้คืนรายการโดยผู้ดูแลระบบ",
    quotaNotFound: "ไม่สามารถตรวจสอบสิทธิ์ลาของคำขอนี้ได้ กรุณาติดต่อผู้ดูแลระบบ",
    approverUnavailable: "ไม่พบผู้ดำเนินการคำขอยกเลิกที่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
} as const;

export class LeaveCancellationError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "LeaveCancellationError";
        this.statusCode = statusCode;
    }
}

const CANCELLATION_REQUEST_INCLUDE = {
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
} as const satisfies Prisma.LeaveRequestInclude;

type LeaveCancellationRequest = Prisma.LeaveRequestGetPayload<{
    include: typeof CANCELLATION_REQUEST_INCLUDE;
}>;
type LeaveCancellationScalars = Omit<
    LeaveCancellationRequest,
    "employee" | "approver" | "exceptionApprover"
>;

export type LeaveCancellationResult = {
    request: LeaveCancellationRequest;
    exceptionApproverSource?: LeaveExceptionApproverSource;
    kind:
        | "PENDING_CANCELLED"
        | "CANCELLATION_REQUESTED"
        | "CANCELLED_AFTER_APPROVAL"
        | "CANCELLATION_REJECTED";
};

type EmployeeActor = {
    userId: number;
    employeeId: number;
    userEmail?: string;
};

export async function cancelLeaveRequest(
    actor: EmployeeActor,
    leaveId: string,
    reason?: string,
): Promise<LeaveCancellationResult> {
    return runSerializableTransaction(async (tx) => {
        if (!await isActiveEmployeeInTransaction(tx, actor.userId, actor.employeeId)) {
            throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.forbidden, 403);
        }

        await lockLeaveRequestRow(tx, leaveId);
        const leaveRequest = await tx.leaveRequest.findUnique({
            where: { id: leaveId },
            include: CANCELLATION_REQUEST_INCLUDE,
        });

        if (!leaveRequest || leaveRequest.employeeId !== actor.employeeId) {
            throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.notFound, 404);
        }

        if (leaveRequest.status === "PENDING") {
            const claimedRequest = await tx.leaveRequest.updateMany({
                where: { id: leaveId, status: "PENDING" },
                data: { status: "CANCELLED" },
            });
            if (claimedRequest.count !== 1) {
                throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.invalidStatus, 409);
            }

            await markPendingApprovalNotificationsRead(tx, leaveRequest);
            await createSelfCancelledNotification(tx, actor.userId, leaveRequest);
            if (isActiveLeaveApprover(leaveRequest.approver)) {
                const payload: LeaveCancelledPayload = {
                    leaveId,
                    employee: buildLeaveRecipientSnapshot(leaveRequest.employee),
                    approver: buildConfiguredApproverSnapshot(leaveRequest.approver),
                    leaveType: leaveRequest.leaveType,
                    startDate: leaveRequest.startDate.toISOString(),
                    endDate: leaveRequest.endDate.toISOString(),
                    period: leaveRequest.period,
                    durationDays: halfDaysToDays(leaveRequest.durationHalfDays),
                };
                await tx.notificationOutbox.create({
                    data: {
                        type: "LEAVE_CANCELLED",
                        payload: JSON.stringify(payload),
                    },
                });
            }
            await createLeaveAuditInTransaction(
                tx,
                "LEAVE_REQUEST_CANCEL",
                leaveId,
                actor.userId,
                actor.userEmail ?? "",
                {
                    before: { status: "PENDING" },
                    after: { status: "CANCELLED" },
                    metadata: buildLeaveAuditContext(leaveRequest, {
                        reason: reason ?? null,
                    }),
                },
            );
            const updatedRequest = await tx.leaveRequest.findUniqueOrThrow({ where: { id: leaveId } });
            return {
                request: withCancellationInclude(updatedRequest, leaveRequest),
                kind: "PENDING_CANCELLED",
            };
        }

        if (leaveRequest.status === "CANCELLATION_REQUESTED") {
            throw new LeaveCancellationError(
                LEAVE_CANCELLATION_MESSAGES.alreadyRequested,
                409,
            );
        }
        if (leaveRequest.status !== "APPROVED") {
            throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.invalidStatus, 409);
        }
        if (leaveRequest.cancellationRequestedAt !== null) {
            throw new LeaveCancellationError(
                LEAVE_CANCELLATION_MESSAGES.alreadyConsidered,
                409,
            );
        }
        if (!isBeforeLeaveStart(leaveRequest.startDate)) {
            throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.tooLate, 400);
        }

        const exceptionApprover = await resolveLeaveExceptionApprover(tx, {
            employeeId: leaveRequest.employeeId,
            originalApprover: leaveRequest.approver,
            existingApprover: leaveRequest.exceptionApprover,
            reuseExisting: false,
        });
        if (!exceptionApprover) {
            throw new LeaveCancellationError(
                LEAVE_CANCELLATION_MESSAGES.approverUnavailable,
                409,
            );
        }
        await persistLeaveExceptionApprover(tx, leaveId, exceptionApprover);

        const requestedAt = new Date();
        const claimedRequest = await tx.leaveRequest.updateMany({
            where: {
                id: leaveId,
                employeeId: actor.employeeId,
                status: "APPROVED",
                cancellationRequestedAt: null,
            },
            data: {
                status: "CANCELLATION_REQUESTED",
                cancellationReason: reason ?? null,
                cancellationRequestedAt: requestedAt,
            },
        });
        if (claimedRequest.count !== 1) {
            throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.alreadyRequested, 409);
        }

        await markApprovedNotificationsRead(tx, actor.userId, leaveRequest);
        await createCancellationRequestedNotification(tx, actor.userId, leaveRequest);

        const payload: LeaveCancellationRequestedPayload = {
            leaveId,
            employee: buildLeaveRecipientSnapshot(leaveRequest.employee),
            approver: buildConfiguredApproverSnapshot(exceptionApprover.approver),
            leaveType: leaveRequest.leaveType,
            startDate: leaveRequest.startDate.toISOString(),
            endDate: leaveRequest.endDate.toISOString(),
            period: leaveRequest.period,
            durationDays: halfDaysToDays(leaveRequest.durationHalfDays),
            note: reason ?? "พนักงานขอยกเลิกวันลาที่อนุมัติแล้ว",
        };
        await tx.notificationOutbox.create({
            data: {
                type: "LEAVE_CANCELLATION_REQUESTED",
                eventKey: `leave:${leaveId}:cancellation-requested`,
                payload: JSON.stringify(payload),
            },
        });

        await createLeaveAuditInTransaction(
            tx,
            "LEAVE_REQUEST_CANCELLATION_REQUEST",
            leaveId,
            actor.userId,
            actor.userEmail ?? "",
            {
                before: { status: "APPROVED" },
                after: { status: "CANCELLATION_REQUESTED" },
                metadata: {
                    ...buildLeaveAuditContext(leaveRequest, {
                        reason: reason ?? null,
                    }),
                    originalApproverId: leaveRequest.approverId,
                    exceptionApproverId: exceptionApprover.exceptionApproverId,
                    exceptionApproverSource: exceptionApprover.source,
                },
            },
        );

        const updatedRequest = await tx.leaveRequest.findUniqueOrThrow({ where: { id: leaveId } });
        return {
            request: withCancellationInclude(updatedRequest, leaveRequest, {
                cancellationReason: reason ?? null,
                cancellationRequestedAt: requestedAt,
            }),
            exceptionApproverSource: exceptionApprover.source,
            kind: "CANCELLATION_REQUESTED",
        };
    });
}

type CancellationDecisionActor = {
    userId: number;
    employeeId: number;
    role: string;
    name?: string | null;
    userEmail?: string;
};

export async function confirmLeaveCancellation(
    actor: CancellationDecisionActor,
    leaveId: string,
    reason?: string | null,
): Promise<LeaveCancellationResult> {
    return runSerializableTransaction(async (tx) => {
        const authorization = await getCancellationDecisionRequest(tx, actor, leaveId);
        const leaveRequest = authorization.leaveRequest;
        const adminOverrideReason = authorization.adminOverride
            ? requireAdminOverrideReason(reason)
            : null;
        if (!isBeforeLeaveStart(leaveRequest.startDate)) {
            throw new LeaveCancellationError(
                LEAVE_CANCELLATION_MESSAGES.confirmationTooLate,
                409,
            );
        }

        const confirmedAt = new Date();
        const claimedRequest = await tx.leaveRequest.updateMany({
            where: {
                id: leaveId,
                status: "CANCELLATION_REQUESTED",
                ...getCancellationApproverWhere(actor, leaveRequest, authorization.adminOverride),
                cancellationRequestedAt: { not: null },
                cancellationConfirmedAt: null,
            },
            data: {
                status: "CANCELLED_AFTER_APPROVAL",
                cancellationConfirmedAt: confirmedAt,
                cancellationConfirmedById: actor.userId,
            },
        });
        if (claimedRequest.count !== 1) {
            throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.invalidStatus, 409);
        }

        const quota = await tx.leaveQuota.findFirst({
            where: {
                employeeId: leaveRequest.employeeId,
                leaveType: leaveRequest.leaveType,
                year: getLeaveYearFromDateValue(leaveRequest.startDate),
            },
        });
        if (!quota) {
            throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.quotaNotFound, 409);
        }

        const updatedQuota = await tx.leaveQuota.update({
            where: { id: quota.id },
            data: { usedHalfDays: { decrement: leaveRequest.durationHalfDays } },
        });
        if (updatedQuota.usedHalfDays < 0) {
            throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.quotaNotFound, 409);
        }

        const exceptionApproverUserId = getExceptionApproverUserId(leaveRequest);
        if (exceptionApproverUserId) {
            await tx.notification.updateMany({
                where: {
                    userId: exceptionApproverUserId,
                    type: "LEAVE_CANCELLATION_REQUESTED",
                    referenceId: leaveId,
                    isRead: false,
                },
                data: { isRead: true },
            });
        }

        const payload: LeaveCancelledAfterApprovalPayload = {
            leaveId,
            employee: buildLeaveRecipientSnapshot(leaveRequest.employee),
            decisionActorName: isAdminRole(actor.role)
                ? actor.name ?? null
                : getExceptionApproverName(leaveRequest),
            decisionActorRole: actor.role,
            recoveryOverride: authorization.adminOverride,
            leaveType: leaveRequest.leaveType,
            startDate: leaveRequest.startDate.toISOString(),
            endDate: leaveRequest.endDate.toISOString(),
            period: leaveRequest.period,
            durationDays: halfDaysToDays(leaveRequest.durationHalfDays),
        };
        await tx.notificationOutbox.create({
            data: {
                type: "LEAVE_CANCELLED_AFTER_APPROVAL",
                eventKey: `leave:${leaveId}:cancelled-after-approval`,
                payload: JSON.stringify(payload),
            },
        });

        await createLeaveAuditInTransaction(
            tx,
            "LEAVE_REQUEST_CANCELLATION_CONFIRM",
            leaveId,
            actor.userId,
            actor.userEmail ?? "",
            {
                before: { status: "CANCELLATION_REQUESTED" },
                after: { status: "CANCELLED_AFTER_APPROVAL" },
                metadata: {
                    ...buildLeaveAuditContext(leaveRequest, {
                        reason: adminOverrideReason,
                    }),
                    adminOverride: authorization.adminOverride,
                    decision: "CONFIRM",
                    originalApproverId: leaveRequest.approverId,
                    exceptionApproverId: leaveRequest.exceptionApproverId,
                    ...(adminOverrideReason ? { overrideReason: adminOverrideReason } : {}),
                },
            },
        );

        const updatedRequest = await tx.leaveRequest.findUniqueOrThrow({ where: { id: leaveId } });
        return {
            request: withCancellationInclude(updatedRequest, leaveRequest, {
                cancellationConfirmedAt: confirmedAt,
                cancellationConfirmedById: actor.userId,
            }),
            kind: "CANCELLED_AFTER_APPROVAL",
        };
    });
}

export async function rejectLeaveCancellation(
    actor: CancellationDecisionActor,
    leaveId: string,
    reason?: string | null,
): Promise<LeaveCancellationResult> {
    return runSerializableTransaction(async (tx) => {
        const authorization = await getCancellationDecisionRequest(tx, actor, leaveId);
        const leaveRequest = authorization.leaveRequest;
        const adminOverrideReason = authorization.adminOverride
            ? requireAdminOverrideReason(reason)
            : null;

        const claimedRequest = await tx.leaveRequest.updateMany({
            where: {
                id: leaveId,
                status: "CANCELLATION_REQUESTED",
                ...getCancellationApproverWhere(actor, leaveRequest, authorization.adminOverride),
                cancellationRequestedAt: { not: null },
                cancellationConfirmedAt: null,
            },
            data: {
                status: "APPROVED",
            },
        });
        if (claimedRequest.count !== 1) {
            throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.invalidStatus, 409);
        }

        await markCancellationNotificationsRead(tx, leaveRequest);
        await createCancellationRejectedNotification(tx, leaveRequest);

        await createLeaveAuditInTransaction(
            tx,
            "LEAVE_REQUEST_CANCELLATION_CONFIRM",
            leaveId,
            actor.userId,
            actor.userEmail ?? "",
            {
                before: { status: "CANCELLATION_REQUESTED" },
                after: { status: "APPROVED" },
                metadata: {
                    ...buildLeaveAuditContext(leaveRequest, {
                        reason: reason ?? null,
                    }),
                    adminOverride: authorization.adminOverride,
                    decision: "REJECT",
                    originalApproverId: leaveRequest.approverId,
                    exceptionApproverId: leaveRequest.exceptionApproverId,
                    ...(adminOverrideReason ? { overrideReason: adminOverrideReason } : {}),
                },
            },
        );

        const updatedRequest = await tx.leaveRequest.findUniqueOrThrow({ where: { id: leaveId } });
        return {
            request: withCancellationInclude(updatedRequest, leaveRequest),
            kind: "CANCELLATION_REJECTED",
        };
    });
}

async function getCancellationDecisionRequest(
    tx: Prisma.TransactionClient,
    actor: CancellationDecisionActor,
    leaveId: string,
): Promise<{
    leaveRequest: LeaveCancellationRequest;
    adminOverride: boolean;
}> {
    if (!await isActiveEmployeeInTransaction(tx, actor.userId, actor.employeeId)) {
        throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.forbidden, 403);
    }

    await lockLeaveRequestRow(tx, leaveId);
    let leaveRequest = await tx.leaveRequest.findUnique({
        where: { id: leaveId },
        include: CANCELLATION_REQUEST_INCLUDE,
    });

    if (
        !leaveRequest
        || leaveRequest.status !== "CANCELLATION_REQUESTED"
        || !leaveRequest.cancellationRequestedAt
        || leaveRequest.cancellationConfirmedAt
    ) {
        throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.invalidStatus, 409);
    }
    const decisionAuthorization = getLeaveDecisionAuthorization(
        actor.employeeId,
        isAdminRole(actor.role),
        leaveRequest,
    );
    if (decisionAuthorization === "OWNER") {
        throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.forbidden, 403);
    }
    if (isAdminRole(actor.role)) {
        if (decisionAuthorization === "ASSIGNED_APPROVER") {
            return { leaveRequest, adminOverride: false };
        }
        if (decisionAuthorization === "ADMIN_OVERRIDE") {
            return { leaveRequest, adminOverride: true };
        }
        throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.forbidden, 403);
    }

    const exceptionApprover = await resolveLeaveExceptionApprover(tx, {
        employeeId: leaveRequest.employeeId,
        originalApprover: leaveRequest.approver,
        existingApprover: leaveRequest.exceptionApprover,
        reuseExisting: true,
    });
    if (!exceptionApprover) {
        throw new LeaveCancellationError(
            LEAVE_CANCELLATION_MESSAGES.forbidden,
            403,
        );
    }
    if (exceptionApprover.shouldPersist) {
        await persistLeaveExceptionApprover(tx, leaveId, exceptionApprover);
        const refreshedRequest = await tx.leaveRequest.findUnique({
            where: { id: leaveId },
            include: CANCELLATION_REQUEST_INCLUDE,
        });
        if (!refreshedRequest) {
            throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.invalidStatus, 409);
        }
        leaveRequest = refreshedRequest;
    }

    const currentApprover = getEffectiveLeaveApprover(leaveRequest);
    if (getEffectiveLeaveApproverId(leaveRequest) !== actor.employeeId) {
        throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.forbidden, 403);
    }
    if (!isActiveLeaveApprover(currentApprover)) {
        throw new LeaveCancellationError(LEAVE_CANCELLATION_MESSAGES.forbidden, 403);
    }

    return { leaveRequest, adminOverride: false };
}

function getCancellationApproverWhere(
    actor: CancellationDecisionActor,
    leaveRequest: LeaveCancellationRequest,
    adminOverride: boolean,
): Prisma.LeaveRequestWhereInput {
    const ownerExclusion = { employeeId: { not: actor.employeeId } };
    if (adminOverride) return ownerExclusion;
    return {
        ...ownerExclusion,
        ...(leaveRequest.exceptionApproverId !== null
            ? { exceptionApproverId: actor.employeeId }
            : { approverId: actor.employeeId }),
    };
}

function requireAdminOverrideReason(reason: string | null | undefined): string {
    const normalizedReason = normalizeLeaveRecoveryReason(reason);
    if (!normalizedReason) {
        throw new LeaveCancellationError(
            LEAVE_CANCELLATION_MESSAGES.adminOverrideReasonRequired,
            400,
        );
    }
    return normalizedReason;
}

function getExceptionApproverUserId(
    leaveRequest: LeaveCancellationRequest,
): number | null {
    return getEffectiveLeaveApprover(leaveRequest)?.user?.id ?? null;
}

function getExceptionApproverName(
    leaveRequest: LeaveCancellationRequest,
): string | null {
    const approver = getEffectiveLeaveApprover(leaveRequest);
    return approver ? formatEmployeeName(approver) : null;
}

async function markPendingApprovalNotificationsRead(
    tx: Prisma.TransactionClient,
    leaveRequest: LeaveCancellationRequest,
): Promise<void> {
    const approverUserId = leaveRequest.approver?.user?.id;
    if (!approverUserId) return;

    await tx.notification.updateMany({
        where: {
            userId: approverUserId,
            type: "LEAVE_REQUESTED",
            referenceId: leaveRequest.id,
            isRead: false,
        },
        data: { isRead: true },
    });
}

async function markApprovedNotificationsRead(
    tx: Prisma.TransactionClient,
    employeeUserId: number,
    leaveRequest: LeaveCancellationRequest,
): Promise<void> {
    await tx.notification.updateMany({
        where: {
            userId: employeeUserId,
            type: "LEAVE_APPROVED",
            referenceId: leaveRequest.id,
            isRead: false,
        },
        data: { isRead: true },
    });

    await markPendingApprovalNotificationsRead(tx, leaveRequest);
}

async function markCancellationNotificationsRead(
    tx: Prisma.TransactionClient,
    leaveRequest: LeaveCancellationRequest,
): Promise<void> {
    const approverUserId = getExceptionApproverUserId(leaveRequest);
    if (!approverUserId) return;

    await tx.notification.updateMany({
        where: {
            userId: approverUserId,
            type: "LEAVE_CANCELLATION_REQUESTED",
            referenceId: leaveRequest.id,
            isRead: false,
        },
        data: { isRead: true },
    });
}

async function createSelfCancelledNotification(
    tx: Prisma.TransactionClient,
    userId: number,
    leaveRequest: LeaveCancellationRequest,
): Promise<void> {
    await tx.notification.create({
        data: {
            userId,
            type: "LEAVE_CANCELLED",
            title: "คำขอลาถูกยกเลิกแล้ว",
            message: `ยกเลิกคำขอ${getLeaveTypeLabel(leaveRequest.leaveType)} ${formatLeaveSummary({
                startDate: leaveRequest.startDate.toISOString(),
                endDate: leaveRequest.endDate.toISOString(),
                period: leaveRequest.period,
                durationDays: halfDaysToDays(leaveRequest.durationHalfDays),
            })} แล้ว`,
            actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.leaveHistory),
            referenceId: leaveRequest.id,
            dedupeKey: `leave:${userId}:LEAVE_CANCELLED:${leaveRequest.id}`,
        },
    });
}

async function createCancellationRequestedNotification(
    tx: Prisma.TransactionClient,
    userId: number,
    leaveRequest: LeaveCancellationRequest,
): Promise<void> {
    await tx.notification.create({
        data: {
            userId,
            type: "LEAVE_CANCELLATION_REQUESTED",
            title: "ส่งคำขอยกเลิกวันลาแล้ว",
            message: `ส่งคำขอยกเลิก${getLeaveTypeLabel(leaveRequest.leaveType)}แล้ว รอผู้อนุมัติยืนยัน`,
            actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.leaveHistory),
            referenceId: leaveRequest.id,
            dedupeKey: `leave:${userId}:LEAVE_CANCELLATION_REQUESTED:${leaveRequest.id}`,
        },
    });
}

async function createCancellationRejectedNotification(
    tx: Prisma.TransactionClient,
    leaveRequest: LeaveCancellationRequest,
): Promise<void> {
    const employeeUserId = leaveRequest.employee.user?.id;
    if (!employeeUserId) return;

    await tx.notification.create({
        data: {
            userId: employeeUserId,
            type: "SYSTEM_ALERT",
            title: "คำขอยกเลิกวันลาไม่ได้รับการอนุมัติ",
            message: `คำขอลา${getLeaveTypeLabel(leaveRequest.leaveType)} ${formatLeaveSummary({
                startDate: leaveRequest.startDate.toISOString(),
                endDate: leaveRequest.endDate.toISOString(),
                period: leaveRequest.period,
                durationDays: halfDaysToDays(leaveRequest.durationHalfDays),
            })} ยังคงมีสถานะอนุมัติ`,
            actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.leaveHistory),
            referenceId: leaveRequest.id,
            dedupeKey: `leave:${employeeUserId}:LEAVE_CANCELLATION_REJECTED:${leaveRequest.id}`,
        },
    });
}

function withCancellationInclude(
    request: LeaveCancellationScalars,
    original: LeaveCancellationRequest,
    overrides: Partial<LeaveCancellationScalars> = {},
): LeaveCancellationRequest {
    return {
        ...original,
        ...request,
        ...overrides,
    } as LeaveCancellationRequest;
}
