"use client";

export {
    LEAVE_BUSINESS_TIME_ZONE,
    addCalendarDays,
    compareBusinessDates,
    getBusinessDate,
    getBusinessDayOfWeek,
    getCalendarDaysDifference,
    isValidDateOnly,
    parseDateOnly,
    toDateOnlyString,
    toUtcDate,
} from "./domain/business-date";
export {
    HALF_DAYS_PER_DAY,
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
    isCarryForwardLeaveType,
} from "./domain/quota-accounting";
export {
    ALL_LEAVE_TYPES,
    ALL_LEAVE_STATUSES,
    APPROVER_LEAVE_HISTORY_STATUSES,
} from "./domain/constants";
export {
    calculateAdditionalOverQuotaDays,
    calculateAdditionalOverQuotaHalfDays,
} from "./domain/over-quota";
export {
    getCurrentLeaveYear,
    getLeaveYearFromDateValue,
} from "./domain/quota-year";
export {
    EMERGENCY_BACKDATE_LIMIT_DAYS,
    calculateLeaveDuration,
    calculateLeaveDurationHalfDays,
    getCalendarDaysAgo,
    getStartOfDay,
    getWorkingDays,
    isAfterLeaveEnd,
    isBeforeLeaveStart,
    isPastDate,
    isWithinEmergencyBackdateWindow,
    isWorkingDay,
} from "./domain/utils";
export {
    getApproverLeaveActions,
    getEmployeeLeaveActions,
} from "./domain/action-availability";
export {
    leaveActionSchema,
    leaveAttachmentIdParamSchema,
    leaveCancelSchema,
    leaveCancellationDecisionSchema,
    leaveNotTakenConfirmSchema,
    leaveNotTakenRequestSchema,
    leaveRequestIdParamSchema,
    leaveRequestSchema,
} from "./schemas/leave";
export type {
    LeaveActionValues,
    LeaveCancelValues,
    LeaveCancellationDecisionValues,
    LeaveNotTakenConfirmValues,
    LeaveNotTakenRequestValues,
    LeaveRequestValues,
} from "./schemas/leave";
export {
    LeaveAttachmentValidationError,
    validateLeaveAttachments,
} from "./schemas/attachments";
export type { LeaveAttachmentMetadata } from "./schemas/attachments";
export {
    DEFAULT_LEAVE_REPORT_SCOPE,
    LEAVE_REPORT_SCOPES,
    leaveReportScopeSchema,
} from "./schemas/report";
export type { LeaveReportScope } from "./schemas/report";
export {
    buildApproverLeaveHistoryFilterWhere,
    buildEmployeeLeaveHistoryFilterWhere,
    createLeaveHistoryYearRange,
    getAvailableLeaveHistoryYears,
    parseApproverLeaveHistoryFilters,
    parseEmployeeLeaveHistoryFilters,
    parseLeaveHistoryFilters,
    hasLeaveHistoryFilters,
    LEAVE_HISTORY_MAX_YEAR,
    LEAVE_HISTORY_MIN_YEAR,
    LEAVE_HISTORY_QUERY_MAX_LENGTH,
} from "./application/queries/history-filters";
export type {
    LeaveHistoryFilters,
    LeaveHistoryFiltersParseResult,
    LeaveHistoryMetadata,
} from "./application/queries/history-filters";
export {
    formatLeaveDate,
    formatLeaveDateRange,
    formatLeaveDecisionActor,
    formatLeaveDurationDays,
    formatLeaveFlagSummary,
    formatLeaveSummary,
    getLeaveFlagLabels,
    getLeavePeriodLabel,
    getLeaveTypeLabel,
} from "./application/notifications/notification-format";
export type {
    LeaveDecisionActorInput,
    LeaveSummaryInput,
} from "./application/notifications/notification-format";
export type {
    LeaveAttachmentSummary,
    LeaveApprovalItem,
    LeaveApproverSummary,
    LeaveEmployeeSummary,
    LeaveHistoryMetadata as SerializedLeaveHistoryMetadata,
    LeavePaginationMetadata,
    LeaveQuotaSummary,
    LeaveRequestSummary,
    LeaveTypeValue,
    LeavePeriodValue,
    LeaveStatusValue,
    EmployeeLeaveAction,
    ApproverLeaveAction,
    LiffLeaveApprovalItem,
    LiffLeaveApprovalsResponse,
    LiffLeaveQuotaSummary,
    LiffLeaveRequestDetail,
    LiffEmployeeLeaveRequest,
    LiffLeaveProfileResponse,
} from "./presentation/types";
export {
    LEAVE_ATTACHMENT_ACCEPTED_FORMATS,
    LEAVE_ATTACHMENT_ACCEPTED_TYPES,
    LEAVE_ATTACHMENT_MAX_BYTES,
    LEAVE_ATTACHMENT_MAX_FILES,
    LEAVE_ATTACHMENT_MAX_HEIGHT,
    LEAVE_ATTACHMENT_MAX_INPUT_PIXELS,
    LEAVE_ATTACHMENT_MAX_MB,
    LEAVE_ATTACHMENT_MAX_REQUEST_BYTES,
    LEAVE_ATTACHMENT_MAX_TOTAL_BYTES,
    LEAVE_ATTACHMENT_MAX_TOTAL_MB,
    LEAVE_ATTACHMENT_MAX_WIDTH,
    LEAVE_ATTACHMENT_ORPHAN_SAFETY_WINDOW_MS,
    LEAVE_ATTACHMENT_WEBP_QUALITY,
} from "./infrastructure/attachments/constants";
