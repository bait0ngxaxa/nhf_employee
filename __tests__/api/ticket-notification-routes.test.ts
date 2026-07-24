import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";
import {
    DELETE as deleteTicketRoute,
    PATCH as patchTicketRoute,
} from "@/app/api/tickets/[id]/route";
import { POST as postTicketCommentRoute } from "@/app/api/tickets/[id]/comments/route";
import { getApiAuthSession } from "@/lib/auth/server";
import { buildUserContext } from "@/lib/auth/context";
import { ticketService } from "@/lib/services/ticket";
import { processOutbox } from "@/lib/services/outbox/processor";
import { prisma } from "@/lib/db/prisma";
import { isAdminRole } from "@/lib/ssot/permissions";

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
        deleteTicket: vi.fn(),
        updateTicket: vi.fn(),
    },
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn(),
}));

vi.mock("@/lib/ssot/permissions", () => ({
    isAdminRole: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
        auditLog: {
            create: vi.fn(),
        },
        notification: {
            create: vi.fn(),
            createMany: vi.fn(),
        },
        ticket: {
            findFirst: vi.fn(),
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
        vi.mocked(prisma.$transaction).mockImplementation(
            async (callback) => callback(prisma as never),
        );
        vi.mocked(processOutbox).mockResolvedValue({
            processed: 0,
            failed: 0,
        } as never);
    });

    it("processes ticket notification outbox when status changes", async () => {
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
        expect(processOutbox).toHaveBeenCalledTimes(1);
    });

    it("returns 409 and skips outbox processing on concurrent update", async () => {
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
            ticket: null,
            error: "Ticket was updated by another user",
            status: 409,
        });

        const req = new NextRequest("http://localhost/api/tickets/44", {
            method: "PATCH",
            body: JSON.stringify({ status: "IN_PROGRESS" }),
        });
        const res = await patchTicketRoute(req, {
            params: Promise.resolve({ id: "44" }),
        });

        expect(res.status).toBe(409);
        expect(await res.json()).toMatchObject({
            error: "Ticket was updated by another user",
        });
        expect(processOutbox).not.toHaveBeenCalled();
    });

    it("requires a delete reason and passes request metadata to soft delete", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: { id: "1", role: "ADMIN", email: "admin@test.com" },
        } as never);
        vi.mocked(buildUserContext).mockReturnValue({
            id: 1,
            role: "ADMIN",
            email: "admin@test.com",
            name: "Admin",
        });
        vi.mocked(ticketService.deleteTicket).mockResolvedValue({
            success: true,
        });

        const invalidRequest = new NextRequest(
            "http://localhost/api/tickets/44",
            {
                method: "DELETE",
                body: JSON.stringify({}),
            },
        );
        const invalidResponse = await deleteTicketRoute(invalidRequest, {
            params: Promise.resolve({ id: "44" }),
        });
        expect(invalidResponse.status).toBe(400);
        expect(ticketService.deleteTicket).not.toHaveBeenCalled();

        const validRequest = new NextRequest(
            "http://localhost/api/tickets/44",
            {
                method: "DELETE",
                headers: { "x-request-id": "req-delete-44" },
                body: JSON.stringify({ reason: "ข้อมูลซ้ำ" }),
            },
        );
        const validResponse = await deleteTicketRoute(validRequest, {
            params: Promise.resolve({ id: "44" }),
        });

        expect(validResponse.status).toBe(200);
        expect(ticketService.deleteTicket).toHaveBeenCalledWith(
            44,
            "ข้อมูลซ้ำ",
            expect.objectContaining({
                id: 1,
                email: "admin@test.com",
                requestId: "req-delete-44",
            }),
        );
    });

    it("sends in-app notification to reporter when admin adds comment", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: { id: "1", role: "ADMIN", email: "admin@test.com" },
        } as never);
        vi.mocked(isAdminRole).mockReturnValue(true);
        vi.mocked(prisma.ticket.findFirst).mockResolvedValue({
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
        expect(prisma.auditLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    action: "TICKET_COMMENT",
                    entityId: 55,
                    userId: 1,
                }),
            }),
        );
    });

    it("denies a non-admin assignee who is not the ticket owner", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: { id: "7", role: "USER", email: "assignee@test.com" },
        } as never);
        vi.mocked(isAdminRole).mockReturnValue(false);
        vi.mocked(prisma.ticket.findFirst).mockResolvedValue({
            id: 55,
            title: "VPN issue",
            reportedById: 9,
            assignedToId: 7,
        } as never);

        const req = new NextRequest("http://localhost/api/tickets/55/comments", {
            method: "POST",
            body: JSON.stringify({ content: "Checking this issue" }),
        });
        const res = await postTicketCommentRoute(req, {
            params: Promise.resolve({ id: "55" }),
        });

        expect(res.status).toBe(403);
        expect(prisma.ticketComment.create).not.toHaveBeenCalled();
        expect(prisma.notification.create).not.toHaveBeenCalled();
    });
});
