import { NextResponse, after } from "next/server";

import { DEFAULT_LEAVE_QUOTAS } from "@/constants/leave";
import { requireApiSession } from "@/lib/auth/api";
import { logLeaveEvent } from "@/lib/server/audit";
import { prisma } from "@/lib/db/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { calculateAdditionalOverQuotaDays } from "@/lib/services/leave/over-quota";
import {
    buildConfiguredApproverSnapshot,
    buildLeaveRecipientSnapshot,
    type LeaveActionPayload,
} from "@/lib/services/leave/notification-payloads";
import { getLeaveYearFromDateValue } from "@/lib/services/leave/quota-year";
import { calculateLeaveDuration, isWorkingDay } from "@/lib/services/leave/utils";
import { processOutbox } from "@/lib/services/outbox/processor";
import { jsonError, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { leaveRequestSchema } from "@/lib/validations/leave";

const LEAVE_REQUEST_MESSAGES = {
    holidayConflict: "วันที่ลาตรงกับวันหยุด",
    approverNotConfigured: "ยังไม่ได้ตั้งค่าผู้อนุมัติ",
    approverAccountNotConfigured: "ผู้อนุมัติยังไม่มีบัญชีผู้ใช้ในระบบ",
    overlapConflict: "มีคำขอลาในช่วงวันที่นี้อยู่แล้ว",
    employeeNotFound: "ไม่พบข้อมูลพนักงาน",
    halfDayMultiDate: "การลาครึ่งวันต้องเลือกวันลาเพียงวันเดียว",
    specialReasonRequired: "กรุณาระบุเหตุผลพิเศษสำหรับการลาเกินโควต้า",
} as const;

class LeaveRequestError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "LeaveRequestError";
        this.statusCode = statusCode;
    }
}

export async function POST(req: Request) {
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
            return jsonError(COMMON_API_MESSAGES.operationFailed, 404);
        }

        const data = await req.json();
        const parsed = leaveRequestSchema.safeParse(data);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.format(),
            });
        }

        const {
            leaveType,
            startDate,
            endDate,
            period,
            reason,
            emergencyReason,
            specialReason,
        } = parsed.data;
        const normalizedEmergencyReason = emergencyReason?.trim() ? emergencyReason.trim() : null;
        const normalizedSpecialReason = specialReason?.trim() ? specialReason.trim() : null;
        const currentYear = getLeaveYearFromDateValue(startDate);

        if (period !== "FULL_DAY" && startDate !== endDate) {
            return jsonError(LEAVE_REQUEST_MESSAGES.halfDayMultiDate, 400);
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const durationDays = calculateLeaveDuration(start, end, period);

        if (period !== "FULL_DAY") {
            if (durationDays === 0) {
                return jsonError(LEAVE_REQUEST_MESSAGES.holidayConflict, 400);
            }
        } else if (durationDays === 0) {
            return jsonError(LEAVE_REQUEST_MESSAGES.holidayConflict, 400);
        } else if (!isWorkingDay(start) || !isWorkingDay(end)) {
            return jsonError(LEAVE_REQUEST_MESSAGES.holidayConflict, 400);
        }

        const result = await prisma.$transaction(async (tx) => {
            const employee = await tx.employee.findUnique({
                where: { id: employeeId },
                include: {
                    user: { select: { id: true } },
                    manager: {
                        include: {
                            user: { select: { id: true, isActive: true } },
                        },
                    },
                },
            });

            if (!employee) {
                throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.employeeNotFound, 404);
            }

            if (!employee.managerId) {
                throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.approverNotConfigured, 400);
            }
            if (!employee.manager?.user?.id || !employee.manager.user.isActive) {
                throw new LeaveRequestError(
                    LEAVE_REQUEST_MESSAGES.approverAccountNotConfigured,
                    400,
                );
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

            const overQuotaDays = calculateAdditionalOverQuotaDays(
                quota.totalDays,
                quota.usedDays,
                durationDays,
            );
            if (overQuotaDays > 0 && !normalizedSpecialReason) {
                throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.specialReasonRequired, 400);
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
                    emergencyReason: normalizedEmergencyReason,
                    specialReason: normalizedSpecialReason,
                    overQuotaDays,
                    status: "PENDING",
                    approverId: employee.managerId,
                },
            });

            const payload: LeaveActionPayload = {
                leaveId: leaveRequest.id,
                employee: buildLeaveRecipientSnapshot(employee),
                approver: buildConfiguredApproverSnapshot(employee.manager),
                leaveType,
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                period,
                durationDays,
                reason,
                emergencyReason: normalizedEmergencyReason,
                specialReason: normalizedSpecialReason,
                overQuotaDays,
            };

            await tx.notificationOutbox.create({
                data: {
                    type: "LEAVE_ACTION",
                    payload: JSON.stringify(payload),
                },
            });

            return leaveRequest;
        });

        after(() => {
            processOutbox().catch((err) =>
                console.error("Failed to process outbox in background:", err),
            );
        });

        await logLeaveEvent("LEAVE_REQUEST_CREATE", result.id, userId, auth.user.email, {
            metadata: {
                leaveType,
                period,
                durationDays,
                startDate,
                endDate,
                reason,
                emergencyReason: normalizedEmergencyReason,
                specialReason: normalizedSpecialReason,
            },
        }).catch((err) => console.error("Failed to log audit event:", err));

        return NextResponse.json({ success: true, data: result }, { status: 201 });
    } catch (error) {
        console.error("Leave request error:", error);
        if (error instanceof LeaveRequestError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.failedToSubmitLeaveRequest, 500);
    }
}
