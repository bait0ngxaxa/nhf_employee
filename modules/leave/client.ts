"use client";

export { LeaveManagementSection } from "./presentation/dashboard/LeaveManagementSection";
export { LeaveManagementSectionSkeleton } from "./presentation/dashboard/LeaveSkeletons";
export { LiffLeaveApp } from "./presentation/liff/LiffLeaveApp";

// Client-safe formatting contract used by generic audit presentation.
export {
    formatLeaveDateRange,
    formatLeaveDurationDays,
    getLeavePeriodLabel,
    getLeaveTypeLabel,
} from "./application/notifications/notification-format";
export type {
    LeaveTypeValue,
} from "./application/notifications/notification-format";
export type { LeavePeriodValue } from "./domain/utils";
