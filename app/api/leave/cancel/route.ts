import { after, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { logLeaveEvent } from "@/lib/server/audit";
import { prisma } from "@/lib/db/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import {
    buildConfiguredApproverSnapshot,
    buildLeaveRecipientSnapshot,
    type LeaveCancelledPayload,
} from "@/lib/services/leave/notification-payloads";
import {
    formatLeaveSummary,
    getLeaveTypeLabel,
} from "@/lib/services/leave/notification-format";
import { processOutbox } from "@/lib/services/outbox/processor";
import { jsonError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { APP_DASHBOARD_TABS, toDashboardTabPath } from "@/lib/ssot/routes";
import { leaveCancelSchema } from "@/lib/validations/leave";

const LEAVE_CANCEL_MESSAGES = {
    notFound: "ไม่พบคำขอลาที่ยกเลิกได้",
    invalidStatus: "คำขอนี้ไม่สามารถยกเลิกได้แล้ว",
    approverAccountNotConfigured: "ผู้อนุมัติยังไม่มีบัญชีผู้ใช้ในระบบ",
} as const;

class LeaveCancelError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "LeaveCancelError";
        this.statusCode = statusCode;
    }
}

export async function POST(req: Request) {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const userId = Number(auth.session.user.id);
        if (Number.isNaN(userId)) {
            return jsonError(COMMON_API_MESSAGES.invalidUserId, 400);
        }

        const employeeId = await getEmployeeIdFromUserId(userId);
        if (!employeeId) {
            return jsonError(COMMON_API_MESSAGES.employeeProfileNotFound, 404);
        }

        const body = await req.json();
        const parsed = leaveCancelSchema.safeParse(body);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }
        const { leaveId } = parsed.data;

        const result = await prisma.$transaction(async (tx) => {
            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: leaveId },
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
                throw new LeaveCancelError(LEAVE_CANCEL_MESSAGES.notFound, 404);
            }
            if (leaveRequest.status !== "PENDING") {
                throw new LeaveCancelError(LEAVE_CANCEL_MESSAGES.invalidStatus, 409);
            }
            if (!leaveRequest.approver?.user?.id || !leaveRequest.approver.user.isActive) {
                throw new LeaveCancelError(
                    LEAVE_CANCEL_MESSAGES.approverAccountNotConfigured,
                    400,
                );
            }

            const updatedLeaveRequest = await tx.leaveRequest.update({
                where: { id: leaveId },
                data: { status: "CANCELLED" },
            });

            const payload: LeaveCancelledPayload = {
                leaveId,
                employee: buildLeaveRecipientSnapshot(leaveRequest.employee),
                approver: buildConfiguredApproverSnapshot(leaveRequest.approver),
                leaveType: leaveRequest.leaveType,
                startDate: leaveRequest.startDate.toISOString(),
                endDate: leaveRequest.endDate.toISOString(),
                period: leaveRequest.period,
                durationDays: leaveRequest.durationDays,
            };

            await tx.notification.updateMany({
                where: {
                    userId: payload.approver.userId,
                    type: "LEAVE_REQUESTED",
                    referenceId: leaveId,
                    isRead: false,
                },
                data: { isRead: true },
            });

            await tx.notificationOutbox.create({
                data: {
                    type: "LEAVE_CANCELLED",
                    payload: JSON.stringify(payload),
                },
            });

            await tx.notification.create({
                data: {
                    userId,
                    type: "LEAVE_CANCELLED",
                    title: "คำขอลาถูกยกเลิกแล้ว",
                    message: `ยกเลิกคำขอ${getLeaveTypeLabel(leaveRequest.leaveType)} ${formatLeaveSummary(payload)} แล้ว`,
                    actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.leaveHistory),
                    referenceId: leaveId,
                },
            });

            return updatedLeaveRequest;
        });

        await logLeaveEvent("LEAVE_REQUEST_CANCEL", leaveId, userId, auth.user.email, {
            after: { status: "CANCELLED" },
        }).catch((err) => console.error("Failed to log leave cancel:", err));

        after(() => {
            processOutbox().catch((err) =>
                console.error("Failed to process leave cancel outbox:", err),
            );
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Cancel leave error:", error);
        if (error instanceof LeaveCancelError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.internalServerError, 500);
    }
}
