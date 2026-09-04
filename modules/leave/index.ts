export {
    ALL_LEAVE_TYPES,
    ALL_LEAVE_STATUSES,
    APPROVER_LEAVE_HISTORY_STATUSES,
    DEFAULT_LEAVE_QUOTAS,
    DEFAULT_LEAVE_QUOTA_HALF_DAYS,
} from "./domain/constants";
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
    calculateAdditionalOverQuotaDays,
    calculateAdditionalOverQuotaHalfDays,
} from "./domain/over-quota";
export {
    calculateCarryBalanceForNextYear,
    calculateClosingBalanceHalfDays,
    calculateEffectiveEntitlementHalfDays,
    calculateOpeningCarryBalanceHalfDays,
    calculateRemainingBalanceHalfDays,
    isCarryForwardLeaveType,
} from "./domain/quota-accounting";
export {
    calculateEffectiveEntitlementForYearHalfDays,
    ensureLeaveQuotaForYear,
    ensureLeaveQuotasForYear,
    reconcileLeaveQuotaForward,
} from "./domain/quota-entitlement";
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
    ACTIVE_LEAVE_APPROVER_QUERY_WHERE,
    ACTIVE_LEAVE_APPROVER_USER_SELECT,
    ACTIVE_LEAVE_EMPLOYEE_QUERY_WHERE,
    isActiveLeaveApprover,
    isUsableLeaveEmail,
} from "./domain/approver-eligibility";
export { INITIAL_LEAVE_APPROVAL_ACTION_VERSION } from "./domain/approval-action-version";
export type { BusinessDateInput, LeavePeriodValue } from "./domain/utils";
export type {
    LeaveApproverState,
} from "./domain/approver-eligibility";

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
export {
    leaveApproverAssignmentsSchema,
} from "./schemas/approvers";
export type { LeaveApproverAssignments } from "./schemas/approvers";
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
    createLeaveRequest,
    LeaveRequestError,
} from "./application/requests/create-request";
export type {
    CreateLeaveRequestInput,
    CreatedLeaveRequestResult,
} from "./application/requests/create-request";
export {
    assertMatchingLeaveRequestHash,
    createLeaveRequestHash,
    isLeaveRequestIdempotencyConflict,
    LEAVE_REQUEST_IDEMPOTENCY_CONFLICT_CODE,
    LeaveRequestIdempotencyConflictError,
} from "./application/requests/idempotency";
export {
    LeaveRequestInputError,
    assertLeaveRequestBodySize,
    parseLeaveRequestInput,
} from "./application/requests/request-input";
export type {
    LeaveRequestInputError as LeaveRequestInputErrorType,
    ParsedLeaveRequestInput,
} from "./application/requests/request-input";

export {
    LeaveApprovalError,
    decideLeaveRequest,
} from "./application/approvals/decision";
export type { LeaveDecisionActor } from "./application/approvals/decision";
export {
    getActionableLeaveApprovalWhere,
    getAdminLeaveRecoveryCandidateWhere,
    getAssignedLeaveApproverWhere,
    getApproverHistoryReportWhere,
    LEAVE_APPROVALS_PAGE_SIZE,
    LEAVE_APPROVAL_REQUEST_INCLUDE,
    LEAVE_REPORT_STATUSES,
    parseLeaveApprovalPage,
    createLeaveApprovalMetadata,
} from "./application/approvals/approval-queries";
export type {
    LeaveApprovalPageKey,
    LeaveApprovalPaginationMetadata,
} from "./application/approvals/approval-queries";
export {
    getLeaveApprovalList,
} from "./application/approvals/approval-list";
export type {
    LeaveApprovalListData,
    LeaveApprovalListQuery,
    SerializedLeaveApprovalRequest,
} from "./application/approvals/approval-list";
export {
    ApproverAssignmentError,
    assignLeaveApprovers,
} from "./application/approvals/approver-assignment";
export type {
    ApproverAssignment,
    ApproverAssignmentActor,
} from "./application/approvals/approver-assignment";
export { getLeaveApproverEmployees } from "./application/approvals/approver-queries";
export type { LeaveApproverEmployee } from "./application/approvals/approver-queries";
export {
    dispatchCurrentLeaveAction,
    resolveCurrentLeaveAction,
} from "./application/approvals/current-action-recipient";
export {
    resolveCurrentLeaveCancellationAction,
    resolveCurrentLeaveNotTakenAction,
} from "./application/approvals/current-action-validation";
export {
    getLeaveDecisionAuthorization,
    getEffectiveLeaveApprover,
    getEffectiveLeaveApproverId,
    normalizeLeaveRecoveryReason,
    persistLeaveExceptionApprover,
    resolveLeaveExceptionApprover,
} from "./application/approvals/exception-approver";
export type {
    ExceptionApprover,
    LeaveDecisionAuthorization,
    LeaveExceptionApproverResolution,
    LeaveExceptionApproverSource,
} from "./application/approvals/exception-approver";

export {
    LEAVE_CANCELLATION_MESSAGES,
    LeaveCancellationError,
    cancelLeaveRequest,
    confirmLeaveCancellation,
    rejectLeaveCancellation,
} from "./application/cancellation/cancellation";
export type {
    CancellationDecisionActor,
    LeaveCancellationResult,
} from "./application/cancellation/cancellation";

export {
    isActiveEmployeeInTransaction,
    isEmployeeInTransaction,
    getEmployeeIdFromUserId,
    getAuthorizedLeaveAttachment,
    getAuthorizedLeaveAttachmentForViewer,
    getAuthorizedLeaveDetail,
    getEmployeeLeaveProfile,
} from "./application/queries";
export type {
    AuthorizedLeaveAttachment,
    AuthorizedLeaveDetail,
    LeaveAttachmentViewer,
    EmployeeLeaveProfileData,
    EmployeeLeaveProfileQuery,
} from "./application/queries";
export { getAdminLeaveRecoveryData } from "./application/recovery";
export type {
    LeaveAdminRecoveryData,
    LeaveAdminRecoveryQuery,
    SerializedLeaveRecoveryRequest,
} from "./application/recovery";
export {
    parseEmployeeLeaveHistoryFilters,
    parseApproverLeaveHistoryFilters,
    parseLeaveHistoryFilters,
    buildEmployeeLeaveHistoryFilterWhere,
    buildApproverLeaveHistoryFilterWhere,
    createLeaveHistoryYearRange,
    getAvailableLeaveHistoryYears,
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
    leaveAttachmentSummaryOrderBy,
    leaveAttachmentSummarySelect,
    toLeaveAttachmentSummary,
    withLeaveAttachmentSummaries,
} from "./application/queries/attachment-summary";
export type { LeaveAttachmentUrlBuilder } from "./application/queries/attachment-summary";

export {
    enforceLeaveJsonBodySize,
    readLeaveJsonBody,
    LEAVE_JSON_MUTATION_MAX_BYTES,
} from "./server/http";
export {
    handleLeaveRequestSubmission,
    createLeaveRequestErrorResponse,
} from "./server/request-api";
export type {
    LeaveRequestActor,
    LeaveRequestResponseSerializer,
} from "./server/request-api";
export {
    handleLeaveNotTakenRequest,
    handleLeaveNotTakenConfirmation,
} from "./server/not-taken-api";
export type { LeaveNotTakenApiActor } from "./server/not-taken-api";
export {
    toLiffLeaveApprovalItem,
    toLiffEmployeeLeaveRequest,
    toLiffLeaveMutationResponse,
    toLiffLeaveQuota,
    toLiffLeaveRequestDetail,
} from "./server/liff-serialization";
export type { LiffLeaveMutationResponse } from "./server/liff-serialization";

export {
    getLeaveReportYears,
    getApproverHistoryReportYears,
    getCurrentTeamReportYears,
    getLeaveReportMeta,
    createLeaveReportXlsxResponse,
    getApproverHistoryReportMeta,
    getCurrentTeamReportMeta,
    loadCurrentTeamReportEmployees,
    loadApproverHistoryReportEmployees,
} from "./infrastructure/reports/report-export";
export type { LeaveReportMeta } from "./infrastructure/reports/report-export";
export { buildLeaveReportRows } from "./infrastructure/reports/report-model";
export { createLeaveReportWorkbook } from "./infrastructure/reports/report-workbook";
export type {
    LeaveDetailRow,
    LeaveReportEmployee,
    LeaveReportQuota,
    LeaveReportRequest,
    LeaveReportRows,
    LeaveSummaryRow,
} from "./infrastructure/reports/report-types";

export {
    createLeaveAttachmentStorage,
    deleteLeaveAttachment,
    readLeaveAttachment,
    saveLeaveAttachments,
} from "./infrastructure/attachments/storage";
export type {
    LeaveAttachmentSource,
    LeaveAttachmentStorageService,
    StoredLeaveAttachment,
} from "./infrastructure/attachments/storage";
export {
    cleanupOrphanedLeaveAttachments,
} from "./infrastructure/attachments/cleanup-orphans";
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

export {
    createLeaveActionInAppNotification,
    sendLeaveActionNotifications,
    sendLeaveResultNotifications,
    sendLeaveCancelledNotifications,
    sendLeaveCancellationRequestedNotifications,
    sendLeaveCancelledAfterApprovalNotifications,
    sendLeaveNotTakenRequestedNotifications,
    sendLeaveNotTakenConfirmedNotifications,
} from "./application/notifications/notifications";
export {
    parseLeaveActionPayload,
    parseLeaveResultPayload,
    parseLeaveCancelledPayload,
    parseLeaveCancellationRequestedPayload,
    parseLeaveCancelledAfterApprovalPayload,
    parseLeaveNotTakenRequestedPayload,
    parseLeaveNotTakenConfirmedPayload,
    parseLeaveActionLinePayload,
    parseLeaveResultLinePayload,
    parseLeaveCancelledLinePayload,
    parseLeaveCancellationRequestedLinePayload,
    parseLeaveCancelledAfterApprovalLinePayload,
    parseLeaveNotTakenRequestedLinePayload,
    parseLeaveNotTakenConfirmedLinePayload,
    buildLeaveRecipientSnapshot,
    buildConfiguredApproverSnapshot,
    buildLeaveActionDeliveryIdentity,
    buildLegacyLeaveActionDeliveryIdentity,
    getLeaveActionDeliveryIdentity,
} from "./application/notifications/notification-payloads";
export type {
    LeaveActionPayload,
    LeaveActionLinePayload,
    LeaveCancelledPayload,
    LeaveCancelledLinePayload,
    LeaveCancelledAfterApprovalPayload,
    LeaveCancelledAfterApprovalLinePayload,
    LeaveCancellationRequestedPayload,
    LeaveCancellationRequestedLinePayload,
    LeaveNotTakenRequestedPayload,
    LeaveNotTakenRequestedLinePayload,
    LeaveNotTakenConfirmedPayload,
    LeaveNotTakenConfirmedLinePayload,
    LeaveNotificationPayload,
    LeaveNotificationRecipient,
    LeaveConfiguredApprover,
    LeaveResultPayload,
    LeaveResultLinePayload,
} from "./application/notifications/notification-payloads";
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
export {
    sendLeaveActionNotification,
    sendLeaveResultNotification,
    sendLeaveCancelledNotification,
    sendLeaveCancellationRequestedNotification,
    sendLeaveCancelledAfterApprovalNotification,
    sendLeaveNotTakenRequestedNotification,
    sendLeaveNotTakenConfirmedNotification,
} from "./infrastructure/notifications/email";
export {
    generateLeaveActionEmailHTML,
} from "./infrastructure/notifications/email-templates/leave-action";
export { generateLeaveEventEmailHTML } from "./infrastructure/notifications/email-templates/leave-event";
export { generateLeaveResultEmailHTML } from "./infrastructure/notifications/email-templates/leave-result";
export {
    generateLeaveActionFlexMessage,
    generateLeaveResultFlexMessage,
    generateLeaveCancelledFlexMessage,
    generateLeaveCancellationRequestedFlexMessage,
    generateLeaveCancelledAfterApprovalFlexMessage,
    generateLeaveNotTakenRequestedFlexMessage,
    generateLeaveNotTakenConfirmedFlexMessage,
} from "./infrastructure/notifications/line-flex";
export {
    LEAVE_LINE_OUTBOX_TYPES,
    buildLeaveLineEventKey,
    dispatchLeaveLineOutbox,
    enqueueLeaveLineNotification,
    isLeaveLineOutboxType,
} from "./infrastructure/notifications/line";
export type {
    LeaveLineEnqueueInput,
    LeaveLineOutboxType,
} from "./infrastructure/notifications/line";
export {
    buildLeaveLiffRequestUrl,
    buildLeaveLiffUrl,
} from "./infrastructure/notifications/links";
export type { LeaveLiffAction } from "./infrastructure/notifications/links";

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
    LeavePeriodValue as SerializedLeavePeriodValue,
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
