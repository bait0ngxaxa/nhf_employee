import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as createTicketRoute } from "@/app/api/tickets/route";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { ticketService } from "@/lib/services/ticket";
import { prisma } from "@/lib/prisma";
import { processOutbox } from "@/lib/services/outbox/processor";
import { logTicketEvent } from "@/lib/audit";

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof import("next/server")>();
    return {
        ...actual,
        after: vi.fn((callback: () => void | Promise<void>) => {
            void callback();
        }),
    };
});

vi.mock("@/lib/server-auth", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/lib/context", () => ({
    buildUserContext: vi.fn(),
}));

vi.mock("@/lib/services/ticket", () => ({
    ticketService: {
        createTicket: vi.fn(),
        getTickets: vi.fn(),
    },
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        user: {
            findMany: vi.fn(),
        },
        notification: {
            createMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
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

    it("creates in-app admin notifications with ticket context (not generic text)", async () => {
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
        vi.mocked(prisma.user.findMany).mockResolvedValue([
            { id: 1 },
            { id: 2 },
        ] as never);
        vi.mocked(prisma.notification.createMany).mockResolvedValue({
            count: 2,
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
        expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);

        const createManyCall = vi.mocked(prisma.notification.createMany).mock.calls[0]?.[0];
        expect(createManyCall).toBeDefined();
        const firstPayload = createManyCall?.data?.[0];
        expect(firstPayload).toBeDefined();
        expect(firstPayload.title).not.toBe("Notification");
        expect(firstPayload.message).not.toBe("Operation completed");
        expect(firstPayload.message).toContain("Printer not working");
        expect(firstPayload.message).toContain("HIGH");
    });
});
