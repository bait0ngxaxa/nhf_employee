import { describe, expect, it } from "vitest";

import { getInitialITTicketPriority, isITTicketPriorityEscalation } from "./ticket-priority";

describe("IT Ticket priority policy", () => {
    it("assigns the approved initial priority by Ticket type", () => {
        expect(getInitialITTicketPriority("INCIDENT")).toBe("P2");
        expect(getInitialITTicketPriority("SERVICE_REQUEST")).toBe("P3");
        expect(getInitialITTicketPriority("SUGGESTION")).toBe("P3");
    });

    it("recognizes only escalations into P0 or P1", () => {
        expect(isITTicketPriorityEscalation("P1", "P0")).toBe(true);
        expect(isITTicketPriorityEscalation("P2", "P0")).toBe(true);
        expect(isITTicketPriorityEscalation("P3", "P0")).toBe(true);
        expect(isITTicketPriorityEscalation("P2", "P1")).toBe(true);
        expect(isITTicketPriorityEscalation("P3", "P1")).toBe(true);
        expect(isITTicketPriorityEscalation("P0", "P1")).toBe(false);
        expect(isITTicketPriorityEscalation("P1", "P2")).toBe(false);
        expect(isITTicketPriorityEscalation("P3", "P3")).toBe(false);
    });
});
