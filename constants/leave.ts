import type { LeaveType } from "@prisma/client";

/** Default annual leave quotas per type (SSOT) */
export const DEFAULT_LEAVE_QUOTAS: Record<LeaveType, number> = {
    SICK: 30,
    PERSONAL: 10,
    VACATION: 6,
} as const;

export const ALL_LEAVE_TYPES: LeaveType[] = ["SICK", "PERSONAL", "VACATION"];
