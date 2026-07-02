import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logLeaveEvent } from "@/lib/server/audit";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { isAfterLeaveEnd } from "@/lib/services/leave/utils";
import { jsonError, operationFailed } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
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

            return tx.leaveRequest.update({
                where: { id: leaveRequest.id },
                data: {
                    notTakenReason: parsed.data.note,
                    notTakenRequestedAt: new Date(),
                },
            });
        });

        await logLeaveEvent(
            "LEAVE_REQUEST_NOT_TAKEN_REQUEST",
            result.id,
            userId,
            auth.user.email,
            { metadata: { note: parsed.data.note } },
        ).catch((err) => console.error("Failed to log leave not-taken request:", err));

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

            const quota = await tx.leaveQuota.findFirst({
                where: {
                    employeeId: leaveRequest.employeeId,
                    leaveType: leaveRequest.leaveType,
                    year: new Date(leaveRequest.startDate).getFullYear(),
                },
            });

            if (!quota) {
                throw new LeaveNotTakenError(NOT_TAKEN_MESSAGES.quotaNotFound, 409);
            }

            const updatedRequest = await tx.leaveRequest.update({
                where: { id: leaveRequest.id },
                data: {
                    status: "NOT_TAKEN",
                    notTakenConfirmedAt: new Date(),
                    notTakenConfirmedById: managerId,
                },
            });

            await tx.leaveQuota.update({
                where: { id: quota.id },
                data: { usedDays: quota.usedDays - leaveRequest.durationDays },
            });

            return updatedRequest;
        });

        await logLeaveEvent(
            "LEAVE_REQUEST_NOT_TAKEN_CONFIRM",
            result.id,
            userId,
            auth.user.email,
            { after: { status: "NOT_TAKEN" } },
        ).catch((err) => console.error("Failed to log leave not-taken confirm:", err));

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Leave not-taken confirm error:", error);
        if (error instanceof LeaveNotTakenError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.operationFailed, 500);
    }
}
