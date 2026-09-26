import { getEmailRequests as queryEmailRequests } from "../../infrastructure/persistence/email-request-repository";
import type {
    EmailRequestFilters,
    EmailRequestReadAuthorization,
    PaginatedEmailRequestsResult,
} from "./types";

export function getEmailRequests(
    filters: EmailRequestFilters,
    authorization: EmailRequestReadAuthorization,
): Promise<PaginatedEmailRequestsResult> {
    return queryEmailRequests(filters, authorization);
}
