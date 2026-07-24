import { TicketStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
    buildTicketStatusUpdate,
    isTicketStatusTransitionAllowed,
} from "@/lib/services/ticket/status-transitions";

describe("ticket status transitions", () => {
    const now = new Date("2026-07-24T02:00:00.000Z");

    it("preserves resolvedAt when moving from RESOLVED to CLOSED", () => {
        expect(
            buildTicketStatusUpdate(
                TicketStatus.RESOLVED,
                TicketStatus.CLOSED,
                now,
            ),
        ).toEqual({
            status: TicketStatus.CLOSED,
            closedAt: now,
        });
    });

    it("clears resolvedAt only when a resolved ticket returns to active work", () => {
        expect(
            buildTicketStatusUpdate(
                TicketStatus.RESOLVED,
                TicketStatus.IN_PROGRESS,
                now,
            ),
        ).toEqual({
            status: TicketStatus.IN_PROGRESS,
            resolvedAt: null,
        });
    });

    it("records and clears terminal timestamps on cancel and reopen", () => {
        expect(
            buildTicketStatusUpdate(
                TicketStatus.OPEN,
                TicketStatus.CANCELLED,
                now,
            ),
        ).toEqual({
            status: TicketStatus.CANCELLED,
            cancelledAt: now,
        });
        expect(
            buildTicketStatusUpdate(
                TicketStatus.CANCELLED,
                TicketStatus.OPEN,
                now,
            ),
        ).toEqual({
            status: TicketStatus.OPEN,
            cancelledAt: null,
        });
    });

    it("allows only transitions declared by the matrix", () => {
        expect(
            isTicketStatusTransitionAllowed(
                TicketStatus.RESOLVED,
                TicketStatus.CLOSED,
            ),
        ).toBe(true);
        expect(
            isTicketStatusTransitionAllowed(
                TicketStatus.CLOSED,
                TicketStatus.RESOLVED,
            ),
        ).toBe(false);
    });
});
