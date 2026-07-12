import { Prisma } from "@prisma/client";
import { after, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logLeaveEvent } from "@/lib/server/audit";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
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
import { jsonError, notFound, operationFailed } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { APP_DASHBOARD_TABS, toDashboardTabPath } from "@/lib/ssot/routes";
import {
    leaveNotTakenConfirmSchema,
    leaveNotTakenRequestSchema,
} from "@/lib/validations/leave";

const NOT_TAKEN_MESSAGES = {
    requestNotFound: "ไม่พบคำขอลาที่แจ้งไม่ได้ใช้วันลาได้",
    confirmNotFound: "ไม่พบคำขอคืนโควต้าที่รอยืนยัน",
    invalidStatus: "แจ้งไม่ได้ใช้วันลาได้เฉพาะคำขอที่อนุมัติแล้ว",
    tooEarly: "แจ้งไม่ได้ใช้วันลาได้หลังวันสิ้นสุดการลาผ่านไปแล้ว",
    alreadyRequested: "คำขอนี้ถูกแจ้งว่าไม่ได้ใช้วันลาแล้ว",
    forbidden: "คุณไม่มีสิทธิ์ดำเนินการกับคำขอนี้",
    quotaNotFound: "ไม่สามารถตรวจสอบสิทธิ์ลาของคำขอนี้ได้ กรุณาติดต่อผู้ดูแลระบบ",
    approverAccountNotConfigured: "ผู้อนุมัติยังไม่มีบัญชีผู้ใช้ในระบบ",
} as const;

class LeaveNotTakenError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "LeaveNotTakenError";
        this.statusCode = statusCode;
    }
}

export async function POST(req: Request): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const userId = Number(auth.session.user.id);
        if (Number.isNaN(userId)) {
            return jsonError(COMMON_API_MESSAGES.invalidUserId, 400);
        }

        const employeeId = await getEmployeeIdFromUserId(userId);
        if (!employeeId) {
            return operationFailed(404);
        }

        const body = await req.json();
        const parsed = leaveNotTakenRequestSchema.safeParse(body);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: parsed.data.leaveId },
                include: {
                    employee: {
                        include: { user: { select: { id: true } } },
                    },
                    approver: {
                        include: {
                            user: { select: { id: true, isActive: true } },
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
            if (!leaveRequest.approver?.user?.id || !leaveRequest.approver.user.isActive) {
                throw new LeaveNotTakenError(
                    NOT_TAKEN_MESSAGES.approverAccountNotConfigured,
                    400,
                );
            }

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
            };

            const payload: LeaveNotTakenRequestedPayload = {
                leaveId: leaveRequest.id,
                employee: buildLeaveRecipientSnapshot(leaveRequest.employee),
                approver: buildConfiguredApproverSnapshot(leaveRequest.approver),
                leaveType: leaveRequest.leaveType,
                startDate: leaveRequest.startDate.toISOString(),
                endDate: leaveRequest.endDate.toISOString(),
                period: leaveRequest.period,
                durationDays: leaveRequest.durationDays,
                note: parsed.data.note,
            };

            await tx.notificationOutbox.create({
                data: {
                    type: "LEAVE_NOT_TAKEN_REQUESTED",
                    payload: JSON.stringify(payload),
                },
            });

            await tx.notification.create({
                data: {
                    userId,
                    type: "LEAVE_NOT_TAKEN_REQUESTED",
                    title: "แจ้งไม่ได้ใช้วันลาแล้ว",
                    message: `แจ้งไม่ได้ใช้วันลาแล้ว: ${getLeaveTypeLabel(leaveRequest.leaveType)} ${formatLeaveSummary(payload)}`,
                    actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.leaveHistory),
                    referenceId: leaveRequest.id,
                },
            });

            return updatedRequest;
        });

        await logLeaveEvent(
            "LEAVE_REQUEST_NOT_TAKEN_REQUEST",
            result.id,
            userId,
            auth.user.email,
            { metadata: { note: parsed.data.note } },
        ).catch((err) => console.error("Failed to log leave not-taken request:", err));

        after(() => {
            processOutbox().catch((err) =>
                console.error("Failed to process leave not-taken outbox:", err),
            );
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Leave not-taken request error:", error);
        if (error instanceof LeaveNotTakenError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.operationFailed, 500);
    }
}

export async function PUT(req: Request): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const userId = Number(auth.session.user.id);
        if (Number.isNaN(userId)) {
            return jsonError(COMMON_API_MESSAGES.invalidUserId, 400);
        }

        const managerId = await getEmployeeIdFromUserId(userId);
        if (!managerId) {
            return operationFailed(404);
        }

        const body = await req.json();
        const parsed = leaveNotTakenConfirmSchema.safeParse(body);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: parsed.data.leaveId },
                include: {
                    employee: {
                        include: { user: { select: { id: true } } },
                    },
                    approver: true,
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
            if (leaveRequest.approverId !== managerId) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.forbidden, 403);
            }

            const claimedRequest = await tx.leaveRequest.updateMany({
                where: {
                    id: leaveRequest.id,
                    status: "APPROVED",
                    approverId: managerId,
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
                data: { usedDays: { decrement: leaveRequest.durationDays } },
            });
            if (updatedQuota.usedDays < 0) {
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

            const payload: LeaveNotTakenConfirmedPayload = {
                leaveId: leaveRequest.id,
                employee: buildLeaveRecipientSnapshot(leaveRequest.employee),
                approverName: leaveRequest.approver
                    ? formatEmployeeName(leaveRequest.approver)
                    : auth.user.name,
                leaveType: leaveRequest.leaveType,
                startDate: leaveRequest.startDate.toISOString(),
                endDate: leaveRequest.endDate.toISOString(),
                period: leaveRequest.period,
                durationDays: leaveRequest.durationDays,
            };

            await tx.notificationOutbox.create({
                data: {
                    type: "LEAVE_NOT_TAKEN_CONFIRMED",
                    payload: JSON.stringify(payload),
                },
            });

            return updatedRequest;
        }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });

        await logLeaveEvent(
            "LEAVE_REQUEST_NOT_TAKEN_CONFIRM",
            result.id,
            userId,
            auth.user.email,
            { after: { status: "NOT_TAKEN" } },
        ).catch((err) => console.error("Failed to log leave not-taken confirm:", err));

        after(() => {
            processOutbox().catch((err) =>
                console.error("Failed to process leave not-taken confirm outbox:", err),
            );
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Leave not-taken confirm error:", error);
        if (error instanceof LeaveNotTakenError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.operationFailed, 500);
    }
}
