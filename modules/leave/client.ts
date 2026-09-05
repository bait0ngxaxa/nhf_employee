"use client";

export { LeaveManagementSection } from "./presentation/dashboard/LeaveManagementSection";
export { LeaveManagementSectionSkeleton } from "./presentation/dashboard/LeaveSkeletons";
export { LiffLeaveApp } from "./presentation/liff/LiffLeaveApp";

// These client-safe contracts are retained only for external compatibility
// facades; presentation internals import their owning files directly.
export { getBusinessDate, toDateOnlyString } from "./domain/business-date";
export {
    daysToHalfDays,
    halfDaysToDays,
    signedHalfDaysToDays,
    toLeaveQuotaDays,
    toLeaveRequestDays,
} from "./domain/half-days";
export {
    calculateCarryBalanceForNextYear,
    calculateClosingBalanceHalfDays,
    calculateEffectiveEntitlementHalfDays,
    calculateOpeningCarryBalanceHalfDays,
    calculateRemainingBalanceHalfDays,
} from "./domain/quota-accounting";
export { calculateAdditionalOverQuotaDays } from "./domain/over-quota";
export { getCurrentLeaveYear, getLeaveYearFromDateValue } from "./domain/quota-year";
export {
    getCalendarDaysAgo,
    getStartOfDay,
    getWorkingDays,
    isAfterLeaveEnd,
    isBeforeLeaveStart,
    isPastDate,
    isWithinEmergencyBackdateWindow,
    isWorkingDay,
} from "./domain/utils";
export { getApproverLeaveActions, getEmployeeLeaveActions } from "./domain/action-availability";
export { leaveRequestSchema } from "./schemas/leave";
export type { LeaveRequestValues } from "./schemas/leave";
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
export {
    buildApproverLeaveHistoryFilterWhere,
    buildEmployeeLeaveHistoryFilterWhere,
    createLeaveHistoryYearRange,
    getAvailableLeaveHistoryYears,
    parseApproverLeaveHistoryFilters,
    parseEmployeeLeaveHistoryFilters,
} from "./application/queries/history-filters";
export { LEAVE_ATTACHMENT_MAX_BYTES } from "./infrastructure/attachments/constants";
