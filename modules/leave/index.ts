// Route-facing schemas and validation errors.
export {
    leaveActionSchema,
    leaveAttachmentIdParamSchema,
    leaveCancelSchema,
    leaveCancellationDecisionSchema,
    leaveRequestIdParamSchema,
} from "./schemas/leave";
export { leaveApproverAssignmentsSchema } from "./schemas/approvers";
export { leaveReportScopeSchema } from "./schemas/report";

// Route-facing application use cases, queries, and errors.
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
    parseLeaveActionPayload,
    parseLeaveCancellationRequestedPayload,
    parseLeaveCancelledAfterApprovalPayload,
    parseLeaveCancelledPayload,
    parseLeaveNotTakenConfirmedPayload,
    parseLeaveNotTakenRequestedPayload,
    parseLeaveResultPayload,
} from "./application/notifications/notification-payloads";
export {
    dispatchLeaveLineOutbox,
    enqueueLeaveLineNotification,
} from "./infrastructure/notifications/line";

// Public Leave domain contracts required by server/platform consumers.
export { getCurrentLeaveYear } from "./domain/quota-year";
export {
    getApproverLeaveActions,
    getEmployeeLeaveActions,
} from "./domain/action-availability";
export { toLeaveRequestDays } from "./domain/half-days";
