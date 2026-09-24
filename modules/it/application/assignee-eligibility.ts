import type { ITAssigneeEligibilityEvidence } from "./types";

/**
 * Only active workforce with configured operator authority for reading,
 * communicating, and managing Tickets can be assigned an IT Ticket.
 * Default Domain Policy scopes are not eligible evidence.
 */
export function evaluateITAssigneeEligibility(
    evidence: ITAssigneeEligibilityEvidence,
): boolean {
    return evidence.activeWorkforce
        && evidence.hasConfiguredReadAll
        && evidence.hasConfiguredCommentAll
        && evidence.hasConfiguredManageAll;
}
