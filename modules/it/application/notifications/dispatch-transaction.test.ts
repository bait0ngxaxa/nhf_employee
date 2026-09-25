import { Prisma, type NotificationOutbox } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn<(
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
    ) => Promise<unknown>>(),
    createForUserOnce: vi.fn(),
    findITOperatorAudience: vi.fn(),
    findITTicketNotificationEventSource: vi.fn(),
    findITTicketNotificationCommentSource: vi.fn(),
    findITTicketNotificationResource: vi.fn(),
    findLatestITTicketAssignmentGeneration: vi.fn(),
    findLatestITTicketStatusGeneration: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: { $transaction: mocks.transaction },
}));
vi.mock("@/modules/notification", () => ({
    createForUserOnce: mocks.createForUserOnce,
}));
vi.mock("@/modules/employee", () => ({
    getCurrentWorkforceDepartmentSnapshotInTransaction: vi.fn(),
}));
vi.mock("../operator-audience", () => ({
    findITOperatorAudience: mocks.findITOperatorAudience,
}));
vi.mock("../../infrastructure/persistence/ticket-notification-repository", () => ({
    findITTicketNotificationEventSource:
        mocks.findITTicketNotificationEventSource,
    findITTicketNotificationCommentSource:
        mocks.findITTicketNotificationCommentSource,
    findITTicketNotificationResource:
        mocks.findITTicketNotificationResource,
    findLatestITTicketAssignmentGeneration:
        mocks.findLatestITTicketAssignmentGeneration,
    findLatestITTicketStatusGeneration:
        mocks.findLatestITTicketStatusGeneration,
}));

import { dispatchITTicketNotificationOutbox } from "./dispatch";

function buildAssignmentOutbox(): NotificationOutbox {
    const now = new Date("2026-09-25T00:00:00.000Z");
    return {
        id: 91,
        type: "IT_TICKET_IN_APP",
        eventKey: "it:ticket:123:event:456:user:42:in-app",
        payload: JSON.stringify({
            version: 1,
            event: "ASSIGNED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "ASSIGNEE",
            source: { kind: "EVENT", id: 456 },
        }),
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: now,
        lastError: null,
        createdAt: now,
        updatedAt: now,
    };
}

describe("IT Ticket notification dispatch transaction boundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.transaction.mockImplementation(async (callback) =>
            callback({} as Prisma.TransactionClient),
        );
        mocks.findITTicketNotificationEventSource.mockResolvedValue({
            id: 456,
            ticketId: 123,
            actorUserId: 7,
            kind: "ASSIGNED",
            toStatus: null,
            toAssigneeUserId: 42,
        });
        mocks.findITTicketNotificationResource.mockResolvedValue({
            id: 123,
            requesterUserId: 7,
            assignedToUserId: 42,
            status: "OPEN",
        });
        mocks.findLatestITTicketAssignmentGeneration.mockResolvedValue({ id: 456 });
        mocks.findITOperatorAudience.mockResolvedValue([{ userId: 42 }]);
        mocks.createForUserOnce.mockResolvedValue({ id: 1 });
    });

    it("uses the shared Serializable transaction boundary for validation and Inbox creation", async () => {
        await expect(dispatchITTicketNotificationOutbox(buildAssignmentOutbox()))
            .resolves.toBe("SENT");

        expect(mocks.transaction).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            }),
        );
        expect(mocks.createForUserOnce).toHaveBeenCalledOnce();
    });
});
