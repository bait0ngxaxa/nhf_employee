// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type * as ITModule from "@/modules/it";

const mocks = vi.hoisted(() => ({
    requireApiSession: vi.fn(),
    buildContext: vi.fn(),
    setPriority: vi.fn(),
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
        setITTicketPriority: mocks.setPriority,
    };
});

import { PATCH as patchPriority } from "@/app/api/it/operator/tickets/[ticketId]/priority/route";
import {
    ITCapabilityDeniedError,
    ITTicketInputValidationError,
    ITTicketMutationConflictError,
    ITTicketPriorityTerminalError,
} from "@/modules/it";

const user = { id: 51, role: "USER", email: "operator@example.test", name: "Operator" };
const context = {
    authorizationActor: {
        userId: 51,
        employeeId: 91,
        systemRole: "USER",
        channel: "DASHBOARD",
    },
};
const ticket = {
    id: 19,
    type: "INCIDENT" as const,
    priority: "P1" as const,
    triagedAt: new Date("2026-11-06T03:00:00.000Z"),
    triagedByUserId: 51,
    title: "ระบบใช้งานไม่ได้",
    description: "รายละเอียดปัญหา",
    status: "OPEN" as const,
    requesterUserId: 41,
    assignedToUserId: null,
    categoryId: null,
    requesterDepartmentId: 9,
    requesterDepartmentNameSnapshot: "แผนกตัวอย่าง",
    version: 2,
    resolvedAt: null,
    createdAt: new Date("2026-11-06T02:00:00.000Z"),
    updatedAt: new Date("2026-11-06T03:00:00.000Z"),
};

function request(body: unknown): NextRequest {
    return new NextRequest("http://localhost/api/it/operator/tickets/19/priority", {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
}

async function patch(body: unknown, ticketId = "19"): Promise<NextResponse> {
    return patchPriority(request(body), { params: Promise.resolve({ ticketId }) });
}

describe("IT operator Ticket priority API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireApiSession.mockResolvedValue({ ok: true, user, session: { user } });
        mocks.buildContext.mockResolvedValue(context);
        mocks.setPriority.mockResolvedValue({ ticket, changed: true });
    });

    it("requires a session and an operator-only valid priority body", async () => {
        mocks.requireApiSession.mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ success: false }, { status: 401 }),
        });
        expect((await patch({ priority: "P1", expectedVersion: 1 })).status).toBe(401);

        expect((await patch({ priority: "P4", expectedVersion: 1 })).status).toBe(400);
        expect((await patch({ priority: "P1", expectedVersion: 1, requesterUserId: 41 })).status)
            .toBe(400);
        expect((await patch({ priority: "P1", reason: "   ", expectedVersion: 1 })).status)
            .toBe(400);
        expect((await patch({ priority: "P1", expectedVersion: 0 })).status).toBe(400);
        expect((await patch({ priority: "P1", expectedVersion: 1 }, "01")).status).toBe(400);
        expect(mocks.setPriority).not.toHaveBeenCalled();
    });

    it("forwards the canonical command and returns the persisted mutation snapshot", async () => {
        const response = await patch({
            priority: "P1",
            reason: "ระบบสำคัญขัดข้องหลายหน่วยงาน",
            expectedVersion: 1,
        });

        expect(response.status).toBe(200);
        expect(mocks.setPriority).toHaveBeenCalledWith(
            context,
            {
                priority: "P1",
                reason: "ระบบสำคัญขัดข้องหลายหน่วยงาน",
                expectedVersion: 1,
                ticketId: 19,
            },
            expect.objectContaining({
                userEmail: user.email,
                requestId: expect.any(String),
                correlationId: expect.any(String),
            }),
        );
        expect(await response.json()).toMatchObject({
            success: true,
            changed: true,
            ticket: {
                id: 19,
                version: 2,
                priority: "P1",
                triagedAt: "2026-11-06T03:00:00.000Z",
                triagedByUserId: 51,
                isTriaged: true,
                status: "OPEN",
            },
        });
        expect(mocks.wakeOutbox).not.toHaveBeenCalled();
    });

    it("maps missing manage authority, stale versions, and terminal tickets to safe responses", async () => {
        mocks.setPriority.mockRejectedValueOnce(new ITCapabilityDeniedError(
            "it.ticket.manage",
            "NO_APPLICABLE_GRANT",
        ));
        expect((await patch({ priority: "P1", expectedVersion: 1 })).status).toBe(403);

        mocks.setPriority.mockRejectedValueOnce(new ITTicketMutationConflictError("STALE_VERSION"));
        expect((await patch({ priority: "P1", expectedVersion: 1 })).status).toBe(409);

        mocks.setPriority.mockRejectedValueOnce(new ITTicketPriorityTerminalError());
        expect((await patch({ priority: "P1", expectedVersion: 1 })).status).toBe(409);

        mocks.setPriority.mockRejectedValueOnce(new ITTicketInputValidationError());
        expect((await patch({ priority: "P1", expectedVersion: 1 })).status).toBe(400);
    });
});
