import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH as patchTicketRoute } from "@/app/api/tickets/[id]/route";
import { POST as postTicketCommentRoute } from "@/app/api/tickets/[id]/comments/route";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { ticketService } from "@/lib/services/ticket";
import { processOutbox } from "@/lib/services/outbox/processor";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/ssot/permissions";

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
        updateTicket: vi.fn(),
    },
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn(),
}));

vi.mock("@/lib/ssot/permissions", () => ({
    isAdminRole: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        notification: {
            create: vi.fn(),
            createMany: vi.fn(),
        },
        ticket: {
            findUnique: vi.fn(),
        },
        ticketComment: {
            create: vi.fn(),
        },
        user: {
            findMany: vi.fn(),
        },
    },
}));

describe("Ticket notification routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(processOutbox).mockResolvedValue({
            processed: 0,
            failed: 0,
        } as never);
    });

    it("sends in-app notification when ticket status changed by another user", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: { id: "1", role: "ADMIN", email: "admin@test.com" },
        } as never);
        vi.mocked(buildUserContext).mockReturnValue({
            id: 1,
            role: "ADMIN",
            email: "admin@test.com",
            name: "Admin",
        });
        vi.mocked(ticketService.updateTicket).mockResolvedValue({
            ticket: {
                id: 44,
                title: "Printer broken",
                status: "IN_PROGRESS",
                reportedById: 9,
            },
            oldStatus: "OPEN",
        } as never);
        vi.mocked(prisma.notification.create).mockResolvedValue({} as never);

        const req = new NextRequest("http://localhost/api/tickets/44", {
            method: "PATCH",
            body: JSON.stringify({ status: "IN_PROGRESS" }),
        });
        const res = await patchTicketRoute(req, {
            params: Promise.resolve({ id: "44" }),
        });

        expect(res.status).toBe(200);
        await Promise.resolve();
        await Promise.resolve();
        expect(prisma.notification.create).toHaveBeenCalledTimes(1);
        expect(prisma.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 9,
                type: "TICKET_UPDATED",
                referenceId: "44",
            }),
        });
    });

    it("sends in-app notification to reporter when admin adds comment", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: { id: "1", role: "ADMIN", email: "admin@test.com" },
        } as never);
        vi.mocked(isAdminRole).mockReturnValue(true);
        vi.mocked(prisma.ticket.findUnique).mockResolvedValue({
            id: 55,
            title: "VPN issue",
            reportedById: 9,
            assignedToId: null,
        } as never);
        vi.mocked(prisma.ticketComment.create).mockResolvedValue({
            id: 3001,
            content: "Checking this issue",
            createdAt: new Date(),
            author: {
                id: 1,
                name: "Admin",
                email: "admin@test.com",
                role: "ADMIN",
                employee: null,
            },
        } as never);
        vi.mocked(prisma.notification.create).mockResolvedValue({} as never);

        const req = new NextRequest("http://localhost/api/tickets/55/comments", {
            method: "POST",
            body: JSON.stringify({ content: "Checking this issue" }),
        });
        const res = await postTicketCommentRoute(req, {
            params: Promise.resolve({ id: "55" }),
        });

        expect(res.status).toBe(201);
        await Promise.resolve();
        await Promise.resolve();
        expect(prisma.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 9,
                type: "NEW_COMMENT",
                referenceId: "55",
            }),
        });
    });
});
