// Route-facing schemas and validation errors.
export {
    leaveActionSchema,
    leaveAttachmentIdParamSchema,
    leaveCancelSchema,
    leaveCancellationDecisionSchema,
    leaveRequestIdParamSchema,
} from "./schemas/leave";
export { leaveApproverAssignmentsSchema } from "./schemas/approvers";
export {
    DEFAULT_LEAVE_REPORT_SCOPE,
    leaveReportScopeSchema,
} from "./schemas/report";
export { LeaveAttachmentValidationError } from "./schemas/attachments";

// Route-facing application use cases, queries, and errors.
export {
    createLeaveRequest,
    LeaveRequestError,
} from "./application/requests/create-request";
export type {
    CreateLeaveRequestInput,
    CreatedLeaveRequestResult,
} from "./application/requests/create-request";
export {
    createLeaveRequestHash,
    isLeaveRequestIdempotencyConflict,
    LEAVE_REQUEST_IDEMPOTENCY_CONFLICT_CODE,
    LeaveRequestIdempotencyConflictError,
} from "./application/requests/idempotency";
export { assertLeaveRequestBodySize } from "./application/requests/request-input";
export {
    LeaveApprovalError,
    decideLeaveRequest,
} from "./application/approvals/decision";
export {
    getActionableLeaveApprovalWhere,
    getApproverHistoryReportWhere,
    getAssignedLeaveApproverWhere,
    parseLeaveApprovalPage,
} from "./application/approvals/approval-queries";
export type {
    LeaveApprovalPaginationMetadata,
} from "./application/approvals/approval-queries";
export { getLeaveApprovalList } from "./application/approvals/approval-list";
export {
    ApproverAssignmentError,
    assignLeaveApprovers,
} from "./application/approvals/approver-assignment";
export { getLeaveApproverEmployees } from "./application/approvals/approver-queries";
export {
    dispatchCurrentLeaveAction,
} from "./application/approvals/current-action-recipient";
export {
    LeaveCancellationError,
    cancelLeaveRequest,
    confirmLeaveCancellation,
    rejectLeaveCancellation,
} from "./application/cancellation/cancellation";
export {
    getAuthorizedLeaveAttachment,
    getAuthorizedLeaveAttachmentForViewer,
    getAuthorizedLeaveDetail,
    getEmployeeLeaveProfile,
    getEmployeeIdFromUserId,
} from "./application/queries";
export { getAdminLeaveRecoveryData } from "./application/recovery";
export {
    parseApproverLeaveHistoryFilters,
    parseEmployeeLeaveHistoryFilters,
} from "./application/queries/history-filters";

// HTTP adapters and response serializers used by the existing route families.
export {
    enforceLeaveJsonBodySize,
    readLeaveJsonBody,
    LEAVE_JSON_MUTATION_MAX_BYTES,
} from "./server/http";
export {
    createLeaveRequestErrorResponse,
    handleLeaveRequestSubmission,
} from "./server/request-api";
export {
    handleLeaveNotTakenConfirmation,
    handleLeaveNotTakenRequest,
} from "./server/not-taken-api";
export {
    toLiffEmployeeLeaveRequest,
    toLiffLeaveApprovalItem,
    toLiffLeaveMutationResponse,
    toLiffLeaveQuota,
    toLiffLeaveRequestDetail,
} from "./server/liff-serialization";

// Report and attachment delivery contracts. Implementations remain private.
export {
    createLeaveReportXlsxResponse,
    getLeaveReportMeta,
    getLeaveReportYears,
} from "./infrastructure/reports/report-export";
export { cleanupOrphanedLeaveAttachments } from "./infrastructure/attachments/cleanup-orphans";
export { readLeaveAttachment } from "./infrastructure/attachments/storage";

// Notification/outbox dispatch contracts consumed by platform delivery.
export {
    sendLeaveCancellationRequestedNotifications,
    sendLeaveCancelledAfterApprovalNotifications,
    sendLeaveCancelledNotifications,
    sendLeaveNotTakenConfirmedNotifications,
    sendLeaveNotTakenRequestedNotifications,
    sendLeaveResultNotifications,
} from "./application/notifications/notifications";
export {
    buildLeaveActionDeliveryIdentity,
    parseLeaveActionPayload,
    parseLeaveCancellationRequestedPayload,
    parseLeaveCancelledAfterApprovalPayload,
    parseLeaveCancelledPayload,
    parseLeaveNotTakenConfirmedPayload,
    parseLeaveNotTakenRequestedPayload,
    parseLeaveResultPayload,
} from "./application/notifications/notification-payloads";
export type {
    LeaveActionPayload,
    LeaveCancellationRequestedPayload,
    LeaveCancelledAfterApprovalPayload,
    LeaveCancelledPayload,
    LeaveNotTakenConfirmedPayload,
    LeaveNotTakenRequestedPayload,
    LeaveResultPayload,
} from "./application/notifications/notification-payloads";
export {
    sendLeaveActionNotification,
    sendLeaveCancellationRequestedNotification,
    sendLeaveCancelledAfterApprovalNotification,
    sendLeaveCancelledNotification,
    sendLeaveNotTakenConfirmedNotification,
    sendLeaveNotTakenRequestedNotification,
    sendLeaveResultNotification,
} from "./infrastructure/notifications/email";
export {
    dispatchLeaveLineOutbox,
    enqueueLeaveLineNotification,
} from "./infrastructure/notifications/line";
export {
    buildLeaveLiffRequestUrl,
    buildLeaveLiffUrl,
} from "./infrastructure/notifications/links";
export type { LeaveLiffAction } from "./infrastructure/notifications/links";

// Public Leave domain contracts required by server/platform consumers.
export { getCurrentLeaveYear } from "./domain/quota-year";
export {
    getApproverLeaveActions,
    getEmployeeLeaveActions,
} from "./domain/action-availability";
export { toLeaveRequestDays } from "./domain/half-days";
export {
    formatLeaveDateRange,
    formatLeaveDurationDays,
    getLeavePeriodLabel,
    getLeaveTypeLabel,
} from "./application/notifications/notification-format";
export type { LeavePeriodValue } from "./domain/utils";
export type {
    LeaveApprovalItem,
    LeaveTypeValue,
} from "./presentation/types";
