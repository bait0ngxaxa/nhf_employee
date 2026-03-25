import { NextResponse, after } from "next/server";

import { DEFAULT_LEAVE_QUOTAS } from "@/constants/leave";
import { logLeaveEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { getWorkingDays } from "@/lib/services/leave/utils";
import { processOutbox } from "@/lib/services/outbox/processor";
import { getApiAuthSession } from "@/lib/server-auth";
import { jsonError, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { leaveRequestSchema } from "@/lib/validations/leave";

const LEAVE_REQUEST_MESSAGES = {
    holidayConflict: "วันที่ลาตรงกับวันหยุด",
    approverNotConfigured: "ยังไม่ได้ตั้งค่าผู้อนุมัติ",
    overlapConflict: "มีคำขอลาในช่วงวันที่นี้อยู่แล้ว",
    employeeNotFound: "ไม่พบข้อมูลพนักงาน",
    halfDayMultiDate: "การลาครึ่งวันต้องเลือกวันลาเพียงวันเดียว",
    quotaExceeded: "สิทธิ์ลาคงเหลือไม่เพียงพอ",
} as const;

class LeaveRequestError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "LeaveRequestError";
        this.statusCode = statusCode;
    }
}

const isWorkingDay = (date: Date): boolean => {
    const day = date.getDay();
    return day !== 0 && day !== 6;
};

export async function POST(req: Request) {
    try {
        const session = await getApiAuthSession();
        if (!session?.user?.id) {
            return unauthorized();
        }

        const userId = Number(session.user.id);
        if (Number.isNaN(userId)) {
            return jsonError(COMMON_API_MESSAGES.invalidUserId, 400);
        }

        const employeeId = await getEmployeeIdFromUserId(userId);
        if (!employeeId) {
            return jsonError(COMMON_API_MESSAGES.operationFailed, 404);
        }

        const data = await req.json();
        const parsed = leaveRequestSchema.safeParse(data);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.format(),
            });
        }

        const { leaveType, startDate, endDate, period, reason } = parsed.data;
        const currentYear = new Date(startDate).getFullYear();

        if (period !== "FULL_DAY" && startDate !== endDate) {
            return jsonError(LEAVE_REQUEST_MESSAGES.halfDayMultiDate, 400);
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        let diffDays = getWorkingDays(start, end);

        if (period !== "FULL_DAY") {
            if (diffDays === 0) {
                return jsonError(LEAVE_REQUEST_MESSAGES.holidayConflict, 400);
            }
            diffDays = 0.5;
        } else if (diffDays === 0) {
            return jsonError(LEAVE_REQUEST_MESSAGES.holidayConflict, 400);
        } else if (!isWorkingDay(start) || !isWorkingDay(end)) {
            return jsonError(LEAVE_REQUEST_MESSAGES.holidayConflict, 400);
        }

        const durationDays = diffDays;

        const result = await prisma.$transaction(async (tx) => {
            const employee = await tx.employee.findUnique({
                where: { id: employeeId },
                include: { manager: true },
            });

            if (!employee) {
                throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.employeeNotFound, 404);
            }

            if (!employee.managerId) {
                throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.approverNotConfigured, 400);
            }

            const overlappingRequests = await tx.leaveRequest.findFirst({
                where: {
                    employeeId,
                    status: { in: ["PENDING", "APPROVED"] },
                    AND: [
                        { startDate: { lte: new Date(endDate) } },
                        { endDate: { gte: new Date(startDate) } },
                    ],
                },
            });

            if (overlappingRequests) {
                throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.overlapConflict, 409);
            }

            let quota = await tx.leaveQuota.findFirst({
                where: { employeeId, year: currentYear, leaveType },
            });

            if (!quota) {
                quota = await tx.leaveQuota.create({
                    data: {
                        employeeId,
                        year: currentYear,
                        leaveType,
                        totalDays: DEFAULT_LEAVE_QUOTAS[leaveType],
                        usedDays: 0,
                    },
                });
            }

            const availableQuota = quota.totalDays - quota.usedDays;
            if (durationDays > availableQuota) {
                throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.quotaExceeded, 400);
            }

            const leaveRequest = await tx.leaveRequest.create({
                data: {
                    employeeId,
                    leaveType,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    period,
                    durationDays,
                    reason,
                    status: "PENDING",
                    approverId: employee.managerId,
                },
            });

            await tx.notificationOutbox.create({
                data: {
                    type: "LEAVE_ACTION",
                    payload: JSON.stringify({
                        leaveId: leaveRequest.id,
                        employeeName: `${employee.firstName} ${employee.lastName}`,
                        managerId: employee.managerId,
                        leaveType,
                        startDate,
                        endDate,
                        durationDays,
                        reason,
                    }),
                },
            });

            return leaveRequest;
        });

        after(() => {
            processOutbox().catch((err) =>
                console.error("Failed to process outbox in background:", err),
            );
        });

        await logLeaveEvent("LEAVE_REQUEST_CREATE", result.id, userId, session.user.email || "", {
            metadata: {
                leaveType,
                period,
                durationDays,
                startDate,
                endDate,
                reason,
            },
        }).catch((err) => console.error("Failed to log audit event:", err));

        return NextResponse.json({ success: true, data: result }, { status: 201 });
    } catch (error) {
        console.error("Leave request error:", error);
        if (error instanceof LeaveRequestError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(
            error instanceof Error ? error.message : COMMON_API_MESSAGES.failedToSubmitLeaveRequest,
            500,
        );
    }
}
