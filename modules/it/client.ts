"use client";

export { LiffITApp } from "./presentation/liff/LiffITApp";
export { ITTicketDetail } from "./presentation/dashboard/ITTicketDetail";
export { ITTicketConversation } from "./presentation/dashboard/ITTicketConversation";
export { ITTicketOperatorDetail } from "./presentation/dashboard/ITTicketOperatorDetail";
export { ITTicketOperatorQueue } from "./presentation/dashboard/ITTicketOperatorQueue";
export { ITTicketSelfService } from "./presentation/dashboard/ITTicketSelfService";
export { ITWorkspace } from "./presentation/dashboard/ITWorkspace";
export {
    canAccessITWorkspaceDashboard,
    getVisibleITDashboardTabs,
    normalizeITDashboardTab,
} from "./presentation/dashboard/workspace-projection";
export { ITAnalyticsDashboard } from "./presentation/dashboard/ITAnalyticsDashboard";
export {
    IT_OPERATOR_QUEUE_DEFAULT_LIMIT,
    IT_OPERATOR_QUEUE_MAX_LIMIT,
    IT_TICKET_DESCRIPTION_MAX_LENGTH,
    IT_TICKET_COMMENTABLE_STATUSES,
    IT_TICKET_COMMENT_MAX_LENGTH,
    IT_TICKET_LIST_DEFAULT_LIMIT,
    IT_TICKET_STATUS_LABELS,
    IT_TICKET_TIMELINE_DEFAULT_LIMIT,
    IT_TICKET_TIMELINE_MAX_LIMIT,
    IT_TICKET_ATTACHMENT_ACCEPTED_TYPES,
    IT_TICKET_ATTACHMENT_MAX_BYTES,
    IT_TICKET_ATTACHMENT_MAX_FILES,
    IT_TICKET_ATTACHMENT_MAX_HEIGHT,
    IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES,
    IT_TICKET_ATTACHMENT_MAX_WIDTH,
    IT_TICKET_TITLE_MAX_LENGTH,
    IT_TICKET_TYPE_LABELS,
    IT_TICKET_TYPE_OPTIONS,
    IT_TICKET_STATUS_OPTIONS,
    IT_ANALYTICS_PERIODS,
    IT_ANALYTICS_TIME_ZONE,
} from "./contracts";
export type {
    ITAssignableOperator,
    ITOperatorReferenceData,
    ITOperatorTicket,
    ITOperatorTicketList,
    ITOperatorTicketMutationSnapshot,
    ITTicketOperatorIdentity,
    ITPresentationCapabilities,
    ITRequesterTicket,
    ITRequesterTicketList,
    ITRequesterTicketPagination,
    ITTicketCommentSubmission,
    ITTicketAttachmentSummary,
    ITTicketTimelineComment,
    ITTicketTimelineEvent,
    ITTicketTimelineItem,
    ITTicketTimelinePage,
    ITAnalyticsDashboard as ITAnalyticsDashboardDTO,
    ITAnalyticsPeriod,
} from "./contracts";
export { getAllowedITTicketTransitions } from "./domain/ticket-workflow";
export {
    EmailRequestSection,
    EmailRequestSectionSkeleton,
    EmailRequestForm,
    EmailRequestHistory,
    EmailRequestAccessFields,
} from "./presentation/dashboard/email-request";
export {
    isSharedDriveOption,
    SHARED_DRIVE_OPTIONS,
} from "./domain/email-request/constants";
export type {
    EmailRequest,
    EmailRequestFormData,
    EmailRequestListResponse,
    EmailRequestPresentationCapabilities,
    Pagination,
} from "./domain/email-request/contracts";
export type { SharedDriveOption } from "./domain/email-request/constants";
