// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import type * as ITModule from "@/modules/it";

const mocks = vi.hoisted(() => ({
    requireApiSession: vi.fn(),
    buildContext: vi.fn(),
    setPriority: vi.fn(),
    transitionStatus: vi.fn(),
    assign: vi.fn(),
    setCategory: vi.fn(),
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
        transitionITTicketStatus: mocks.transitionStatus,
        assignITTicket: mocks.assign,
        setITTicketCategory: mocks.setCategory,
    };
});

import { PATCH as patchPriority } from "@/app/api/it/operator/tickets/[ticketId]/priority/route";
import { PATCH as patchStatus } from "@/app/api/it/operator/tickets/[ticketId]/status/route";
import { PATCH as patchAssignee } from "@/app/api/it/operator/tickets/[ticketId]/assignee/route";
import { PATCH as patchCategory } from "@/app/api/it/operator/tickets/[ticketId]/category/route";
import {
    ITCapabilityDeniedError,
    ITTicketMutationConflictError,
    ITTicketPriorityTerminalError,
} from "@/modules/it";

const user = { id: 51, role: "USER", email: "operator@example.test", name: "Operator" };
const context = {
    authorizationActor: { userId: 51, employeeId: 91, systemRole: "USER", channel: "DASHBOARD" },
};
const ticket = {
    id: 19,
    type: "INCIDENT" as const,
    priority: "P0" as const,
    triagedAt: new Date("2026-11-06T03:00:00.000Z"),
    triagedByUserId: 51,
    title: "ระบบใช้งานไม่ได้",
    description: "รายละเอียดปัญหา",
    status: "IN_PROGRESS" as const,
    requesterUserId: 41,
    assignedToUserId: null,
    categoryId: null,
    requesterDepartmentId: 9,
    requesterDepartmentNameSnapshot: "แผนกตัวอย่าง",
    version: 3,
    resolvedAt: null,
    createdAt: new Date("2026-11-06T02:00:00.000Z"),
    updatedAt: new Date("2026-11-06T03:00:00.000Z"),
};

type Handler = (
    request: NextRequest,
    routeContext: { readonly params: Promise<{ readonly ticketId: string }> },
) => Promise<NextResponse>;

async function call(handler: Handler, path: string, body: unknown): Promise<NextResponse> {
    return handler(
        new NextRequest(`http://localhost/api/it/operator/tickets/19/${path}`, {
            method: "PATCH",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
        }),
        { params: Promise.resolve({ ticketId: "19" }) },
    );
}

describe("IT operator mutation outbox wakeup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireApiSession.mockResolvedValue({ ok: true, user, session: { user } });
        mocks.buildContext.mockResolvedValue(context);
    });

    describe("priority", () => {
        const escalate = { priority: "P0", reason: "ระบบหลักล่มทั้งองค์กร", expectedVersion: 2 };

        it("wakes the outbox once after a committed escalation enqueued intents", async () => {
            mocks.setPriority.mockResolvedValueOnce({
                ticket, changed: true, notificationIntentsEnqueued: true,
            });

            const response = await call(patchPriority, "priority", escalate);

            expect(response.status).toBe(200);
            expect(mocks.wakeOutbox).toHaveBeenCalledTimes(1);
            expect(await response.json()).not.toHaveProperty("notificationIntentsEnqueued");
        });

        it("does not wake for a no-op confirmation", async () => {
            mocks.setPriority.mockResolvedValueOnce({ ticket, changed: false });

            expect((await call(patchPriority, "priority", { priority: "P0", expectedVersion: 3 })).status)
                .toBe(200);
            expect(mocks.wakeOutbox).not.toHaveBeenCalled();
        });

        it("does not wake for a committed change without escalation intents", async () => {
            // Downgrades, first triage, and escalations with no eligible recipient.
            mocks.setPriority.mockResolvedValueOnce({
                ticket: { ...ticket, priority: "P2" as const },
                changed: true,
                notificationIntentsEnqueued: false,
            });
            await call(patchPriority, "priority", { priority: "P2", reason: "ลดระดับ", expectedVersion: 2 });

            mocks.setPriority.mockResolvedValueOnce({ ticket, changed: true });
            await call(patchPriority, "priority", escalate);

            expect(mocks.wakeOutbox).not.toHaveBeenCalled();
        });

        it("does not wake when the mutation is rejected or its transaction fails", async () => {
            mocks.setPriority
                .mockRejectedValueOnce(new ITCapabilityDeniedError("it.ticket.manage", "NO_APPLICABLE_GRANT"))
                .mockRejectedValueOnce(new ITTicketMutationConflictError("STALE_VERSION"))
                .mockRejectedValueOnce(new ITTicketPriorityTerminalError())
                .mockRejectedValueOnce(new Error("outbox insert failed; transaction rolled back"));

            expect((await call(patchPriority, "priority", escalate)).status).toBe(403);
            expect((await call(patchPriority, "priority", escalate)).status).toBe(409);
            expect((await call(patchPriority, "priority", escalate)).status).toBe(409);
            expect((await call(patchPriority, "priority", escalate)).status).toBe(500);
            expect(mocks.wakeOutbox).not.toHaveBeenCalled();
        });

        it("does not wake for an invalid body before any command runs", async () => {
            expect((await call(patchPriority, "priority", { priority: "P0" })).status).toBe(400);
            expect(mocks.setPriority).not.toHaveBeenCalled();
            expect(mocks.wakeOutbox).not.toHaveBeenCalled();
        });
    });

    describe("existing status and assignment behavior", () => {
        it("wakes only for WAITING_REQUESTER and RESOLVED transitions", async () => {
            mocks.transitionStatus.mockResolvedValue({ ticket, changed: true });

            await call(patchStatus, "status", { targetStatus: "WAITING_REQUESTER", expectedVersion: 2 });
            await call(patchStatus, "status", { targetStatus: "RESOLVED", expectedVersion: 2 });
            expect(mocks.wakeOutbox).toHaveBeenCalledTimes(2);

            mocks.wakeOutbox.mockClear();
            await call(patchStatus, "status", { targetStatus: "IN_PROGRESS", expectedVersion: 2 });
            await call(patchStatus, "status", { targetStatus: "CANCELLED", expectedVersion: 2 });
            expect(mocks.wakeOutbox).not.toHaveBeenCalled();
        });

        it("wakes only when another operator is assigned", async () => {
            mocks.assign.mockResolvedValue({ ticket, changed: true });

            await call(patchAssignee, "assignee", { assigneeUserId: 52, expectedVersion: 2 });
            expect(mocks.wakeOutbox).toHaveBeenCalledTimes(1);

            mocks.wakeOutbox.mockClear();
            await call(patchAssignee, "assignee", { assigneeUserId: 51, expectedVersion: 2 });
            await call(patchAssignee, "assignee", { assigneeUserId: null, expectedVersion: 2 });
            mocks.assign.mockResolvedValueOnce({ ticket, changed: false });
            await call(patchAssignee, "assignee", { assigneeUserId: 52, expectedVersion: 2 });
            expect(mocks.wakeOutbox).not.toHaveBeenCalled();
        });

        it("never wakes for category changes", async () => {
            mocks.setCategory.mockResolvedValue({ ticket, changed: true });

            await call(patchCategory, "category", { categoryId: 3, expectedVersion: 2 });
            expect(mocks.wakeOutbox).not.toHaveBeenCalled();
        });
    });
});
