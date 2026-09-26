// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type * as ITModule from "@/modules/it";

const mocks = vi.hoisted(() => ({
    requireApiSession: vi.fn(),
    buildContext: vi.fn(),
    createTicket: vi.fn(),
    listTickets: vi.fn(),
    getTicket: vi.fn(),
    wakeOutbox: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireApiSession: mocks.requireApiSession,
}));
vi.mock("@/lib/server/it-ticket-outbox-wakeup", () => ({
    scheduleITTicketOutboxWakeup: mocks.wakeOutbox,
}));

vi.mock("@/modules/it", async (importOriginal) => {
    const actual = await importOriginal<typeof ITModule>();
    return {
        ...actual,
        buildCurrentITAuthorizationContext: mocks.buildContext,
        createITTicket: mocks.createTicket,
        listITRequesterTickets: mocks.listTickets,
        getITRequesterTicket: mocks.getTicket,
    };
});

import { GET as getTicketDetail } from "@/app/api/it/tickets/[ticketId]/route";
import { GET as getTicketList, POST as postTicket } from "@/app/api/it/tickets/route";
import {
    ITCapabilityDeniedError,
    ITTicketIdempotencyConflictError,
    ITTicketInputValidationError,
    ITTicketNotFoundError,
} from "@/modules/it";

const user = { id: 41, role: "USER", email: "staff@example.test", name: "Staff" };
const actorContext = {
    authorizationActor: {
        userId: 41,
        employeeId: 84,
        systemRole: "USER",
        channel: "DASHBOARD",
    },
};
const ticketRecord = {
    id: 19,
    type: "INCIDENT" as const,
    title: "เข้าใช้งานระบบไม่ได้",
    description: "หน้าเข้าสู่ระบบแสดงข้อผิดพลาด",
    status: "OPEN" as const,
    requesterUserId: 41,
    assignedToUserId: null,
    categoryId: null,
    requesterDepartmentId: 9,
    requesterDepartmentNameSnapshot: "แผนกตัวอย่าง",
    version: 1,
    resolvedAt: null,
    createdAt: new Date("2026-09-01T01:00:00.000Z"),
    updatedAt: new Date("2026-09-01T01:00:00.000Z"),
};

function authenticated(): void {
    mocks.requireApiSession.mockResolvedValue({ ok: true, user, session: { user } });
    mocks.buildContext.mockResolvedValue(actorContext);
}

function postRequest(body: unknown, idempotencyKey?: string): NextRequest {
    return new NextRequest("http://localhost/api/it/tickets", {
        method: "POST",
        body: JSON.stringify(body),
        headers: idempotencyKey === undefined
            ? { "Content-Type": "application/json" }
            : { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    });
}

describe("IT requester Ticket API adapters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authenticated();
        mocks.createTicket.mockResolvedValue({ ticket: ticketRecord, replayed: false });
        mocks.listTickets.mockResolvedValue({
            tickets: [{ id: 19, type: "INCIDENT", title: ticketRecord.title }],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        });
        mocks.getTicket.mockResolvedValue({
            id: 19,
            type: "INCIDENT",
            title: ticketRecord.title,
            description: ticketRecord.description,
            status: "OPEN",
            createdAt: ticketRecord.createdAt.toISOString(),
            updatedAt: ticketRecord.updatedAt.toISOString(),
            resolvedAt: null,
        });
    });

    it("returns 401 when there is no authenticated session", async () => {
        mocks.requireApiSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ success: false }, { status: 401 }),
        });

        const response = await postTicket(postRequest({
            type: "INCIDENT",
            title: "หัวข้อ",
            description: "รายละเอียด",
        }, "retry-key"));

        expect(response.status).toBe(401);
        expect(mocks.createTicket).not.toHaveBeenCalled();
    });

    it("rejects requester-owned fields instead of accepting client-selected ownership", async () => {
        const response = await postTicket(postRequest({
            type: "INCIDENT",
            title: "หัวข้อ",
            description: "รายละเอียด",
            requesterUserId: 777,
        }, "retry-key"));

        expect(response.status).toBe(400);
        expect(mocks.createTicket).not.toHaveBeenCalled();
    });

    it("creates for the authenticated actor and returns only the requester DTO", async () => {
        const response = await postTicket(postRequest({
            type: "INCIDENT",
            title: "  เข้าใช้งานระบบไม่ได้  ",
            description: "  หน้าเข้าสู่ระบบแสดงข้อผิดพลาด  ",
        }, "same-logical-attempt"));
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(mocks.createTicket).toHaveBeenCalledWith(
            actorContext,
            {
                type: "INCIDENT",
                title: "เข้าใช้งานระบบไม่ได้",
                description: "หน้าเข้าสู่ระบบแสดงข้อผิดพลาด",
            },
            { idempotencyKey: "same-logical-attempt" },
        );
        expect(body.ticket).toMatchObject({ id: 19, status: "OPEN" });
        expect(body.ticket).not.toHaveProperty("requesterUserId");
        expect(body.ticket).not.toHaveProperty("version");
        expect(body.ticket).not.toHaveProperty("assignedToUserId");
        expect(mocks.wakeOutbox).toHaveBeenCalledTimes(1);
    });

    it("does not wake the outbox for an idempotent creation replay", async () => {
        mocks.createTicket.mockResolvedValueOnce({ ticket: ticketRecord, replayed: true });

        const response = await postTicket(postRequest({
            type: "INCIDENT",
            title: "หัวข้อ",
            description: "รายละเอียด",
        }, "same-logical-attempt"));

        expect(response.status).toBe(200);
        expect(mocks.wakeOutbox).not.toHaveBeenCalled();
    });

    it("requires a valid Idempotency-Key before calling the creation command", async () => {
        const response = await postTicket(postRequest({
            type: "INCIDENT",
            title: "หัวข้อ",
            description: "รายละเอียด",
        }));

        expect(response.status).toBe(400);
        expect(mocks.createTicket).not.toHaveBeenCalled();
    });

    it("preserves replay status and maps reused-key payload conflicts to 409", async () => {
        mocks.createTicket.mockResolvedValueOnce({ ticket: ticketRecord, replayed: true });
        const replay = await postTicket(postRequest({
            type: "INCIDENT",
            title: "หัวข้อ",
            description: "รายละเอียด",
        }, "same-logical-attempt"));
        expect(replay.status).toBe(200);
        expect((await replay.json()).replayed).toBe(true);

        mocks.createTicket.mockRejectedValueOnce(new ITTicketIdempotencyConflictError());
        const conflict = await postTicket(postRequest({
            type: "INCIDENT",
            title: "หัวข้อที่เปลี่ยน",
            description: "รายละเอียด",
        }, "same-logical-attempt"));
        expect(conflict.status).toBe(409);
    });

    it("returns a bounded requester list and validates pagination", async () => {
        const response = await getTicketList(new NextRequest(
            "http://localhost/api/it/tickets?page=2&limit=5",
        ));
        expect(response.status).toBe(200);
        expect(mocks.listTickets).toHaveBeenCalledWith(actorContext, {
            page: "2",
            limit: "5",
        });

        mocks.listTickets.mockRejectedValueOnce(new ITTicketInputValidationError());
        const invalid = await getTicketList(new NextRequest(
            "http://localhost/api/it/tickets?page=1&limit=101",
        ));
        expect(invalid.status).toBe(400);
    });

    it("denies missing read capability", async () => {
        mocks.listTickets.mockRejectedValueOnce(new ITCapabilityDeniedError(
            "it.ticket.read",
            "NO_APPLICABLE_GRANT",
        ));
        const denied = await getTicketList(new NextRequest("http://localhost/api/it/tickets"));
        expect(denied.status).toBe(403);
    });

    it("maps inaccessible Tickets to the same 404 and rejects malformed identifiers", async () => {
        mocks.getTicket.mockRejectedValueOnce(new ITTicketNotFoundError());
        const hidden = await getTicketDetail(
            new NextRequest("http://localhost/api/it/tickets/20"),
            { params: Promise.resolve({ ticketId: "20" }) },
        );
        expect(hidden.status).toBe(404);

        const invalid = await getTicketDetail(
            new NextRequest("http://localhost/api/it/tickets/01"),
            { params: Promise.resolve({ ticketId: "01" }) },
        );
        expect(invalid.status).toBe(400);
        expect(mocks.getTicket).toHaveBeenCalledTimes(1);
    });
});
