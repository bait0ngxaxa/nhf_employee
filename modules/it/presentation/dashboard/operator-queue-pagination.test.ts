import { describe, expect, it } from "vitest";

import type { ITOperatorTicket } from "../../contracts";
import {
    isITOperatorQueueCursorStale,
    mergeITOperatorQueuePage,
} from "./operator-queue-pagination";

function row(id: number, priority: ITOperatorTicket["priority"]): ITOperatorTicket {
    return {
        id,
        type: "INCIDENT",
        title: `Ticket ${id}`,
        description: "",
        status: "OPEN",
        priority,
        triagedAt: null,
        isTriaged: false,
        triagedBy: null,
        requester: { userId: 41, displayName: "ผู้แจ้ง", departmentId: null, departmentNameSnapshot: null },
        assignee: null,
        category: null,
        version: 1,
        createdAt: "2026-11-01T00:00:00.000Z",
        updatedAt: "2026-11-01T00:00:00.000Z",
        resolvedAt: null,
    };
}

describe("IT operator queue page merge", () => {
    it("appends a disjoint page unchanged", () => {
        const result = mergeITOperatorQueuePage([row(1, "P1"), row(2, "P2")], [row(3, "P2")]);
        expect(result.tickets.map(({ id }) => id)).toEqual([1, 2, 3]);
        expect(result.repositionedTicketIds).toEqual([]);
    });

    it("never duplicates a loaded Ticket that moved behind the cursor; the newer copy wins", () => {
        // #101 was P1 on page 1, then downgraded to P3 and reappears on page 2.
        const result = mergeITOperatorQueuePage(
            [row(101, "P1"), row(102, "P2"), row(103, "P2")],
            [row(104, "P2"), row(101, "P3")],
        );
        expect(result.tickets.map(({ id }) => id)).toEqual([102, 103, 104, 101]);
        expect(result.tickets.at(-1)?.priority).toBe("P3");
        expect(result.repositionedTicketIds).toEqual([101]);
        expect(new Set(result.tickets.map(({ id }) => id)).size).toBe(result.tickets.length);
    });

    it("ignores a duplicate inside the same page", () => {
        const result = mergeITOperatorQueuePage([], [row(5, "P0"), row(5, "P0")]);
        expect(result.tickets.map(({ id }) => id)).toEqual([5]);
    });

    it("recognizes only the explicit stale-cursor outcome", () => {
        expect(isITOperatorQueueCursorStale({ success: false, code: "QUEUE_CURSOR_STALE" })).toBe(true);
        expect(isITOperatorQueueCursorStale({ success: false, code: "MUTATION_CONFLICT" })).toBe(false);
        expect(isITOperatorQueueCursorStale(null)).toBe(false);
    });
});
