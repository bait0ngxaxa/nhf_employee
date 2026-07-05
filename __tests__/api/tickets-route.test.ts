import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";
import { POST as createTicketRoute } from "@/app/api/tickets/route";
import { getApiAuthSession } from "@/lib/auth/server";
import { buildUserContext } from "@/lib/auth/context";
import { ticketService } from "@/lib/services/ticket";
import { processOutbox } from "@/lib/services/outbox/processor";
import { logTicketEvent } from "@/lib/server/audit";

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: vi.fn((callback: () => void | Promise<void>) => {
            void callback();
        }),
    };
});

vi.mock("@/lib/auth/server", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
    buildUserContext: vi.fn(),
}));

vi.mock("@/lib/services/ticket", () => ({
    ticketService: {
        createTicket: vi.fn(),
        getTickets: vi.fn(),
    },
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn(),
}));

vi.mock("@/lib/server/audit", () => ({
    logTicketEvent: vi.fn(),
}));

describe("POST /api/tickets", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(processOutbox).mockResolvedValue({
            processed: 0,
            failed: 0,
        } as never);
        vi.mocked(logTicketEvent).mockResolvedValue(undefined as never);
    });

    it("processes ticket notification outbox after creating ticket", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: {
                id: "9",
                email: "user@test.com",
                role: "USER",
                name: "User",
            },
        } as never);
        vi.mocked(buildUserContext).mockReturnValue({
            id: 9,
            email: "user@test.com",
            role: "USER",
            name: "User",
        });
        vi.mocked(ticketService.createTicket).mockResolvedValue({
            id: 123,
            title: "Printer not working",
            category: "HARDWARE",
            priority: "HIGH",
            status: "OPEN",
            reportedBy: {
                name: "Fallback Reporter",
                employee: {
                    firstName: "Somchai",
                    lastName: "Jaidee",
                },
            },
        } as never);
        const request = new NextRequest("http://localhost/api/tickets", {
            method: "POST",
            body: JSON.stringify({
                title: "Printer not working",
                description: "Cannot print from floor 2",
                category: "HARDWARE",
                priority: "HIGH",
            }),
        });

        const response = await createTicketRoute(request);
        expect(response.status).toBe(201);
        await Promise.resolve();
        await Promise.resolve();
        expect(processOutbox).toHaveBeenCalledTimes(1);
        expect(logTicketEvent).toHaveBeenCalledWith(
            "TICKET_CREATE",
            123,
            9,
            "user@test.com",
            expect.objectContaining({
                after: expect.objectContaining({
                    title: "Printer not working",
                    priority: "HIGH",
                }),
            }),
        );
    });
});
