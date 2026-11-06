import type { ITTicketStatus } from "@prisma/client";

const ALLOWED_TRANSITIONS: Readonly<Record<ITTicketStatus, readonly ITTicketStatus[]>> =
    Object.freeze({
        OPEN: Object.freeze(["IN_PROGRESS", "CANCELLED"] as const),
        IN_PROGRESS: Object.freeze([
            "WAITING_REQUESTER",
            "RESOLVED",
            "CANCELLED",
        ] as const),
        WAITING_REQUESTER: Object.freeze(["IN_PROGRESS", "CANCELLED"] as const),
        RESOLVED: Object.freeze(["IN_PROGRESS", "CLOSED"] as const),
        CLOSED: Object.freeze([]),
        CANCELLED: Object.freeze([]),
    });

/** The sole state-transition definition for the approved IT Ticket lifecycle. */
export function isAllowedITTicketTransition(
    from: ITTicketStatus,
    to: ITTicketStatus,
): boolean {
    return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Returns only approved operator destinations for the current status. */
export function getAllowedITTicketTransitions(
    from: ITTicketStatus,
): readonly ITTicketStatus[] {
    return ALLOWED_TRANSITIONS[from];
}

/**
 * Statuses that represent work IT is still actively carrying. `RESOLVED`
 * awaits explicit operator closure but is not active work.
 */
export const IT_TICKET_ACTIVE_WORK_STATUSES = Object.freeze([
    "OPEN",
    "IN_PROGRESS",
    "WAITING_REQUESTER",
] as const satisfies readonly ITTicketStatus[]);

export function isActiveWorkITTicketStatus(status: ITTicketStatus): boolean {
    return (IT_TICKET_ACTIVE_WORK_STATUSES as readonly ITTicketStatus[]).includes(status);
}

/** A Ticket is terminal when the approved workflow has no outgoing transition. */
export function isTerminalITTicketStatus(status: ITTicketStatus): boolean {
    return ALLOWED_TRANSITIONS[status].length === 0;
}
