import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";
import { POST as createTicketRoute } from "@/app/api/tickets/route";
import { getApiAuthSession } from "@/lib/auth/server";
import { buildUserContext } from "@/lib/auth/context";
import { ticketService } from "@/lib/services/ticket";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { TicketPriorityForbiddenError } from "@/lib/ssot/ticket-priority-policy";

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

vi.mock("@/lib/security/mutation-rate-limit", () => ({
    enforceAuthenticatedMutationRateLimit: vi.fn(),
    enforcePreAuthIpRateLimit: vi.fn(),
}));

describe("POST /api/tickets", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(processOutbox).mockResolvedValue({
            processed: 0,
            failed: 0,
        } as never);
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
            ticket: {
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
            },
            replayed: false,
        } as never);
        const request = new NextRequest("http://localhost/api/tickets", {
            method: "POST",
            headers: { "Idempotency-Key": "ticket-create-123" },
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
        expect(enforcePreAuthIpRateLimit).toHaveBeenCalledWith(
            request,
            "ticket-create",
        );
        expect(enforceAuthenticatedMutationRateLimit).toHaveBeenCalledWith(
            "ticket-create",
            9,
        );
        expect(ticketService.createTicket).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Printer not working",
                priority: "HIGH",
            }),
            expect.objectContaining({
                id: 9,
                email: "user@test.com",
                requestId: expect.any(String),
            }),
            { idempotencyKey: "ticket-create-123" },
        );
    });

    it("requires an Idempotency-Key", async () => {
        const request = new NextRequest("http://localhost/api/tickets", {
            method: "POST",
            body: JSON.stringify({
                title: "Printer not working",
                description: "Cannot print",
                category: "HARDWARE",
                priority: "MEDIUM",
            }),
        });

        const response = await createTicketRoute(request);

        expect(response.status).toBe(400);
        expect(ticketService.createTicket).not.toHaveBeenCalled();
    });

    it("returns the original ticket without waking outbox on replay", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: { id: "9", email: "user@test.com", role: "USER" },
        } as never);
        vi.mocked(buildUserContext).mockReturnValue({
            id: 9,
            email: "user@test.com",
            role: "USER",
            name: "User",
        });
        vi.mocked(ticketService.createTicket).mockResolvedValue({
            ticket: { id: 123 },
            replayed: true,
        } as never);
        const request = new NextRequest("http://localhost/api/tickets", {
            method: "POST",
            headers: { "Idempotency-Key": "ticket-create-123" },
            body: JSON.stringify({
                title: "Printer not working",
                description: "Cannot print",
                category: "HARDWARE",
                priority: "MEDIUM",
            }),
        });

        const response = await createTicketRoute(request);

        expect(response.status).toBe(200);
        expect(processOutbox).not.toHaveBeenCalled();
    });

    it("rejects URGENT priority from a non-admin reporter", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: { id: "9", email: "user@test.com", role: "USER" },
        } as never);
        vi.mocked(ticketService.createTicket).mockRejectedValue(
            new TicketPriorityForbiddenError(),
        );
        const request = new NextRequest("http://localhost/api/tickets", {
            method: "POST",
            headers: { "Idempotency-Key": "ticket-create-urgent" },
            body: JSON.stringify({
                title: "Printer not working",
                description: "Cannot print",
                category: "HARDWARE",
                priority: "URGENT",
            }),
        });

        const response = await createTicketRoute(request);

        expect(response.status).toBe(403);
        expect(ticketService.createTicket).toHaveBeenCalled();
    });
});
