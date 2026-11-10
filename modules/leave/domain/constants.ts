import type { LeaveStatus, LeaveType } from "@prisma/client";
import { daysToHalfDays } from "@/modules/leave/domain/half-days";

/** Default annual leave quotas per type (SSOT) */
export const DEFAULT_LEAVE_QUOTAS: Record<LeaveType, number> = {
    SICK: 30,
    PERSONAL: 10,
    VACATION: 6,
} as const;

/** Default annual leave quotas in persisted half-day units. */
export const DEFAULT_LEAVE_QUOTA_HALF_DAYS: Record<LeaveType, number> = {
    SICK: daysToHalfDays(DEFAULT_LEAVE_QUOTAS.SICK),
    PERSONAL: daysToHalfDays(DEFAULT_LEAVE_QUOTAS.PERSONAL),
    VACATION: daysToHalfDays(DEFAULT_LEAVE_QUOTAS.VACATION),
} as const;

/**
 * Leave approver assignments: owner-chosen ceiling of one assignment per
 * employee (duplicate employeeIds are already rejected), i.e. the largest
 * workforce a single approver save supports. Enforced by
 * leaveApproverAssignmentsSchema.
 *
 * Coupled to LEAVE_APPROVERS_JSON_MAX_REQUEST_BYTES in
 * lib/ssot/request-limits.ts, which is sized for this many assignments.
 * lib/ssot cannot import this module (Leave already imports lib/ssot, and
 * lib/ssot is reachable from client code), so the derivation is proven by
 * __tests__/lib/request-limits.test.ts: raising this cap without raising the
 * byte limit fails CI.
 */
export const LEAVE_APPROVER_ASSIGNMENTS_MAX = 5000;

export const ALL_LEAVE_TYPES = ["SICK", "PERSONAL", "VACATION"] as const satisfies readonly LeaveType[];

export const ALL_LEAVE_STATUSES = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
    "NOT_TAKEN",
    "CANCELLATION_REQUESTED",
    "CANCELLED_AFTER_APPROVAL",
] as const satisfies readonly LeaveStatus[];

export const APPROVER_LEAVE_HISTORY_STATUSES = [
    "APPROVED",
    "REJECTED",
    "NOT_TAKEN",
    "CANCELLED_AFTER_APPROVAL",
] as const satisfies readonly LeaveStatus[];
