export {
    assertITCapability,
    buildITAuthorizationActor,
    buildITAuthorizationContext,
    getITPresentationCapabilities,
    isITTicketResourceInScope,
    ITCapabilityDeniedError,
    IT_CAPABILITIES,
    resolveITCapability,
    resolveITCapabilityInTransaction,
} from "./application/authorization";
export { buildCurrentITAuthorizationContext } from "./application/workforce";
export { dispatchITTicketNotificationOutbox } from "./application/notifications/dispatch";
export type {
    ITAuthorizationActor,
    ITAuthorizationContext,
    ITCapability,
    ITCapabilityAuthorization,
} from "./application/authorization";
export { evaluateITAssigneeEligibility } from "./application/assignee-eligibility";
export {
    assignITTicketBodySchema,
    createITTicketInputSchema,
    setITTicketCategoryBodySchema,
    transitionITTicketStatusBodySchema,
} from "./application/ticket-schemas";
export {
    assignITTicket,
    createITTicket,
    setITTicketCategory,
    transitionITTicketStatus,
} from "./application/ticket-commands";
export {
    getITOperatorReferenceData,
    getITOperatorTicket,
    getITRequesterTicket,
    IT_OPERATOR_QUEUE_DEFAULT_LIMIT,
    IT_OPERATOR_QUEUE_MAX_LIMIT,
    IT_TICKET_LIST_DEFAULT_LIMIT,
    IT_TICKET_LIST_DEFAULT_PAGE,
    IT_TICKET_LIST_MAX_LIMIT,
    listITRequesterTickets,
    listITRequesterTicketsInputSchema,
    listITOperatorTickets,
} from "./application/ticket-queries";
export {
    getITOperatorTicketTimeline,
    getITRequesterTicketTimeline,
} from "./application/ticket-timeline-queries";
export {
    postITOperatorTicketComment,
    postITRequesterTicketComment,
} from "./application/ticket-comment-commands";
export { getITTicketAttachmentForDownload } from "./application/ticket-attachment-queries";
export {
    getITAnalyticsDashboard,
    ITAnalyticsInputValidationError,
    parseITAnalyticsPeriod,
} from "./application/analytics";
export type { ITAnalyticsPeriod } from "./contracts";
export { cleanupOrphanedITTicketAttachments } from "./infrastructure/attachments/cleanup-orphans";
export { readITTicketAttachment } from "./infrastructure/attachments/storage";
export { ITTicketAttachmentValidationError } from "./infrastructure/attachments/validation";
export type { ITTicketAttachmentSource } from "./infrastructure/attachments/validation";
export {
    createITTicketCommentBodySchema,
    createITTicketCommentInputSchema,
} from "./application/ticket-schemas";
export {
    IT_TICKET_COMMENTABLE_STATUSES,
    IT_TICKET_COMMENT_MAX_LENGTH,
    IT_TICKET_ATTACHMENT_ACCEPTED_TYPES,
    IT_TICKET_ATTACHMENT_MAX_BYTES,
    IT_TICKET_ATTACHMENT_MAX_FILES,
    IT_TICKET_ATTACHMENT_MAX_HEIGHT,
    IT_TICKET_ATTACHMENT_MAX_INPUT_PIXELS,
    IT_TICKET_ATTACHMENT_MAX_REQUEST_BYTES,
    IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES,
    IT_TICKET_ATTACHMENT_MAX_WIDTH,
    IT_TICKET_ATTACHMENT_ORPHAN_SAFETY_WINDOW_MS,
    IT_TICKET_ATTACHMENT_WEBP_QUALITY,
    IT_TICKET_DATABASE_INT_MAX,
    IT_TICKET_DESCRIPTION_MAX_LENGTH,
    IT_TICKET_TIMELINE_DEFAULT_LIMIT,
    IT_TICKET_TIMELINE_MAX_LIMIT,
    IT_TICKET_TITLE_MAX_LENGTH,
} from "./contracts";
export { toITOperatorTicket, toITRequesterTicket } from "./application/ticket-dto";
export {
    ITTicketAssigneeNotEligibleError,
    ITTicketCategoryInactiveError,
    ITTicketCategoryNotFoundError,
    ITTicketError,
    ITTicketIdempotencyConflictError,
    ITTicketInputValidationError,
    ITTicketInvalidTransitionError,
    ITTicketMutationConflictError,
    ITTicketNotCommentableError,
    ITTicketNotFoundError,
    ITWorkforceDeniedError,
} from "./application/ticket-errors";
export { isAllowedITTicketTransition } from "./domain/ticket-workflow";
export { getAllowedITTicketTransitions } from "./domain/ticket-workflow";
export {
    createITTicketCommentRequestHash,
    isITTicketCommentableStatus,
} from "./domain/ticket-conversation";
export {
    ITTicketCommentKind,
    ITTicketEventKind,
    ITTicketStatus,
    ITTicketType,
} from "@prisma/client";
export type {
    ITAssigneeEligibilityEvidence,
    ITPresentationCapabilities,
    ITTicketResourceScope,
} from "./application/types";
export type { ITAnalyticsDashboard as ITAnalyticsDashboardDTO } from "./contracts";
export type {
    ITRequesterTicket,
    ITRequesterTicketList,
    ITRequesterTicketPagination,
} from "./contracts";
export type {
    ITAssignableOperator,
    ITOperatorReferenceData,
    ITOperatorTicket,
    ITOperatorTicketList,
    ITOperatorTicketMutationSnapshot,
    ITTicketOperatorIdentity,
} from "./contracts";
export type {
    AssignITTicketInput,
    CreateITTicketInput,
    SetITTicketCategoryInput,
    TransitionITTicketStatusInput,
} from "./application/ticket-schemas";
export type { ITTicketCommentSubmission, ITTicketTimelinePage, ITTicketTimelineItem } from "./contracts";
export type { ITTicketAttachmentSummary } from "./contracts";
export type {
    CreateITTicketResult,
    ITTicketMutationResult,
    ITTicketRecord,
} from "./application/types";
export type {
    ITTicketErrorCode,
    ITTicketMutationConflictReason,
} from "./application/ticket-errors";
