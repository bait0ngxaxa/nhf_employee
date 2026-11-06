import type { ITOperatorTicket } from "../../contracts";

export interface ITOperatorQueueMergeResult {
    readonly tickets: readonly ITOperatorTicket[];
    /** Ticket IDs that were already visible and arrived again in the new page. */
    readonly repositionedTicketIds: readonly number[];
}

/**
 * Appends a keyset page without duplicating Ticket IDs. A Ticket that reappears
 * moved behind the cursor after an earlier page loaded (for example, after a
 * priority downgrade); the newer server copy wins and takes its new position.
 * This cannot recover rows that moved ahead of the cursor; the caller should
 * offer a reload when any row was repositioned.
 */
export function mergeITOperatorQueuePage(
    loaded: readonly ITOperatorTicket[],
    nextPage: readonly ITOperatorTicket[],
): ITOperatorQueueMergeResult {
    const nextPageById = new Map<number, ITOperatorTicket>();
    for (const ticket of nextPage) {
        if (!nextPageById.has(ticket.id)) nextPageById.set(ticket.id, ticket);
    }
    const repositionedTicketIds = loaded
        .filter((ticket) => nextPageById.has(ticket.id))
        .map((ticket) => ticket.id);

    return {
        tickets: [
            ...loaded.filter((ticket) => !nextPageById.has(ticket.id)),
            ...nextPageById.values(),
        ],
        repositionedTicketIds,
    };
}

export function isITOperatorQueueCursorStale(payload: unknown): boolean {
    return typeof payload === "object"
        && payload !== null
        && "code" in payload
        && payload.code === "QUEUE_CURSOR_STALE";
}
