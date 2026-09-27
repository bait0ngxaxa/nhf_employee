import type { NotificationOutbox } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    buildITTicketEmailEventKey,
    type ITTicketNotificationPayloadV1,
} from "../../domain/ticket-notification";

const mocks = vi.hoisted(() => ({
    sendEmail: vi.fn(),
    sendLine: vi.fn(),
    createInbox: vi.fn(),
    transaction: vi.fn(),
    currentWorkforce: vi.fn(),
    eventSource: vi.fn(),
    commentSource: vi.fn(),
    ticketResource: vi.fn(),
    latestAssignment: vi.fn(),
    latestStatus: vi.fn(),
    recipientEmail: vi.fn(),
    operatorAudience: vi.fn(),
}));

vi.mock("@/modules/employee", () => ({
    getCurrentWorkforceDepartmentSnapshotInTransaction: mocks.currentWorkforce,
}));
vi.mock("@/modules/notification", () => ({ createForUserOnce: mocks.createInbox }));
vi.mock("@/lib/line/app-notification", () => ({
    sendAppLineNotification: mocks.sendLine,
}));
vi.mock("@/lib/db/transaction", () => ({
    hasPrismaErrorCode: vi.fn(() => false),
    runSerializableTransaction: mocks.transaction,
}));
vi.mock("../operator-audience", () => ({
    findITOperatorAudience: mocks.operatorAudience,
}));
vi.mock("../../infrastructure/notifications/ticket-email", () => ({
    sendITTicketEmailNotification: mocks.sendEmail,
}));
vi.mock("../../infrastructure/persistence/ticket-notification-repository", () => ({
    findITTicketNotificationCommentSource: mocks.commentSource,
    findITTicketNotificationEventSource: mocks.eventSource,
    findITTicketNotificationRecipientEmail: mocks.recipientEmail,
    findITTicketNotificationResource: mocks.ticketResource,
    findLatestITTicketAssignmentGeneration: mocks.latestAssignment,
    findLatestITTicketStatusGeneration: mocks.latestStatus,
}));

import { dispatchITTicketNotificationOutbox } from "./dispatch";

const assignedPayload: ITTicketNotificationPayloadV1 = {
    version: 1,
    event: "ASSIGNED",
    ticketId: 123,
    recipientUserId: 42,
    audience: "ASSIGNEE",
    source: { kind: "EVENT", id: 456 },
};

function buildEmailOutbox(
    payload: ITTicketNotificationPayloadV1 = assignedPayload,
    overrides: Partial<NotificationOutbox> = {},
): NotificationOutbox {
    const now = new Date("2026-09-25T00:00:00.000Z");
    return {
        id: 91,
        type: "IT_TICKET_EMAIL",
        eventKey: buildITTicketEmailEventKey(payload),
        payload: JSON.stringify(payload),
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: now,
        lastError: null,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

describe("IT Ticket Email outbox dispatch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.transaction.mockImplementation(async (
            operation: (tx: object) => Promise<unknown>,
        ) => operation({}));
        mocks.eventSource.mockResolvedValue({
            id: 456,
            ticketId: 123,
            actorUserId: 7,
            kind: "ASSIGNED",
            toStatus: null,
            toAssigneeUserId: 42,
        });
        mocks.commentSource.mockResolvedValue({
            id: "cmr-comment-1",
            ticketId: 123,
            authorUserId: 7,
            kind: "REQUESTER",
        });
        mocks.ticketResource.mockResolvedValue({
            id: 123,
            requesterUserId: 99,
            assignedToUserId: 42,
            status: "OPEN",
        });
        mocks.latestAssignment.mockResolvedValue({ id: 456 });
        mocks.latestStatus.mockResolvedValue({ id: 456 });
        mocks.currentWorkforce.mockResolvedValue({ userId: 99 });
        mocks.recipientEmail.mockResolvedValue(" Operator@Example.com ");
        mocks.operatorAudience.mockResolvedValue([{ userId: 42 }]);
        mocks.sendEmail.mockResolvedValue(true);
        mocks.sendLine.mockResolvedValue({ status: "SENT" });
    });

    it("uses the current User email and the shared assignment applicability policy", async () => {
        const row = buildEmailOutbox();

        await expect(dispatchITTicketNotificationOutbox(row)).resolves.toBe("SENT");

        expect(mocks.recipientEmail).toHaveBeenCalledWith(expect.anything(), 42);
        expect(mocks.sendEmail).toHaveBeenCalledWith(
            assignedPayload,
            "operator@example.com",
            row.eventKey,
        );
        expect(mocks.createInbox).not.toHaveBeenCalled();
        expect(mocks.sendLine).not.toHaveBeenCalled();
    });

    it("supersedes stale assignment generations without sending Email", async () => {
        mocks.latestAssignment.mockResolvedValueOnce({ id: 457 });

        await expect(dispatchITTicketNotificationOutbox(buildEmailOutbox()))
            .resolves.toBe("SUPERSEDED");

        expect(mocks.sendEmail).not.toHaveBeenCalled();
        expect(mocks.recipientEmail).not.toHaveBeenCalled();
    });

    it("supersedes an assignee comment notification after reassignment", async () => {
        const payload: ITTicketNotificationPayloadV1 = {
            ...assignedPayload,
            event: "REQUESTER_COMMENTED",
            audience: "ASSIGNEE",
            source: { kind: "COMMENT", id: "cmr-comment-1" },
        };
        mocks.ticketResource.mockResolvedValueOnce({
            id: 123,
            requesterUserId: 99,
            assignedToUserId: 43,
            status: "OPEN",
        });

        await expect(dispatchITTicketNotificationOutbox(buildEmailOutbox(payload)))
            .resolves.toBe("SUPERSEDED");

        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it("supersedes stale WAITING_REQUESTER generations consistently", async () => {
        const payload: ITTicketNotificationPayloadV1 = {
            ...assignedPayload,
            event: "WAITING_REQUESTER",
            recipientUserId: 99,
            audience: "REQUESTER",
            source: { kind: "EVENT", id: 456 },
        };
        mocks.eventSource.mockResolvedValueOnce({
            id: 456,
            ticketId: 123,
            actorUserId: 7,
            kind: "STATUS_CHANGED",
            toStatus: "WAITING_REQUESTER",
            toAssigneeUserId: null,
        });
        mocks.ticketResource.mockResolvedValueOnce({
            id: 123,
            requesterUserId: 99,
            assignedToUserId: null,
            status: "WAITING_REQUESTER",
        });
        mocks.latestStatus.mockResolvedValueOnce({ id: 457 });

        await expect(dispatchITTicketNotificationOutbox(buildEmailOutbox(payload)))
            .resolves.toBe("SUPERSEDED");

        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it("supersedes ineligible operators and invalid or unavailable account email", async () => {
        mocks.operatorAudience.mockResolvedValueOnce([]);
        await expect(dispatchITTicketNotificationOutbox(buildEmailOutbox()))
            .resolves.toBe("SUPERSEDED");

        mocks.operatorAudience.mockResolvedValueOnce([{ userId: 42 }]);
        mocks.recipientEmail.mockResolvedValueOnce("bad\r\n@example.com");
        await expect(dispatchITTicketNotificationOutbox(buildEmailOutbox()))
            .resolves.toBe("SUPERSEDED");

        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it("lets Email provider failures reach only the Email row retry lifecycle", async () => {
        mocks.sendEmail.mockRejectedValueOnce(new Error("SMTP unavailable"));

        await expect(dispatchITTicketNotificationOutbox(buildEmailOutbox()))
            .rejects.toThrow("SMTP unavailable");

        expect(mocks.createInbox).not.toHaveBeenCalled();
        expect(mocks.sendLine).not.toHaveBeenCalled();
    });

    it("rejects a channel event key that does not match the semantic source", async () => {
        await expect(dispatchITTicketNotificationOutbox(buildEmailOutbox(
            assignedPayload,
            { eventKey: "it:ticket:123:event:999:user:42:email" },
        ))).rejects.toThrow("IT_TICKET_EMAIL event identity mismatch");
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });
});
