import type { NotificationOutbox } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLineRetryKey } from "@/lib/services/outbox/provider-key";
import {
    buildITTicketLineEventKey,
    type ITTicketNotificationPayloadV1,
} from "../../domain/ticket-notification";

const mocks = vi.hoisted(() => ({
    createInbox: vi.fn(),
    currentWorkforce: vi.fn(),
    commentSource: vi.fn(),
    eventSource: vi.fn(),
    ticketResource: vi.fn(),
    latestAssignmentGeneration: vi.fn(),
    latestStatusGeneration: vi.fn(),
    sendAppLineNotification: vi.fn(),
    buildITTicketLiffUrl: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock("@/modules/employee", () => ({
    getCurrentWorkforceDepartmentSnapshotInTransaction: mocks.currentWorkforce,
}));
vi.mock("@/modules/notification", () => ({
    createForUserOnce: mocks.createInbox,
}));
vi.mock("@/lib/db/transaction", () => ({
    hasPrismaErrorCode: vi.fn(() => false),
    runSerializableTransaction: mocks.transaction,
}));
vi.mock("@/lib/line/app-notification", () => ({
    sendAppLineNotification: mocks.sendAppLineNotification,
}));
vi.mock("@/modules/it/application/liff-links", () => ({
    buildITTicketLiffUrl: mocks.buildITTicketLiffUrl,
}));
vi.mock("../operator-audience", () => ({
    findITOperatorAudience: vi.fn(),
}));
vi.mock("../../infrastructure/persistence/ticket-notification-repository", () => ({
    findITTicketNotificationCommentSource: mocks.commentSource,
    findITTicketNotificationEventSource: mocks.eventSource,
    findITTicketNotificationResource: mocks.ticketResource,
    findLatestITTicketAssignmentGeneration: mocks.latestAssignmentGeneration,
    findLatestITTicketStatusGeneration: mocks.latestStatusGeneration,
}));

import { dispatchITTicketNotificationOutbox } from "./dispatch";

const operatorComment: ITTicketNotificationPayloadV1 = {
    version: 1,
    event: "OPERATOR_COMMENTED",
    ticketId: 123,
    recipientUserId: 42,
    audience: "REQUESTER",
    source: { kind: "COMMENT", id: "cmr-comment-1" },
};

function buildLineOutbox(
    payload: ITTicketNotificationPayloadV1 = operatorComment,
    overrides: Partial<NotificationOutbox> = {},
): NotificationOutbox {
    const eventKey = buildITTicketLineEventKey(payload);
    return {
        id: 91,
        type: "IT_TICKET_LINE",
        eventKey,
        payload: JSON.stringify(payload),
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: new Date("2026-09-25T00:00:00.000Z"),
        lastError: null,
        createdAt: new Date("2026-09-25T00:00:00.000Z"),
        updatedAt: new Date("2026-09-25T00:00:00.000Z"),
        ...overrides,
    };
}

describe("IT requester Ticket LINE outbox dispatch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.transaction.mockImplementation(async (
            callback: (tx: object) => Promise<unknown>,
        ) => callback({}));
        mocks.commentSource.mockResolvedValue({
            id: "cmr-comment-1",
            ticketId: 123,
            authorUserId: 7,
            kind: "OPERATOR",
        });
        mocks.eventSource.mockResolvedValue({
            id: 456,
            ticketId: 123,
            actorUserId: 7,
            kind: "STATUS_CHANGED",
            toStatus: "WAITING_REQUESTER",
            toAssigneeUserId: null,
        });
        mocks.ticketResource.mockResolvedValue({
            id: 123,
            requesterUserId: 42,
            assignedToUserId: null,
            status: "OPEN",
        });
        mocks.latestAssignmentGeneration.mockResolvedValue(null);
        mocks.latestStatusGeneration.mockResolvedValue({ id: 456 });
        mocks.currentWorkforce.mockResolvedValue({ userId: 42 });
        mocks.sendAppLineNotification.mockResolvedValue({ status: "SENT" });
        mocks.buildITTicketLiffUrl.mockImplementation((ticketId: number) =>
            `https://liff.line.me/nhfapp-liff-id/it/${ticketId}`,
        );
    });

    it("ignores other outbox types and rejects malformed LINE payloads", async () => {
        await expect(dispatchITTicketNotificationOutbox({
            ...buildLineOutbox(),
            type: "EMAIL_REQUEST",
        })).resolves.toBeNull();
        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(operatorComment, { payload: "{" }),
        )).rejects.toThrow("Invalid IT_TICKET_LINE payload JSON");
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.sendAppLineNotification).not.toHaveBeenCalled();
    });

    it("rejects extra semantic payload fields and a mismatched LINE event key", async () => {
        const payloadWithPrivateText = {
            ...operatorComment,
            commentBody: "ข้อมูลส่วนตัว",
        };
        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(operatorComment, {
                payload: JSON.stringify(payloadWithPrivateText),
            }),
        )).rejects.toThrow("Invalid IT Ticket notification payload");

        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(operatorComment, {
                eventKey: "it:ticket:123:comment:other:user:42:line",
            }),
        )).rejects.toThrow("IT_TICKET_LINE event identity mismatch");
        expect(mocks.sendAppLineNotification).not.toHaveBeenCalled();
    });

    it.each([
        {
            event: "CREATED",
            audience: "OPERATOR_QUEUE",
            source: { kind: "EVENT", id: 455 },
        },
        {
            event: "ASSIGNED",
            audience: "ASSIGNEE",
            source: { kind: "EVENT", id: 456 },
        },
        {
            event: "REQUESTER_COMMENTED",
            audience: "ASSIGNEE",
            source: { kind: "COMMENT", id: "cmr-comment-1" },
        },
    ] as const)("supersedes operator-facing $event rows", async ({
        event,
        audience,
        source,
    }) => {
        const payload: ITTicketNotificationPayloadV1 = {
            ...operatorComment,
            event,
            audience,
            source,
        };

        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(payload),
        )).resolves.toBe("SUPERSEDED");

        expect(mocks.sendAppLineNotification).not.toHaveBeenCalled();
    });

    it("supersedes a source that no longer matches its Ticket or event", async () => {
        mocks.commentSource.mockResolvedValueOnce({
            id: "cmr-comment-1",
            ticketId: 999,
            authorUserId: 7,
            kind: "OPERATOR",
        });

        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(),
        )).resolves.toBe("SUPERSEDED");

        expect(mocks.sendAppLineNotification).not.toHaveBeenCalled();
    });

    it("supersedes when the durable comment kind does not match the event", async () => {
        mocks.commentSource.mockResolvedValueOnce({
            id: "cmr-comment-1",
            ticketId: 123,
            authorUserId: 7,
            kind: "REQUESTER",
        });

        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(),
        )).resolves.toBe("SUPERSEDED");

        expect(mocks.sendAppLineNotification).not.toHaveBeenCalled();
    });

    it("supersedes self-authored facts and a recipient who no longer owns the Ticket", async () => {
        mocks.commentSource.mockResolvedValueOnce({
            id: "cmr-comment-1",
            ticketId: 123,
            authorUserId: 42,
            kind: "OPERATOR",
        });
        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(),
        )).resolves.toBe("SUPERSEDED");

        mocks.commentSource.mockResolvedValueOnce({
            id: "cmr-comment-1",
            ticketId: 123,
            authorUserId: 7,
            kind: "OPERATOR",
        });
        mocks.ticketResource.mockResolvedValueOnce({
            id: 123,
            requesterUserId: 99,
            assignedToUserId: null,
            status: "OPEN",
        });
        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(),
        )).resolves.toBe("SUPERSEDED");

        expect(mocks.sendAppLineNotification).not.toHaveBeenCalled();
    });

    it("supersedes a stale WAITING_REQUESTER state generation before transport", async () => {
        const payload: ITTicketNotificationPayloadV1 = {
            ...operatorComment,
            event: "WAITING_REQUESTER",
            source: { kind: "EVENT", id: 456 },
        };
        mocks.ticketResource.mockResolvedValueOnce({
            id: 123,
            requesterUserId: 42,
            assignedToUserId: null,
            status: "WAITING_REQUESTER",
        });
        mocks.latestStatusGeneration.mockResolvedValueOnce({ id: 457 });

        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(payload),
        )).resolves.toBe("SUPERSEDED");

        expect(mocks.sendAppLineNotification).not.toHaveBeenCalled();
    });

    it("does not status-suppress an informational operator comment", async () => {
        mocks.ticketResource.mockResolvedValueOnce({
            id: 123,
            requesterUserId: 42,
            assignedToUserId: null,
            status: "CLOSED",
        });

        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(),
        )).resolves.toBe("SENT");

        expect(mocks.sendAppLineNotification).toHaveBeenCalledOnce();
    });

    it("does not status-suppress a RESOLVED fact after a later Ticket transition", async () => {
        const payload: ITTicketNotificationPayloadV1 = {
            ...operatorComment,
            event: "RESOLVED",
            source: { kind: "EVENT", id: 456 },
        };
        mocks.eventSource.mockResolvedValueOnce({
            id: 456,
            ticketId: 123,
            actorUserId: 7,
            kind: "STATUS_CHANGED",
            toStatus: "RESOLVED",
            toAssigneeUserId: null,
        });
        mocks.ticketResource.mockResolvedValueOnce({
            id: 123,
            requesterUserId: 42,
            assignedToUserId: null,
            status: "CLOSED",
        });

        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(payload),
        )).resolves.toBe("SENT");

        expect(mocks.sendAppLineNotification).toHaveBeenCalledOnce();
    });

    it.each([
        { status: "SKIPPED", reason: "UNLINKED" },
        { status: "SKIPPED", reason: "INELIGIBLE" },
    ] as const)("maps shared transport $reason to SUPERSEDED", async (result) => {
        mocks.sendAppLineNotification.mockResolvedValueOnce(result);

        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(),
        )).resolves.toBe("SUPERSEDED");
    });

    it("sends a privacy-safe Flex message to the canonical requester LIFF URL", async () => {
        const row = buildLineOutbox();

        await expect(dispatchITTicketNotificationOutbox(row)).resolves.toBe("SENT");

        const sendInput = mocks.sendAppLineNotification.mock.calls[0]?.[0];
        expect(sendInput).toMatchObject({
            userId: 42,
            retryKey: createLineRetryKey(row.eventKey ?? ""),
        });
        expect(mocks.buildITTicketLiffUrl).toHaveBeenCalledWith(123);
        expect(JSON.stringify(sendInput?.message)).toContain(
            "https://liff.line.me/nhfapp-liff-id/it/123",
        );
        expect(JSON.stringify(sendInput?.message)).not.toContain("ข้อมูลส่วนตัว");
        expect(JSON.stringify(sendInput?.message)).not.toContain("description");
        expect(JSON.stringify(sendInput?.message)).not.toContain("attachment");
        expect(JSON.stringify(sendInput?.message)).not.toContain("department");
        expect(JSON.stringify(sendInput?.message)).not.toContain("assignee");
    });

    it("uses a stable LINE retry key for repeated delivery attempts", async () => {
        const row = buildLineOutbox();

        await dispatchITTicketNotificationOutbox(row);
        await dispatchITTicketNotificationOutbox(row);

        const retryKeys = mocks.sendAppLineNotification.mock.calls.map(
            ([input]) => input.retryKey,
        );
        expect(retryKeys).toEqual([
            createLineRetryKey(row.eventKey ?? ""),
            createLineRetryKey(row.eventKey ?? ""),
        ]);
    });

    it("lets provider errors reach the shared outbox retry lifecycle", async () => {
        mocks.sendAppLineNotification.mockRejectedValueOnce(
            new Error("NHFapp LINE notification failed"),
        );

        await expect(dispatchITTicketNotificationOutbox(
            buildLineOutbox(),
        )).rejects.toThrow("NHFapp LINE notification failed");
    });
});
