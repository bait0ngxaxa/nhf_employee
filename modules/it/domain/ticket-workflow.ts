import type { ITTicketStatus } from "@prisma/client";

/** The only status transitions approved for the IT2 workflow. */
export function isAllowedITTicketTransition(
    from: ITTicketStatus,
    to: ITTicketStatus,
): boolean {
    switch (from) {
        case "OPEN":
            return to === "IN_PROGRESS";
        case "IN_PROGRESS":
            return to === "WAITING_REQUESTER" || to === "RESOLVED";
        case "WAITING_REQUESTER":
            return to === "IN_PROGRESS";
        case "RESOLVED":
        case "CLOSED":
        case "CANCELLED":
            return false;
    }
}
