"use client";

export { ITTicketDetail } from "./presentation/dashboard/ITTicketDetail";
export { ITTicketConversation } from "./presentation/dashboard/ITTicketConversation";
export { ITTicketOperatorDetail } from "./presentation/dashboard/ITTicketOperatorDetail";
export { ITTicketOperatorQueue } from "./presentation/dashboard/ITTicketOperatorQueue";
export { ITTicketSelfService } from "./presentation/dashboard/ITTicketSelfService";
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
    IT_TICKET_TITLE_MAX_LENGTH,
    IT_TICKET_TYPE_LABELS,
    IT_TICKET_TYPE_OPTIONS,
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
    ITTicketTimelineComment,
    ITTicketTimelineEvent,
    ITTicketTimelineItem,
    ITTicketTimelinePage,
} from "./contracts";
export { getAllowedITTicketTransitions } from "./domain/ticket-workflow";
