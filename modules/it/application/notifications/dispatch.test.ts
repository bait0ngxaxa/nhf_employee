import type { NotificationOutbox } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createInbox: vi.fn(),
    currentWorkforce: vi.fn(),
    commentSource: vi.fn(),
    ticketResource: vi.fn(),
}));

vi.mock("@/modules/employee", () => ({
    getCurrentWorkforceDepartmentSnapshotInTransaction: mocks.currentWorkforce,
}));
vi.mock("@/modules/notification", () => ({
    createForUserOnce: mocks.createInbox,
}));
vi.mock("@/lib/db/transaction", () => ({
    hasPrismaErrorCode: vi.fn(() => false),
    runSerializableTransaction: vi.fn(async (
        operation: (tx: object) => Promise<unknown>,
    ) => operation({})),
}));
vi.mock("../operator-audience", () => ({
    findITOperatorAudience: vi.fn(),
}));
vi.mock("../../infrastructure/persistence/ticket-notification-repository", () => ({
    findITTicketNotificationCommentSource: mocks.commentSource,
    findITTicketNotificationEventSource: vi.fn(),
    findITTicketNotificationResource: mocks.ticketResource,
    findLatestITTicketAssignmentGeneration: vi.fn(),
    findLatestITTicketStatusGeneration: vi.fn(),
}));

import { dispatchITTicketNotificationOutbox } from "./dispatch";

function buildOutbox(payload: string): NotificationOutbox {
    const now = new Date("2026-09-25T00:00:00.000Z");
    return {
        id: 91,
        type: "IT_TICKET_IN_APP",
        eventKey: "it:ticket:123:comment:cmr-comment:user:42:in-app",
        payload,
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: now,
        lastError: null,
        createdAt: now,
        updatedAt: now,
    };
}

describe("IT Ticket notification dispatch payload boundary", () => {
    it("rejects malformed JSON without entering persistence", async () => {
        await expect(dispatchITTicketNotificationOutbox(
            buildOutbox("{"),
        )).rejects.toThrow("Invalid IT_TICKET_IN_APP payload JSON");
    });

    it("rejects extra comment or authorization state before delivery", async () => {
        await expect(dispatchITTicketNotificationOutbox(buildOutbox(JSON.stringify({
            version: 1,
            event: "OPERATOR_COMMENTED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "REQUESTER",
            source: { kind: "COMMENT", id: "cmr-comment" },
            body: "ข้อความส่วนตัว",
        })))).rejects.toThrow("Invalid IT_TICKET_IN_APP payload");
    });

    it("rejects an event key that does not identify the parsed business fact", async () => {
        const row = {
            ...buildOutbox(JSON.stringify({
                version: 1,
                event: "OPERATOR_COMMENTED",
                ticketId: 123,
                recipientUserId: 42,
                audience: "REQUESTER",
                source: { kind: "COMMENT", id: "cmr-comment" },
            })),
            eventKey: "it:ticket:123:comment:another-comment:user:42:in-app",
        };

        await expect(dispatchITTicketNotificationOutbox(row)).rejects.toThrow(
            "IT_TICKET_IN_APP event identity mismatch",
        );
    });

    it("keeps requester Inbox actions on Dashboard Ticket detail", async () => {
        mocks.commentSource.mockResolvedValueOnce({
            ticketId: 123,
            kind: "OPERATOR",
            authorUserId: 7,
        });
        mocks.ticketResource.mockResolvedValueOnce({
            requesterUserId: 42,
            assignedToUserId: null,
            status: "OPEN",
        });
        mocks.currentWorkforce.mockResolvedValueOnce({ userId: 42 });

        const payload = {
            version: 1,
            event: "OPERATOR_COMMENTED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "REQUESTER",
            source: { kind: "COMMENT", id: "cmr-comment" },
        };

        await expect(dispatchITTicketNotificationOutbox(
            buildOutbox(JSON.stringify(payload)),
        )).resolves.toBe("SENT");

        expect(mocks.createInbox.mock.calls[0]?.[0]).toMatchObject({
            userId: 42,
            type: "IT_TICKET",
            actionUrl: "/dashboard/it/123",
        });
    });
});
