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
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";

const { afterResults } = vi.hoisted(() => ({
    afterResults: [] as Array<void | Promise<void>>,
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: vi.fn((callback: () => void | Promise<void>) => {
            afterResults.push(callback());
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
        createTicketComment: vi.fn(),
    },
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn(),
}));

vi.mock("@/lib/security/mutation-rate-limit", () => ({
    enforceAuthenticatedMutationRateLimit: vi.fn(),
    enforcePreAuthIpRateLimit: vi.fn(),
}));

describe("Ticket notification routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        afterResults.length = 0;
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
        expect(afterResults.at(-1)).toBeInstanceOf(Promise);
        expect(enforcePreAuthIpRateLimit).toHaveBeenCalledWith(
            req,
            "ticket-update",
        );
        expect(enforceAuthenticatedMutationRateLimit).toHaveBeenCalledWith(
            "ticket-update",
            1,
        );
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
        expect(enforcePreAuthIpRateLimit).toHaveBeenCalledWith(
            validRequest,
            "ticket-delete",
        );
        expect(enforceAuthenticatedMutationRateLimit).toHaveBeenCalledWith(
            "ticket-delete",
            1,
        );
    });

    it("enqueues reporter comment notification atomically", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: { id: "1", role: "ADMIN", email: "admin@test.com" },
        } as never);
        vi.mocked(ticketService.createTicketComment).mockResolvedValue({
            outcome: "created",
            replayed: false,
            comment: {
                id: 3001,
                content: "Checking this issue",
            },
        } as never);

        const req = new NextRequest("http://localhost/api/tickets/55/comments", {
            method: "POST",
            headers: { "Idempotency-Key": "ticket-comment-3001" },
            body: JSON.stringify({ content: "Checking this issue" }),
        });
        const res = await postTicketCommentRoute(req, {
            params: Promise.resolve({ id: "55" }),
        });

        expect(res.status).toBe(201);
        await Promise.resolve();
        await Promise.resolve();
        expect(ticketService.createTicketComment).toHaveBeenCalledWith(
            55,
            { content: "Checking this issue" },
            expect.objectContaining({ id: 1 }),
            { idempotencyKey: "ticket-comment-3001" },
        );
        expect(enforcePreAuthIpRateLimit).toHaveBeenCalledWith(
            req,
            "ticket-comment",
        );
        expect(enforceAuthenticatedMutationRateLimit).toHaveBeenCalledWith(
            "ticket-comment",
            1,
        );
        expect(processOutbox).toHaveBeenCalledTimes(1);
        expect(afterResults.at(-1)).toBeInstanceOf(Promise);
    });

    it("replays a comment without waking the outbox processor", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: { id: "1", role: "ADMIN", email: "admin@test.com" },
        } as never);
        vi.mocked(ticketService.createTicketComment).mockResolvedValue({
            outcome: "created",
            replayed: true,
            comment: { id: 3001, content: "Checking this issue" },
        } as never);
        const request = new NextRequest(
            "http://localhost/api/tickets/55/comments",
            {
                method: "POST",
                headers: { "Idempotency-Key": "ticket-comment-3001" },
                body: JSON.stringify({ content: "Checking this issue" }),
            },
        );

        const response = await postTicketCommentRoute(request, {
            params: Promise.resolve({ id: "55" }),
        });

        expect(response.status).toBe(200);
        expect(processOutbox).not.toHaveBeenCalled();
    });

    it("requires an Idempotency-Key for comments", async () => {
        const request = new NextRequest(
            "http://localhost/api/tickets/55/comments",
            {
                method: "POST",
                body: JSON.stringify({ content: "Checking this issue" }),
            },
        );

        const response = await postTicketCommentRoute(request, {
            params: Promise.resolve({ id: "55" }),
        });

        expect(response.status).toBe(400);
        expect(ticketService.createTicketComment).not.toHaveBeenCalled();
    });

    it("rejects an invalid comment ticket id before authentication", async () => {
        const request = new NextRequest(
            "http://localhost/api/tickets/55junk/comments",
            {
                method: "POST",
                headers: { "Idempotency-Key": "ticket-comment-invalid-id" },
                body: JSON.stringify({ content: "Checking this issue" }),
            },
        );

        const response = await postTicketCommentRoute(request, {
            params: Promise.resolve({ id: "55junk" }),
        });

        expect(response.status).toBe(400);
        expect(getApiAuthSession).not.toHaveBeenCalled();
        expect(ticketService.createTicketComment).not.toHaveBeenCalled();
    });

    it("denies a non-admin assignee who is not the ticket owner", async () => {
        vi.mocked(getApiAuthSession).mockResolvedValue({
            user: { id: "7", role: "USER", email: "assignee@test.com" },
        } as never);
        vi.mocked(ticketService.createTicketComment).mockResolvedValue({
            outcome: "forbidden",
            replayed: false,
        });

        const req = new NextRequest("http://localhost/api/tickets/55/comments", {
            method: "POST",
            headers: { "Idempotency-Key": "ticket-comment-denied" },
            body: JSON.stringify({ content: "Checking this issue" }),
        });
        const res = await postTicketCommentRoute(req, {
            params: Promise.resolve({ id: "55" }),
        });

        expect(res.status).toBe(403);
        expect(ticketService.createTicketComment).toHaveBeenCalled();
    });
});
