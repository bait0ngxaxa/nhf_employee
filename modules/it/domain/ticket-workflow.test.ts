import type { ITTicketStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { isAllowedITTicketTransition } from "./ticket-workflow";

const STATUSES = [
    "OPEN",
    "IN_PROGRESS",
    "WAITING_REQUESTER",
    "RESOLVED",
    "CLOSED",
    "CANCELLED",
] as const satisfies readonly ITTicketStatus[];

const APPROVED_TRANSITIONS = new Set([
    "OPEN:IN_PROGRESS",
    "IN_PROGRESS:WAITING_REQUESTER",
    "WAITING_REQUESTER:IN_PROGRESS",
    "IN_PROGRESS:RESOLVED",
]);

describe("IT Ticket workflow", () => {
    it.each(STATUSES.flatMap((from) => STATUSES.map((to) => [from, to] as const)))(
        "%s → %s follows the approved transition table",
        (from, to) => {
            expect(isAllowedITTicketTransition(from, to)).toBe(
                APPROVED_TRANSITIONS.has(`${from}:${to}`),
            );
        },
    );
});
