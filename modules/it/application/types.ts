import type { AuthorizationScope } from "@/modules/authorization";
import type { ITTicketStatus, ITTicketType } from "@prisma/client";

export interface ITTicketRecord {
    readonly id: number;
    readonly type: ITTicketType;
    readonly title: string;
    readonly description: string;
    readonly status: ITTicketStatus;
    readonly requesterUserId: number;
    readonly assignedToUserId: number | null;
    readonly categoryId: number | null;
    readonly requesterDepartmentId: number | null;
    readonly requesterDepartmentNameSnapshot: string | null;
    readonly version: number;
    readonly resolvedAt: Date | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface ITTicketMutationResult {
    readonly ticket: ITTicketRecord;
    readonly changed: boolean;
}

export interface CreateITTicketResult {
    readonly ticket: ITTicketRecord;
    readonly replayed: boolean;
}

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
