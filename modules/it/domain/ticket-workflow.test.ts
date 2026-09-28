import type { ITTicketStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
    getAllowedITTicketTransitions,
    isAllowedITTicketTransition,
} from "./ticket-workflow";

const STATUSES = [
    "OPEN",
    "IN_PROGRESS",
    "WAITING_REQUESTER",
    "RESOLVED",
    "CLOSED",
    "CANCELLED",
] as const satisfies readonly ITTicketStatus[];

const APPROVED_TRANSITIONS: Readonly<Record<ITTicketStatus, readonly ITTicketStatus[]>> = {
    OPEN: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["WAITING_REQUESTER", "RESOLVED", "CANCELLED"],
    WAITING_REQUESTER: ["IN_PROGRESS", "CANCELLED"],
    RESOLVED: ["IN_PROGRESS", "CLOSED"],
    CLOSED: [],
    CANCELLED: [],
};

describe("IT Ticket workflow", () => {
    it.each(STATUSES.flatMap((from) => STATUSES.map((to) => [from, to] as const)))(
        "%s → %s follows the approved transition table",
        (from, to) => {
            const allowed = APPROVED_TRANSITIONS[from].includes(to);
            expect(isAllowedITTicketTransition(from, to)).toBe(allowed);
            expect(getAllowedITTicketTransitions(from).includes(to)).toBe(allowed);
        },
    );

    it.each(STATUSES)("returns the exact operator actions for %s", (from) => {
        expect(getAllowedITTicketTransitions(from)).toEqual(APPROVED_TRANSITIONS[from]);
    });
});
