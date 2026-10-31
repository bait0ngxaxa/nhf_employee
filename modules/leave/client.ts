"use client";

export { HolidayCalendarPage } from "./presentation/calendar/HolidayCalendarPage";

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
export type { LeavePresentationCapabilities } from "./application/types";
