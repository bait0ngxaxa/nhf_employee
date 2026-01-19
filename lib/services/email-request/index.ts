// Re-export types
export type {
    CreateEmailRequestData,
    EmailRequestFilters,
    UserContext,
    EmailRequestWithUser,
    PaginatedEmailRequestsResult,
    CreateEmailRequestResult,
} from "./types";

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
