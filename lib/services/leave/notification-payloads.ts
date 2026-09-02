import * as z from "zod";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";
import { lineRetryKeySchema } from "@/lib/validations/line";

const dateStringSchema = z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "Invalid date string",
    });

const leaveTypeSchema = z.enum(["SICK", "PERSONAL", "VACATION"]);
const leavePeriodSchema = z.enum(["FULL_DAY", "MORNING", "AFTERNOON"]);
const leaveResultStatusSchema = z.enum(["APPROVED", "REJECTED"]);
const decisionActorFields = {
    decisionActorName: z.string().trim().min(1).nullable(),
    decisionActorRole: z.string().trim().min(1),
    recoveryOverride: z.boolean(),
};

const recipientSchema = z.object({
    employeeId: z.number().int().positive(),
    userId: z.number().int().positive().nullable(),
    email: z.string().email(),
    name: z.string().trim().min(1),
});

const configuredApproverSchema = recipientSchema.extend({
    userId: z.number().int().positive(),
});

const leaveDetailsSchema = z.object({
    leaveId: z.string().trim().min(1),
    leaveType: leaveTypeSchema,
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    period: leavePeriodSchema,
    durationDays: z.number().positive(),
});

const optionalTextSchema = z.string().nullable();

export const leaveActionPayloadSchema = leaveDetailsSchema.extend({
    deliveryIdentity: z.string().trim().min(1).optional(),
    employee: recipientSchema,
    approver: configuredApproverSchema,
    reason: z.string().trim().min(1),
    emergencyReason: optionalTextSchema,
    specialReason: optionalTextSchema,
    overQuotaDays: z.number().min(0),
});

export const leaveResultPayloadSchema = leaveDetailsSchema.extend({
    employee: recipientSchema,
    approverName: z.string().trim().min(1).nullable(),
    status: leaveResultStatusSchema,
    reason: optionalTextSchema,
});

export const leaveCancelledPayloadSchema = leaveDetailsSchema.extend({
    employee: recipientSchema,
    approver: configuredApproverSchema,
});

export const leaveCancellationRequestedPayloadSchema = leaveDetailsSchema.extend({
    employee: recipientSchema,
    approver: configuredApproverSchema,
    note: z.string().trim().min(1),
});

export const leaveCancelledAfterApprovalPayloadSchema = leaveDetailsSchema.extend({
    employee: recipientSchema,
    ...decisionActorFields,
});

export const leaveNotTakenRequestedPayloadSchema = leaveDetailsSchema.extend({
    employee: recipientSchema,
    approver: configuredApproverSchema,
    note: z.string().trim().min(1),
});

export const leaveNotTakenConfirmedPayloadSchema = leaveDetailsSchema.extend({
    employee: recipientSchema,
    ...decisionActorFields,
});

export const leaveActionLinePayloadSchema = leaveActionPayloadSchema.extend({
    retryKey: lineRetryKeySchema,
});

export const leaveResultLinePayloadSchema = leaveResultPayloadSchema.extend({
    retryKey: lineRetryKeySchema,
});

export const leaveCancelledLinePayloadSchema =
    leaveCancelledPayloadSchema.extend({ retryKey: lineRetryKeySchema });

export const leaveCancellationRequestedLinePayloadSchema =
    leaveCancellationRequestedPayloadSchema.extend({
        retryKey: lineRetryKeySchema,
    });

export const leaveCancelledAfterApprovalLinePayloadSchema =
    leaveCancelledAfterApprovalPayloadSchema.extend({
        retryKey: lineRetryKeySchema,
    });

export const leaveNotTakenRequestedLinePayloadSchema =
    leaveNotTakenRequestedPayloadSchema.extend({ retryKey: lineRetryKeySchema });

export const leaveNotTakenConfirmedLinePayloadSchema =
    leaveNotTakenConfirmedPayloadSchema.extend({ retryKey: lineRetryKeySchema });

export type LeaveNotificationRecipient = z.infer<typeof recipientSchema>;
export type LeaveConfiguredApprover = LeaveNotificationRecipient & {
    userId: number;
};
export type LeaveActionPayload = z.infer<typeof leaveActionPayloadSchema>;
export type LeaveResultPayload = z.infer<typeof leaveResultPayloadSchema>;
export type LeaveCancelledPayload = z.infer<typeof leaveCancelledPayloadSchema>;
export type LeaveCancellationRequestedPayload = z.infer<
    typeof leaveCancellationRequestedPayloadSchema
>;
export type LeaveCancelledAfterApprovalPayload = z.infer<
    typeof leaveCancelledAfterApprovalPayloadSchema
>;
export type LeaveNotTakenRequestedPayload = z.infer<
    typeof leaveNotTakenRequestedPayloadSchema
>;
export type LeaveNotTakenConfirmedPayload = z.infer<
    typeof leaveNotTakenConfirmedPayloadSchema
>;
export type LeaveActionLinePayload = z.infer<
    typeof leaveActionLinePayloadSchema
>;
export type LeaveResultLinePayload = z.infer<typeof leaveResultLinePayloadSchema>;
export type LeaveCancelledLinePayload = z.infer<
    typeof leaveCancelledLinePayloadSchema
>;
export type LeaveCancellationRequestedLinePayload = z.infer<
    typeof leaveCancellationRequestedLinePayloadSchema
>;
export type LeaveCancelledAfterApprovalLinePayload = z.infer<
    typeof leaveCancelledAfterApprovalLinePayloadSchema
>;
export type LeaveNotTakenRequestedLinePayload = z.infer<
    typeof leaveNotTakenRequestedLinePayloadSchema
>;
export type LeaveNotTakenConfirmedLinePayload = z.infer<
    typeof leaveNotTakenConfirmedLinePayloadSchema
>;

export type LeaveNotificationPayload =
    | LeaveActionPayload
    | LeaveResultPayload
    | LeaveCancelledPayload
    | LeaveCancellationRequestedPayload
    | LeaveCancelledAfterApprovalPayload
    | LeaveNotTakenRequestedPayload
    | LeaveNotTakenConfirmedPayload;

type EmployeeSnapshotSource = {
    id: number;
    firstName: string;
    lastName: string;
    nickname?: string | null;
    email: string;
    user?: { id: number } | null;
};

type ConfiguredApproverSource = Omit<EmployeeSnapshotSource, "user"> & {
    user?: { id: number; email: string } | null;
};

export function buildLeaveRecipientSnapshot(
    employee: EmployeeSnapshotSource,
): LeaveNotificationRecipient {
    return {
        employeeId: employee.id,
        userId: employee.user?.id ?? null,
        email: employee.email,
        name: getEmployeeDisplayName(employee),
    };
}

export function buildConfiguredApproverSnapshot(
    employee: ConfiguredApproverSource,
): LeaveConfiguredApprover {
    if (!employee.user) {
        throw new Error("Configured approver user is required");
    }

    return {
        employeeId: employee.id,
        userId: employee.user.id,
        email: employee.user.email,
        name: getEmployeeDisplayName(employee),
    };
}

export function buildLeaveActionDeliveryIdentity(
    leaveId: string,
    approverUserId: number,
): string {
    return `${leaveId}:${approverUserId}`;
}

export function getLeaveActionDeliveryIdentity(
    payload: LeaveActionPayload,
): string {
    return payload.deliveryIdentity ?? buildLeaveActionDeliveryIdentity(
        payload.leaveId,
        payload.approver.userId,
    );
}

function parseLeavePayload<T>(
    schema: z.ZodType<T>,
    payload: unknown,
    label: string,
): T {
    const result = schema.safeParse(payload);
    if (!result.success) {
        throw new Error(`Invalid ${label} payload`);
    }

    return result.data;
}

function normalizeLegacyDecisionActorPayload(payload: unknown): unknown {
    if (!isRecord(payload)) {
        return payload;
    }

    const hasDecisionActorField = [
        "decisionActorName",
        "decisionActorRole",
        "recoveryOverride",
    ].some((field) => Object.prototype.hasOwnProperty.call(payload, field));
    if (hasDecisionActorField) {
        return payload;
    }

    const legacyActorName = payload.approverName;
    if (
        legacyActorName !== undefined
        && legacyActorName !== null
        && typeof legacyActorName !== "string"
    ) {
        return payload;
    }

    return {
        ...payload,
        decisionActorName: legacyActorName ?? null,
        decisionActorRole: "USER",
        recoveryOverride: false,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseLeaveActionPayload(payload: unknown): LeaveActionPayload {
    return parseLeavePayload(leaveActionPayloadSchema, payload, "LEAVE_ACTION");
}

export function parseLeaveResultPayload(payload: unknown): LeaveResultPayload {
    return parseLeavePayload(leaveResultPayloadSchema, payload, "LEAVE_RESULT");
}

export function parseLeaveCancelledPayload(
    payload: unknown,
): LeaveCancelledPayload {
    return parseLeavePayload(
        leaveCancelledPayloadSchema,
        payload,
        "LEAVE_CANCELLED",
    );
}

export function parseLeaveCancellationRequestedPayload(
    payload: unknown,
): LeaveCancellationRequestedPayload {
    return parseLeavePayload(
        leaveCancellationRequestedPayloadSchema,
        payload,
        "LEAVE_CANCELLATION_REQUESTED",
    );
}

export function parseLeaveCancelledAfterApprovalPayload(
    payload: unknown,
): LeaveCancelledAfterApprovalPayload {
    return parseLeavePayload(
        leaveCancelledAfterApprovalPayloadSchema,
        normalizeLegacyDecisionActorPayload(payload),
        "LEAVE_CANCELLED_AFTER_APPROVAL",
    );
}

export function parseLeaveNotTakenRequestedPayload(
    payload: unknown,
): LeaveNotTakenRequestedPayload {
    return parseLeavePayload(
        leaveNotTakenRequestedPayloadSchema,
        payload,
        "LEAVE_NOT_TAKEN_REQUESTED",
    );
}

export function parseLeaveNotTakenConfirmedPayload(
    payload: unknown,
): LeaveNotTakenConfirmedPayload {
    return parseLeavePayload(
        leaveNotTakenConfirmedPayloadSchema,
        normalizeLegacyDecisionActorPayload(payload),
        "LEAVE_NOT_TAKEN_CONFIRMED",
    );
}

export function parseLeaveActionLinePayload(
    payload: unknown,
): LeaveActionLinePayload {
    return parseLeavePayload(
        leaveActionLinePayloadSchema,
        payload,
        "LEAVE_ACTION_LINE",
    );
}

export function parseLeaveResultLinePayload(
    payload: unknown,
): LeaveResultLinePayload {
    return parseLeavePayload(
        leaveResultLinePayloadSchema,
        payload,
        "LEAVE_RESULT_LINE",
    );
}

export function parseLeaveCancelledLinePayload(
    payload: unknown,
): LeaveCancelledLinePayload {
    return parseLeavePayload(
        leaveCancelledLinePayloadSchema,
        payload,
        "LEAVE_CANCELLED_LINE",
    );
}

export function parseLeaveCancellationRequestedLinePayload(
    payload: unknown,
): LeaveCancellationRequestedLinePayload {
    return parseLeavePayload(
        leaveCancellationRequestedLinePayloadSchema,
        payload,
        "LEAVE_CANCELLATION_REQUESTED_LINE",
    );
}

export function parseLeaveCancelledAfterApprovalLinePayload(
    payload: unknown,
): LeaveCancelledAfterApprovalLinePayload {
    return parseLeavePayload(
        leaveCancelledAfterApprovalLinePayloadSchema,
        normalizeLegacyDecisionActorPayload(payload),
        "LEAVE_CANCELLED_AFTER_APPROVAL_LINE",
    );
}

export function parseLeaveNotTakenRequestedLinePayload(
    payload: unknown,
): LeaveNotTakenRequestedLinePayload {
    return parseLeavePayload(
        leaveNotTakenRequestedLinePayloadSchema,
        payload,
        "LEAVE_NOT_TAKEN_REQUESTED_LINE",
    );
}

export function parseLeaveNotTakenConfirmedLinePayload(
    payload: unknown,
): LeaveNotTakenConfirmedLinePayload {
    return parseLeavePayload(
        leaveNotTakenConfirmedLinePayloadSchema,
        normalizeLegacyDecisionActorPayload(payload),
        "LEAVE_NOT_TAKEN_CONFIRMED_LINE",
    );
}
