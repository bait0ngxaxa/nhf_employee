// Re-export types
export type {
    CreateEmailRequestData,
    CreateEmailRequestOptions,
    EmailRequestFilters,
    EmailRequestReadAuthorization,
    UserContext,
    EmailRequestWithUser,
    PaginatedEmailRequestsResult,
    CreateEmailRequestResult,
} from "./types";

export {
    assertEmailRequestCapability,
    assertEmailRequestCapabilityScope,
    buildEmailRequestAuthorizationActor,
    buildEmailRequestAuthorizationContext,
    defaultEmailRequestScopes,
    EMAIL_REQUEST_CAPABILITIES,
    EmailRequestCapabilityDeniedError,
    inspectEmailRequestEffectiveAccess,
    resolveEmailRequestCapability,
    toEmailRequestReadAuthorization,
} from "./authorization";
export type {
    EmailRequestAuthorizationActor,
    EmailRequestAuthorizationContext,
    EmailRequestCapability,
    EmailRequestCapabilityAuthorization,
} from "./authorization";

// Import service functions
import { getEmailRequests } from "./queries";
import { createEmailRequest } from "./mutations";

/**
 * Email Request Service Object
 */
export const emailRequestService = {
    getEmailRequests,
    createEmailRequest,
};

// Also export individual functions
export { getEmailRequests, createEmailRequest };
export { EmailRequestIdempotencyConflictError } from "./idempotency";
