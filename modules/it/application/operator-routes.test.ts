// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type * as ITModule from "@/modules/it";

const mocks = vi.hoisted(() => ({
    requireApiSession: vi.fn(),
    buildContext: vi.fn(),
    listTickets: vi.fn(),
    getTicket: vi.fn(),
    getReference: vi.fn(),
    assign: vi.fn(),
    setCategory: vi.fn(),
    transition: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({ requireApiSession: mocks.requireApiSession }));

vi.mock("@/modules/it", async (importOriginal) => {
    const actual = await importOriginal<typeof ITModule>();
    return {
        ...actual,
        buildCurrentITAuthorizationContext: mocks.buildContext,
        listITOperatorTickets: mocks.listTickets,
        getITOperatorTicket: mocks.getTicket,
        getITOperatorReferenceData: mocks.getReference,
        assignITTicket: mocks.assign,
        setITTicketCategory: mocks.setCategory,
        transitionITTicketStatus: mocks.transition,
    };
});

import { GET as getOperatorQueue } from "@/app/api/it/operator/tickets/route";
import { GET as getOperatorTicket } from "@/app/api/it/operator/tickets/[ticketId]/route";
import { GET as getOperatorReference } from "@/app/api/it/operator/reference/route";
import { PATCH as patchAssignee } from "@/app/api/it/operator/tickets/[ticketId]/assignee/route";
import { PATCH as patchCategory } from "@/app/api/it/operator/tickets/[ticketId]/category/route";
import { PATCH as patchStatus } from "@/app/api/it/operator/tickets/[ticketId]/status/route";
import {
    ITCapabilityDeniedError,
    ITTicketAssigneeNotEligibleError,
    ITTicketCategoryInactiveError,
    ITTicketCategoryNotFoundError,
    ITTicketInvalidTransitionError,
    ITTicketMutationConflictError,
    ITTicketNotFoundError,
    ITWorkforceDeniedError,
} from "@/modules/it";

const user = { id: 41, role: "USER", email: "staff@example.test", name: "Staff" };
const actorContext = {
    authorizationActor: { userId: 41, employeeId: 84, systemRole: "USER", channel: "DASHBOARD" },
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
    version: 5,
    resolvedAt: null,
    createdAt: new Date("2026-09-01T01:00:00.000Z"),
    updatedAt: new Date("2026-09-02T02:00:00.000Z"),
};

function authenticated(): void {
    mocks.requireApiSession.mockResolvedValue({ ok: true, user, session: { user } });
    mocks.buildContext.mockResolvedValue(actorContext);
}

function patchRequest(url: string, body: unknown): NextRequest {
    return new NextRequest(url, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
}

function ticketParams(ticketId: string): { params: Promise<{ ticketId: string }> } {
    return { params: Promise.resolve({ ticketId }) };
}

describe("IT operator API adapters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authenticated();
        mocks.listTickets.mockResolvedValue({ tickets: [], nextCursor: null, limit: 25 });
        mocks.getTicket.mockResolvedValue({ id: 19, version: 1 });
        mocks.getReference.mockResolvedValue({ categories: [], assignableOperators: [] });
        mocks.assign.mockResolvedValue({ ticket: ticketRecord, changed: true });
        mocks.setCategory.mockResolvedValue({ ticket: ticketRecord, changed: true });
        mocks.transition.mockResolvedValue({ ticket: ticketRecord, changed: true });
    });

    it("requires a session for queue, detail, reference, and mutations", async () => {
        mocks.requireApiSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ success: false }, { status: 401 }),
        });

        const queue = await getOperatorQueue(new NextRequest("http://localhost/api/it/operator/tickets"));
        const detail = await getOperatorTicket(
            new NextRequest("http://localhost/api/it/operator/tickets/19"),
            ticketParams("19"),
        );
        const reference = await getOperatorReference(
            new NextRequest("http://localhost/api/it/operator/reference"),
        );
        const mutation = await patchAssignee(
            patchRequest("http://localhost/api/it/operator/tickets/19/assignee", {
                assigneeUserId: null,
                expectedVersion: 1,
            }),
            ticketParams("19"),
        );

        expect([queue.status, detail.status, reference.status, mutation.status])
            .toEqual([401, 401, 401, 401]);
        expect(mocks.listTickets).not.toHaveBeenCalled();
        expect(mocks.getTicket).not.toHaveBeenCalled();
        expect(mocks.getReference).not.toHaveBeenCalled();
        expect(mocks.assign).not.toHaveBeenCalled();
    });

    it("maps denied broad reads to 403 and malformed identifiers to 400", async () => {
        mocks.listTickets.mockRejectedValueOnce(new ITCapabilityDeniedError(
            "it.ticket.read",
            "NO_APPLICABLE_GRANT",
        ));
        mocks.getTicket.mockRejectedValueOnce(new ITCapabilityDeniedError(
            "it.ticket.read",
            "NO_APPLICABLE_GRANT",
        ));
        const queueDenied = await getOperatorQueue(
            new NextRequest("http://localhost/api/it/operator/tickets"),
        );
        const detailDenied = await getOperatorTicket(
            new NextRequest("http://localhost/api/it/operator/tickets/19"),
            ticketParams("19"),
        );
        const invalidId = await getOperatorTicket(
            new NextRequest("http://localhost/api/it/operator/tickets/019"),
            ticketParams("019"),
        );

        expect(queueDenied.status).toBe(403);
        expect(detailDenied.status).toBe(403);
        expect(invalidId.status).toBe(400);
        expect(mocks.getTicket).toHaveBeenCalledTimes(1);
    });

    it("propagates only filters and never uses a caller scope as authority", async () => {
        await getOperatorQueue(new NextRequest(
            "http://localhost/api/it/operator/tickets?status=OPEN&scope=all",
        ));

        expect(mocks.listTickets).toHaveBeenCalledWith(actorContext, {
            status: "OPEN",
            scope: "all",
        });
    });

    it("keeps reference data behind read ALL", async () => {
        mocks.getReference.mockRejectedValueOnce(new ITCapabilityDeniedError(
            "it.ticket.read",
            "NO_APPLICABLE_GRANT",
        ));

        const response = await getOperatorReference(
            new NextRequest("http://localhost/api/it/operator/reference"),
        );

        expect(response.status).toBe(403);
    });

    it("returns a generic 500 without exposing unexpected error details", async () => {
        mocks.listTickets.mockRejectedValueOnce(new Error("database-secret-detail"));

        const response = await getOperatorQueue(
            new NextRequest("http://localhost/api/it/operator/tickets"),
        );
        const payload: unknown = await response.json();

        expect(response.status).toBe(500);
        expect(payload).toMatchObject({ success: false });
        expect(JSON.stringify(payload)).not.toContain("database-secret-detail");
    });

    it("maps current-workforce and manage denials to 403", async () => {
        mocks.buildContext.mockRejectedValueOnce(new ITWorkforceDeniedError());
        const inactive = await patchAssignee(
            patchRequest("http://localhost/api/it/operator/tickets/19/assignee", {
                assigneeUserId: 51,
                expectedVersion: 1,
            }),
            ticketParams("19"),
        );

        mocks.assign.mockRejectedValueOnce(new ITCapabilityDeniedError(
            "it.ticket.manage",
            "NO_APPLICABLE_GRANT",
        ));
        const noManage = await patchAssignee(
            patchRequest("http://localhost/api/it/operator/tickets/19/assignee", {
                assigneeUserId: 51,
                expectedVersion: 1,
            }),
            ticketParams("19"),
        );

        expect(inactive.status).toBe(403);
        expect(noManage.status).toBe(403);
    });

    it("rejects malformed mutation bodies and client-supplied actor or Ticket fields", async () => {
        const missingVersion = await patchAssignee(
            patchRequest("http://localhost/api/it/operator/tickets/19/assignee", {
                assigneeUserId: 51,
            }),
            ticketParams("19"),
        );
        const clientActor = await patchStatus(
            patchRequest("http://localhost/api/it/operator/tickets/19/status", {
                targetStatus: "IN_PROGRESS",
                expectedVersion: 1,
                actorUserId: 999,
            }),
            ticketParams("19"),
        );
        const bodyTicketId = await patchCategory(
            patchRequest("http://localhost/api/it/operator/tickets/19/category", {
                categoryId: 4,
                expectedVersion: 1,
                ticketId: 999,
            }),
            ticketParams("19"),
        );

        expect([missingVersion.status, clientActor.status, bodyTicketId.status])
            .toEqual([400, 400, 400]);
        expect(mocks.assign).not.toHaveBeenCalled();
        expect(mocks.transition).not.toHaveBeenCalled();
        expect(mocks.setCategory).not.toHaveBeenCalled();
    });

    it("supports assignment, reassignment, and unassignment through the IT2 command", async () => {
        const assign = await patchAssignee(
            patchRequest("http://localhost/api/it/operator/tickets/19/assignee", {
                assigneeUserId: 51,
                expectedVersion: 4,
            }),
            ticketParams("19"),
        );
        const reassign = await patchAssignee(
            patchRequest("http://localhost/api/it/operator/tickets/19/assignee", {
                assigneeUserId: 52,
                expectedVersion: 5,
            }),
            ticketParams("19"),
        );
        const unassign = await patchAssignee(
            patchRequest("http://localhost/api/it/operator/tickets/19/assignee", {
                assigneeUserId: null,
                expectedVersion: 6,
            }),
            ticketParams("19"),
        );

        expect([assign.status, reassign.status, unassign.status]).toEqual([200, 200, 200]);
        expect(mocks.assign).toHaveBeenNthCalledWith(1, actorContext, {
            ticketId: 19,
            assigneeUserId: 51,
            expectedVersion: 4,
        });
        expect(mocks.assign).toHaveBeenNthCalledWith(2, actorContext, {
            ticketId: 19,
            assigneeUserId: 52,
            expectedVersion: 5,
        });
        expect(mocks.assign).toHaveBeenNthCalledWith(3, actorContext, {
            ticketId: 19,
            assigneeUserId: null,
            expectedVersion: 6,
        });
        expect((await assign.json()).ticket).toMatchObject({ id: 19, version: 5 });
    });

    it("supports category set and clear through the IT2 command", async () => {
        const set = await patchCategory(
            patchRequest("http://localhost/api/it/operator/tickets/19/category", {
                categoryId: 4,
                expectedVersion: 4,
            }),
            ticketParams("19"),
        );
        const clear = await patchCategory(
            patchRequest("http://localhost/api/it/operator/tickets/19/category", {
                categoryId: null,
                expectedVersion: 5,
            }),
            ticketParams("19"),
        );

        expect([set.status, clear.status]).toEqual([200, 200]);
        expect(mocks.setCategory).toHaveBeenNthCalledWith(1, actorContext, {
            ticketId: 19,
            categoryId: 4,
            expectedVersion: 4,
        });
        expect(mocks.setCategory).toHaveBeenNthCalledWith(2, actorContext, {
            ticketId: 19,
            categoryId: null,
            expectedVersion: 5,
        });
    });

    it("maps approved transition failures and stale or competing writes to conflict", async () => {
        const changed = await patchStatus(
            patchRequest("http://localhost/api/it/operator/tickets/19/status", {
                targetStatus: "IN_PROGRESS",
                expectedVersion: 4,
            }),
            ticketParams("19"),
        );
        mocks.transition.mockRejectedValueOnce(new ITTicketInvalidTransitionError());
        const closed = await patchStatus(
            patchRequest("http://localhost/api/it/operator/tickets/19/status", {
                targetStatus: "CLOSED",
                expectedVersion: 5,
            }),
            ticketParams("19"),
        );
        mocks.assign.mockRejectedValueOnce(new ITTicketMutationConflictError("STALE_VERSION"));
        const stale = await patchAssignee(
            patchRequest("http://localhost/api/it/operator/tickets/19/assignee", {
                assigneeUserId: 51,
                expectedVersion: 4,
            }),
            ticketParams("19"),
        );
        mocks.transition.mockRejectedValueOnce(new ITTicketMutationConflictError("CONCURRENT_WRITE"));
        const competing = await patchStatus(
            patchRequest("http://localhost/api/it/operator/tickets/19/status", {
                targetStatus: "RESOLVED",
                expectedVersion: 4,
            }),
            ticketParams("19"),
        );

        expect([changed.status, closed.status, stale.status, competing.status])
            .toEqual([200, 409, 409, 409]);
        expect(await stale.json()).toMatchObject({
            code: "MUTATION_CONFLICT",
            reason: "STALE_VERSION",
        });
        expect(await competing.json()).toMatchObject({
            code: "MUTATION_CONFLICT",
            reason: "CONCURRENT_WRITE",
        });
        expect(mocks.transition).toHaveBeenCalledWith(actorContext, {
            ticketId: 19,
            targetStatus: "IN_PROGRESS",
            expectedVersion: 4,
        });
    });

    it("maps missing, inactive, and ineligible reference outcomes consistently", async () => {
        mocks.setCategory.mockRejectedValueOnce(new ITTicketCategoryNotFoundError());
        const missingCategory = await patchCategory(
            patchRequest("http://localhost/api/it/operator/tickets/19/category", {
                categoryId: 404,
                expectedVersion: 4,
            }),
            ticketParams("19"),
        );
        mocks.setCategory.mockRejectedValueOnce(new ITTicketCategoryInactiveError());
        const inactiveCategory = await patchCategory(
            patchRequest("http://localhost/api/it/operator/tickets/19/category", {
                categoryId: 4,
                expectedVersion: 4,
            }),
            ticketParams("19"),
        );
        mocks.assign.mockRejectedValueOnce(new ITTicketAssigneeNotEligibleError());
        const ineligible = await patchAssignee(
            patchRequest("http://localhost/api/it/operator/tickets/19/assignee", {
                assigneeUserId: 53,
                expectedVersion: 4,
            }),
            ticketParams("19"),
        );
        mocks.getTicket.mockRejectedValueOnce(new ITTicketNotFoundError());
        const missingTicket = await getOperatorTicket(
            new NextRequest("http://localhost/api/it/operator/tickets/404"),
            ticketParams("404"),
        );

        expect([missingCategory.status, inactiveCategory.status, ineligible.status, missingTicket.status])
            .toEqual([404, 409, 409, 404]);
    });
});
