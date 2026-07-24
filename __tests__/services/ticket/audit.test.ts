import {
    TicketCategory,
    TicketPriority,
    TicketStatus,
    type Ticket,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { auditTicketUpdate } from "@/lib/services/ticket/audit";

function createTicket(overrides: Partial<Ticket> = {}): Ticket {
    return {
        id: 1,
        title: "Printer",
        description: "Offline",
        category: TicketCategory.PRINTER,
        priority: TicketPriority.LOW,
        status: TicketStatus.RESOLVED,
        createdAt: new Date("2026-07-24T01:00:00.000Z"),
        updatedAt: new Date("2026-07-24T02:00:00.000Z"),
        resolvedAt: new Date("2026-07-24T01:30:00.000Z"),
        closedAt: null,
        cancelledAt: null,
        deletedAt: null,
        deletedById: null,
        deleteReason: null,
        reportedById: 10,
        assignedToId: null,
        ...overrides,
    };
}

describe("ticket audit", () => {
    it("records assignment and field updates without a false status event", async () => {
        const create = vi.fn().mockResolvedValue({});
        const before = createTicket();
        const after = createTicket({
            priority: TicketPriority.HIGH,
            assignedToId: 99,
            resolvedAt: new Date("2026-07-24T01:30:00.000Z"),
        });

        await auditTicketUpdate(
            { auditLog: { create } } as never,
            before,
            after,
            {
                id: 7,
                role: "ADMIN",
                email: "admin@test.com",
                ipAddress: "127.0.0.1",
                userAgent: "vitest",
                requestId: "req-1",
                correlationId: "corr-1",
            },
        );

        const actions = create.mock.calls.map(
            ([call]) => call.data.action as string,
        );
        expect(actions).toEqual(["TICKET_ASSIGN", "TICKET_UPDATE"]);
        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: 7,
                    ipAddress: "127.0.0.1",
                    userAgent: "vitest",
                    details: expect.stringContaining('"requestId":"req-1"'),
                }),
            }),
        );
    });
});
