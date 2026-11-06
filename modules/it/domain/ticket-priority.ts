import type { ITTicketPriority, ITTicketType } from "@prisma/client";

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
