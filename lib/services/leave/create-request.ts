import type { Prisma } from "@prisma/client";

import { DEFAULT_LEAVE_QUOTA_HALF_DAYS } from "@/constants/leave";
import { runSerializableTransaction } from "@/lib/db/transaction";
import {
    isActiveEmployeeInTransaction,
    isEmployeeInTransaction,
} from "@/lib/services/leave/active-employee-session";
import { isActiveLeaveApprover } from "@/lib/services/leave/approver-eligibility";
import { auditCreatedLeaveRequest } from "@/lib/services/leave/create-request-audit";
import {
    LEAVE_REQUEST_MESSAGES,
    LeaveRequestError,
} from "@/lib/services/leave/create-request-errors";
import {
    EMPLOYEE_INCLUDE,
    LEAVE_REQUEST_INCLUDE,
    type CreatedLeaveRequest,
    type EligibleEmployee,
} from "@/lib/services/leave/create-request-prisma";
import { halfDaysToDays } from "@/lib/services/leave/half-days";
import {
    buildConfiguredApproverSnapshot,
    buildLeaveActionDeliveryIdentity,
    buildLeaveRecipientSnapshot,
    type LeaveActionPayload,
} from "@/lib/services/leave/notification-payloads";
import { calculateAdditionalOverQuotaHalfDays } from "@/lib/services/leave/over-quota";
import { getLeaveYearFromDateValue } from "@/lib/services/leave/quota-year";
import { calculateLeaveDurationHalfDays, isWorkingDay } from "@/lib/services/leave/utils";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import type { StoredLeaveAttachment } from "@/lib/uploads/leave";
import type { LeaveRequestValues } from "@/lib/validations/leave";

interface PreparedLeaveRequest {
    payload: LeaveRequestValues;
    start: Date;
    end: Date;
    currentYear: number;
    durationHalfDays: number;
    durationDays: number;
    emergencyReason: string | null;
    specialReason: string | null;
}

export interface CreateLeaveRequestInput {
    id: string;
    userId: number;
    userEmail: string;
    employeeId: number;
    payload: LeaveRequestValues;
    attachments: readonly StoredLeaveAttachment[];
}

function prepareLeaveRequest(payload: LeaveRequestValues): PreparedLeaveRequest {
    const { startDate, endDate, period } = payload;
    if (period !== "FULL_DAY" && startDate !== endDate) {
        throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.halfDayMultiDate, 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationHalfDays = calculateLeaveDurationHalfDays(start, end, period);
    if (durationHalfDays === 0) {
        throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.holidayConflict, 400);
    }
    if (period === "FULL_DAY" && (!isWorkingDay(start) || !isWorkingDay(end))) {
        throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.holidayConflict, 400);
    }

    return {
        payload,
        start,
        end,
        currentYear: getLeaveYearFromDateValue(startDate),
        durationHalfDays,
        durationDays: halfDaysToDays(durationHalfDays),
        emergencyReason: payload.emergencyReason?.trim() || null,
        specialReason: payload.specialReason?.trim() || null,
    };
}

async function getEligibleEmployee(
    tx: Prisma.TransactionClient,
    input: CreateLeaveRequestInput,
): Promise<EligibleEmployee> {
    if (!await isActiveEmployeeInTransaction(tx, input.userId, input.employeeId)) {
        const employeeExists = await isEmployeeInTransaction(tx, input.employeeId);
        throw new LeaveRequestError(
            employeeExists
                ? COMMON_API_MESSAGES.forbidden
                : LEAVE_REQUEST_MESSAGES.employeeNotFound,
            employeeExists ? 403 : 404,
        );
    }

    const employee = await tx.employee.findUnique({
        where: { id: input.employeeId },
        include: EMPLOYEE_INCLUDE,
    });
    if (!employee) {
        throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.employeeNotFound, 404);
    }
    if (!employee.managerId) {
        throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.approverNotConfigured, 400);
    }
    const { manager } = employee;
    if (!isActiveLeaveApprover(manager)) {
        throw new LeaveRequestError(
            LEAVE_REQUEST_MESSAGES.approverAccountNotConfigured,
            400,
        );
    }
    if (manager.id === employee.id) {
        throw new LeaveRequestError(
            LEAVE_REQUEST_MESSAGES.approverAccountNotConfigured,
            400,
        );
    }
    return { ...employee, manager };
}

async function assertNoOverlap(
    tx: Prisma.TransactionClient,
    employeeId: number,
    start: Date,
    end: Date,
): Promise<void> {
    const overlap = await tx.leaveRequest.findFirst({
        where: {
            employeeId,
            status: { in: ["PENDING", "APPROVED"] },
            AND: [
                { startDate: { lte: end } },
                { endDate: { gte: start } },
            ],
        },
    });
    if (overlap) {
        throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.overlapConflict, 409);
    }
}

async function getOrCreateQuota(
    tx: Prisma.TransactionClient,
    input: CreateLeaveRequestInput,
    prepared: PreparedLeaveRequest,
): Promise<{ totalHalfDays: number; usedHalfDays: number }> {
    const { leaveType } = prepared.payload;
    const existing = await tx.leaveQuota.findFirst({
        where: {
            employeeId: input.employeeId,
            year: prepared.currentYear,
            leaveType,
        },
    });
    if (existing) {
        return existing;
    }
    return tx.leaveQuota.create({
        data: {
            employeeId: input.employeeId,
            year: prepared.currentYear,
            leaveType,
            totalHalfDays: DEFAULT_LEAVE_QUOTA_HALF_DAYS[leaveType],
            usedHalfDays: 0,
        },
    });
}

function getOverQuotaHalfDays(
    quota: { totalHalfDays: number; usedHalfDays: number },
    prepared: PreparedLeaveRequest,
): number {
    const overQuotaHalfDays = calculateAdditionalOverQuotaHalfDays(
        quota.totalHalfDays,
        quota.usedHalfDays,
        prepared.durationHalfDays,
    );
    if (overQuotaHalfDays > 0 && !prepared.specialReason) {
        throw new LeaveRequestError(LEAVE_REQUEST_MESSAGES.specialReasonRequired, 400);
    }
    return overQuotaHalfDays;
}

async function enqueueLeaveNotification(
    tx: Prisma.TransactionClient,
    input: CreateLeaveRequestInput,
    prepared: PreparedLeaveRequest,
    employee: EligibleEmployee,
    overQuotaHalfDays: number,
): Promise<void> {
    const payload: LeaveActionPayload = {
        leaveId: input.id,
        deliveryIdentity: buildLeaveActionDeliveryIdentity(
            input.id,
            employee.manager.user.id,
        ),
        employee: buildLeaveRecipientSnapshot(employee),
        approver: buildConfiguredApproverSnapshot(employee.manager),
        leaveType: prepared.payload.leaveType,
        startDate: prepared.start.toISOString(),
        endDate: prepared.end.toISOString(),
        period: prepared.payload.period,
        durationDays: prepared.durationDays,
        reason: prepared.payload.reason,
        emergencyReason: prepared.emergencyReason,
        specialReason: prepared.specialReason,
        overQuotaDays: halfDaysToDays(overQuotaHalfDays),
    };
    await tx.notificationOutbox.create({
        data: { type: "LEAVE_ACTION", payload: JSON.stringify(payload) },
    });
}

async function createInTransaction(
    tx: Prisma.TransactionClient,
    input: CreateLeaveRequestInput,
    prepared: PreparedLeaveRequest,
): Promise<CreatedLeaveRequest> {
    const employee = await getEligibleEmployee(tx, input);
    await assertNoOverlap(tx, input.employeeId, prepared.start, prepared.end);
    const quota = await getOrCreateQuota(tx, input, prepared);
    const overQuotaHalfDays = getOverQuotaHalfDays(quota, prepared);
    const attachmentData = input.attachments.map((attachment) => ({ ...attachment }));

    const leaveRequest = await tx.leaveRequest.create({
        data: {
            id: input.id,
            employeeId: input.employeeId,
            leaveType: prepared.payload.leaveType,
            startDate: prepared.start,
            endDate: prepared.end,
            period: prepared.payload.period,
            durationHalfDays: prepared.durationHalfDays,
            reason: prepared.payload.reason,
            emergencyReason: prepared.emergencyReason,
            specialReason: prepared.specialReason,
            overQuotaHalfDays,
            status: "PENDING",
            approverId: employee.managerId,
            ...(attachmentData.length > 0
                ? { attachments: { create: attachmentData } }
                : {}),
        },
        include: LEAVE_REQUEST_INCLUDE,
    });
    await enqueueLeaveNotification(tx, input, prepared, employee, overQuotaHalfDays);
    return leaveRequest;
}

export async function createLeaveRequest(
    input: CreateLeaveRequestInput,
): Promise<CreatedLeaveRequest> {
    const prepared = prepareLeaveRequest(input.payload);
    const result = await runSerializableTransaction((tx) =>
        createInTransaction(tx, input, prepared),
    );
    await auditCreatedLeaveRequest({
        id: input.id,
        userId: input.userId,
        userEmail: input.userEmail,
        attachmentCount: input.attachments.length,
    });
    return result;
}

export { LeaveRequestError } from "@/lib/services/leave/create-request-errors";
export type { CreatedLeaveRequest } from "@/lib/services/leave/create-request-prisma";
