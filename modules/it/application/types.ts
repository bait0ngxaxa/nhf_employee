import type { AuthorizationScope } from "@/modules/authorization";

export interface ITPresentationCapabilities {
    readonly canReadOwnTickets: boolean;
    readonly canReadAllTickets: boolean;
    readonly canCreateOwnTickets: boolean;
    readonly canCommentOwnTickets: boolean;
    readonly canCommentAllTickets: boolean;
    readonly canManageTickets: boolean;
    readonly canReadAnalytics: boolean;
}

export interface ITTicketResourceScope {
    readonly requesterUserId: number;
}

/**
 * Provenance-aware evidence for the assignee rule. The configured fields must
 * come from central resolver decisions, never composed Default Domain Policy.
 */
export interface ITAssigneeEligibilityEvidence {
    readonly activeWorkforce: boolean;
    readonly hasConfiguredReadAll: boolean;
    readonly hasConfiguredCommentAll: boolean;
    readonly hasConfiguredManageAll: boolean;
}

export type ITCapabilityScopes = readonly AuthorizationScope[];
