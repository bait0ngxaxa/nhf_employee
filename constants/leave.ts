import type { LeaveType } from "@prisma/client";
import { daysToHalfDays } from "@/lib/services/leave/half-days";

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

export const ALL_LEAVE_TYPES: LeaveType[] = ["SICK", "PERSONAL", "VACATION"];
