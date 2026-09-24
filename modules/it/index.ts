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
export type {
    ITAuthorizationActor,
    ITAuthorizationContext,
    ITCapability,
    ITCapabilityAuthorization,
} from "./application/authorization";
export { evaluateITAssigneeEligibility } from "./application/assignee-eligibility";
export {
    IT_TICKET_DESCRIPTION_MAX_LENGTH,
    IT_TICKET_TITLE_MAX_LENGTH,
    createITTicketInputSchema,
} from "./application/ticket-schemas";
export {
    assignITTicket,
    createITTicket,
    setITTicketCategory,
    transitionITTicketStatus,
} from "./application/ticket-commands";
export {
    getITRequesterTicket,
    IT_TICKET_LIST_DEFAULT_LIMIT,
    IT_TICKET_LIST_DEFAULT_PAGE,
    IT_TICKET_LIST_MAX_LIMIT,
    listITRequesterTickets,
    listITRequesterTicketsInputSchema,
} from "./application/ticket-queries";
export { toITRequesterTicket } from "./application/ticket-dto";
export {
    ITTicketAssigneeNotEligibleError,
    ITTicketCategoryInactiveError,
    ITTicketCategoryNotFoundError,
    ITTicketError,
    ITTicketIdempotencyConflictError,
    ITTicketInputValidationError,
    ITTicketInvalidTransitionError,
    ITTicketMutationConflictError,
    ITTicketNotFoundError,
    ITWorkforceDeniedError,
} from "./application/ticket-errors";
export { isAllowedITTicketTransition } from "./domain/ticket-workflow";
export { ITTicketEventKind, ITTicketStatus, ITTicketType } from "@prisma/client";
export type {
    ITAssigneeEligibilityEvidence,
    ITPresentationCapabilities,
    ITTicketResourceScope,
} from "./application/types";
export type {
    ITRequesterTicket,
    ITRequesterTicketList,
    ITRequesterTicketPagination,
} from "./contracts";
export type {
    AssignITTicketInput,
    CreateITTicketInput,
    SetITTicketCategoryInput,
    TransitionITTicketStatusInput,
} from "./application/ticket-schemas";
export type {
    CreateITTicketResult,
    ITTicketMutationResult,
    ITTicketRecord,
} from "./application/types";
export type {
    ITTicketErrorCode,
    ITTicketMutationConflictReason,
} from "./application/ticket-errors";
