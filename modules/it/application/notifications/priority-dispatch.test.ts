import type { ITTicketPriority, ITTicketStatus, NotificationOutbox } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    buildITTicketEmailEventKey,
    buildITTicketLineEventKey,
    buildITTicketNotificationEventKey,
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
    latestPriority: vi.fn(),
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
    findLatestITTicketPriorityGeneration: mocks.latestPriority,
    findLatestITTicketStatusGeneration: mocks.latestStatus,
}));

import { dispatchITTicketNotificationOutbox } from "./dispatch";

type Channel = "IT_TICKET_IN_APP" | "IT_TICKET_EMAIL" | "IT_TICKET_LINE";
const CHANNELS: readonly Channel[] = ["IT_TICKET_IN_APP", "IT_TICKET_EMAIL", "IT_TICKET_LINE"];

const TICKET_ID = 123;
const ACTOR_ID = 7;
const RECIPIENT_ID = 42;

function escalation(
    priority: "P0" | "P1",
    sourceId: number,
    audience: "ASSIGNEE" | "OPERATOR_QUEUE" = "OPERATOR_QUEUE",
): ITTicketNotificationPayloadV1 {
    return {
        version: 1,
        event: "PRIORITY_ESCALATED",
        priority,
        ticketId: TICKET_ID,
        recipientUserId: RECIPIENT_ID,
        audience,
        source: { kind: "EVENT", id: sourceId },
    };
}

function outbox(payload: ITTicketNotificationPayloadV1, type: Channel): NotificationOutbox {
    const now = new Date("2026-11-06T00:00:00.000Z");
    return {
        id: 91,
        type,
        eventKey: type === "IT_TICKET_LINE"
            ? buildITTicketLineEventKey(payload)
            : type === "IT_TICKET_EMAIL"
                ? buildITTicketEmailEventKey(payload)
                : buildITTicketNotificationEventKey(payload),
        payload: JSON.stringify(payload),
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: now,
        lastError: null,
        createdAt: now,
        updatedAt: now,
    };
}

/** Models the immutable source fact plus the current Ticket state at dispatch. */
function givenHistory(input: {
    readonly source: { readonly id: number; readonly from: ITTicketPriority; readonly to: ITTicketPriority };
    readonly current: {
        readonly priority: ITTicketPriority;
        readonly status?: ITTicketStatus;
        readonly assignedToUserId?: number | null;
    };
    readonly latestPriorityEventId: number;
    readonly eligibleOperatorIds?: readonly number[];
}): void {
    mocks.eventSource.mockResolvedValue({
        id: input.source.id,
        ticketId: TICKET_ID,
        actorUserId: ACTOR_ID,
        kind: "PRIORITY_CHANGED",
        fromPriority: input.source.from,
        toPriority: input.source.to,
        toStatus: null,
        toAssigneeUserId: null,
    });
    mocks.ticketResource.mockResolvedValue({
        id: TICKET_ID,
        requesterUserId: 99,
        assignedToUserId: input.current.assignedToUserId ?? null,
        status: input.current.status ?? "IN_PROGRESS",
        priority: input.current.priority,
    });
    mocks.latestPriority.mockResolvedValue({ id: input.latestPriorityEventId });
    mocks.operatorAudience.mockResolvedValue(
        (input.eligibleOperatorIds ?? [RECIPIENT_ID, ACTOR_ID]).map((userId) => ({ userId })),
    );
}

async function expectEveryChannel(
    payload: ITTicketNotificationPayloadV1,
    expected: "SENT" | "SUPERSEDED",
): Promise<void> {
    for (const channel of CHANNELS) {
        await expect(dispatchITTicketNotificationOutbox(outbox(payload, channel)), channel)
            .resolves.toBe(expected);
    }
    if (expected === "SUPERSEDED") {
        expect(mocks.createInbox).not.toHaveBeenCalled();
        expect(mocks.sendEmail).not.toHaveBeenCalled();
        expect(mocks.sendLine).not.toHaveBeenCalled();
    } else {
        expect(mocks.createInbox).toHaveBeenCalledTimes(1);
        expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
        expect(mocks.sendLine).toHaveBeenCalledTimes(1);
    }
}

describe("IT Ticket priority escalation dispatch applicability", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.transaction.mockImplementation(async (
            operation: (tx: object) => Promise<unknown>,
        ) => operation({}));
        mocks.recipientEmail.mockResolvedValue("operator@example.test");
        mocks.createInbox.mockResolvedValue(undefined);
        mocks.sendEmail.mockResolvedValue(true);
        mocks.sendLine.mockResolvedValue({ status: "SENT" });
    });

    it("delivers a valid unchanged P0 escalation on Inbox, Email, and LINE", async () => {
        givenHistory({
            source: { id: 456, from: "P2", to: "P0" },
            current: { priority: "P0" },
            latestPriorityEventId: 456,
        });
        await expectEveryChannel(escalation("P0", 456), "SENT");
    });

    it("delivers a valid unchanged P1 escalation to the eligible assignee", async () => {
        givenHistory({
            source: { id: 456, from: "P3", to: "P1" },
            current: { priority: "P1", assignedToUserId: RECIPIENT_ID },
            latestPriorityEventId: 456,
        });
        await expectEveryChannel(escalation("P1", 456, "ASSIGNEE"), "SENT");
    });

    it("supersedes P2 -> P0 -> P2 before dispatch", async () => {
        givenHistory({
            source: { id: 456, from: "P2", to: "P0" },
            current: { priority: "P2" },
            latestPriorityEventId: 457,
        });
        await expectEveryChannel(escalation("P0", 456), "SUPERSEDED");
    });

    it("supersedes P2 -> P1 -> P3 before dispatch", async () => {
        givenHistory({
            source: { id: 456, from: "P2", to: "P1" },
            current: { priority: "P3" },
            latestPriorityEventId: 457,
        });
        await expectEveryChannel(escalation("P1", 456), "SUPERSEDED");
    });

    it("supersedes the P1 alert but keeps the P0 alert for P2 -> P1 -> P0", async () => {
        givenHistory({
            source: { id: 456, from: "P2", to: "P1" },
            current: { priority: "P0" },
            latestPriorityEventId: 457,
        });
        await expectEveryChannel(escalation("P1", 456), "SUPERSEDED");

        vi.clearAllMocks();
        givenHistory({
            source: { id: 457, from: "P1", to: "P0" },
            current: { priority: "P0" },
            latestPriorityEventId: 457,
        });
        await expectEveryChannel(escalation("P0", 457), "SENT");
    });

    it("supersedes the P0 alert after a P0 -> P1 downgrade", async () => {
        givenHistory({
            source: { id: 456, from: "P2", to: "P0" },
            current: { priority: "P1" },
            latestPriorityEventId: 457,
        });
        await expectEveryChannel(escalation("P0", 456), "SUPERSEDED");
    });

    it("uses durable event identity for P2 -> P1 -> P2 -> P1, not only the priority value", async () => {
        // Current priority equals the first alert's P1, but a later generation exists.
        givenHistory({
            source: { id: 456, from: "P2", to: "P1" },
            current: { priority: "P1" },
            latestPriorityEventId: 458,
        });
        await expectEveryChannel(escalation("P1", 456), "SUPERSEDED");

        vi.clearAllMocks();
        givenHistory({
            source: { id: 458, from: "P2", to: "P1" },
            current: { priority: "P1" },
            latestPriorityEventId: 458,
        });
        await expectEveryChannel(escalation("P1", 458), "SENT");
    });

    it.each(["RESOLVED", "CLOSED", "CANCELLED"] as const)(
        "supersedes a pending P0 escalation once the Ticket is %s",
        async (status) => {
            givenHistory({
                source: { id: 456, from: "P2", to: "P0" },
                current: { priority: "P0", status },
                latestPriorityEventId: 456,
            });
            await expectEveryChannel(escalation("P0", 456), "SUPERSEDED");
        },
    );

    it("supersedes, without re-routing, when the selected recipient loses operator authority", async () => {
        givenHistory({
            source: { id: 456, from: "P2", to: "P0" },
            current: { priority: "P0" },
            latestPriorityEventId: 456,
            eligibleOperatorIds: [ACTOR_ID, 43],
        });
        await expectEveryChannel(escalation("P0", 456), "SUPERSEDED");
        expect(mocks.recipientEmail).not.toHaveBeenCalled();
    });

    it("supersedes a P1 assignee alert when that assignee loses eligibility before dispatch", async () => {
        givenHistory({
            source: { id: 456, from: "P2", to: "P1" },
            current: { priority: "P1", assignedToUserId: RECIPIENT_ID },
            latestPriorityEventId: 456,
            eligibleOperatorIds: [ACTOR_ID, 43],
        });
        await expectEveryChannel(escalation("P1", 456, "ASSIGNEE"), "SUPERSEDED");
    });

    it("keeps a P1 queue fallback deliverable while the assignee remains ineligible", async () => {
        givenHistory({
            source: { id: 456, from: "P2", to: "P1" },
            current: { priority: "P1", assignedToUserId: 77 },
            latestPriorityEventId: 456,
        });
        await expectEveryChannel(escalation("P1", 456, "OPERATOR_QUEUE"), "SENT");
    });

    it("supersedes a P1 queue fallback after an eligible operator is assigned", async () => {
        givenHistory({
            source: { id: 456, from: "P2", to: "P1" },
            current: { priority: "P1", assignedToUserId: 43 },
            latestPriorityEventId: 456,
            eligibleOperatorIds: [RECIPIENT_ID, 43],
        });
        await expectEveryChannel(escalation("P1", 456, "OPERATOR_QUEUE"), "SUPERSEDED");
    });

    it("supersedes an alert whose source is a downgrade or belongs to another Ticket", async () => {
        givenHistory({
            source: { id: 456, from: "P0", to: "P1" },
            current: { priority: "P1" },
            latestPriorityEventId: 456,
        });
        await expectEveryChannel(escalation("P1", 456), "SUPERSEDED");

        vi.clearAllMocks();
        givenHistory({
            source: { id: 456, from: "P2", to: "P0" },
            current: { priority: "P0" },
            latestPriorityEventId: 456,
        });
        mocks.eventSource.mockResolvedValue({
            id: 456,
            ticketId: TICKET_ID + 1,
            actorUserId: ACTOR_ID,
            kind: "PRIORITY_CHANGED",
            fromPriority: "P2",
            toPriority: "P0",
            toStatus: null,
            toAssigneeUserId: null,
        });
        await expectEveryChannel(escalation("P0", 456), "SUPERSEDED");
    });
});
