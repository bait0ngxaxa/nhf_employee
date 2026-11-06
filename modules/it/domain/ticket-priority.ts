import type { ITTicketPriority, ITTicketStatus, ITTicketType } from "@prisma/client";

import { isActiveWorkITTicketStatus } from "./ticket-workflow";

const INITIAL_PRIORITY_BY_TYPE: Readonly<Record<ITTicketType, ITTicketPriority>> = {
    INCIDENT: "P2",
    SERVICE_REQUEST: "P3",
    SUGGESTION: "P3",
};

/** Applies the server-owned initial priority policy for requester-created Tickets. */
export function getInitialITTicketPriority(type: ITTicketType): ITTicketPriority {
    return INITIAL_PRIORITY_BY_TYPE[type];
}

export function isITTicketPriorityEscalation(
    from: ITTicketPriority,
    to: ITTicketPriority,
): boolean {
    return (to === "P0" && from !== "P0")
        || (to === "P1" && (from === "P2" || from === "P3"));
}

/**
 * Escalation alerts are operational signals for active work only. A Ticket
 * that is `RESOLVED`, `CLOSED`, or `CANCELLED` no longer needs an urgent
 * operator response, so an alert for it is misleading.
 */
export function isITTicketPriorityEscalationAlertableStatus(
    status: ITTicketStatus,
): boolean {
    return isActiveWorkITTicketStatus(status);
}

export type ITTicketPriorityEscalationAudience = "ASSIGNEE" | "OPERATOR_QUEUE";

/**
 * P0 always alerts the eligible operator queue. P1 alerts the current
 * assignee only while that assignee is an eligible operator; otherwise it
 * falls back to the eligible queue. A non-null assignee alone is never proof
 * of current authority.
 */
export function resolveITTicketPriorityEscalationAudience(input: {
    readonly priority: "P0" | "P1";
    readonly assignedToUserId: number | null;
    readonly eligibleOperatorUserIds: ReadonlySet<number>;
}): ITTicketPriorityEscalationAudience {
    if (input.priority === "P0") return "OPERATOR_QUEUE";
    return input.assignedToUserId !== null
        && input.eligibleOperatorUserIds.has(input.assignedToUserId)
        ? "ASSIGNEE"
        : "OPERATOR_QUEUE";
}

export interface ITTicketPriorityEscalationRecipients {
    readonly audience: ITTicketPriorityEscalationAudience;
    readonly recipientUserIds: readonly number[];
}

/** Selects unique, eligible, non-actor recipients for one escalation fact. */
export function selectITTicketPriorityEscalationRecipients(input: {
    readonly priority: "P0" | "P1";
    readonly assignedToUserId: number | null;
    readonly actorUserId: number;
    readonly eligibleOperatorUserIds: readonly number[];
}): ITTicketPriorityEscalationRecipients {
    const eligible = new Set(input.eligibleOperatorUserIds);
    const audience = resolveITTicketPriorityEscalationAudience({
        priority: input.priority,
        assignedToUserId: input.assignedToUserId,
        eligibleOperatorUserIds: eligible,
    });
    const candidates = audience === "ASSIGNEE" && input.assignedToUserId !== null
        ? [input.assignedToUserId]
        : [...eligible];
    return {
        audience,
        recipientUserIds: candidates.filter((userId) => userId !== input.actorUserId),
    };
}
