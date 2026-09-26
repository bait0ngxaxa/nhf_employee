import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { ITTicketNotificationPayloadV1 } from "../../domain/ticket-notification";
import { enqueueITTicketNotificationIntents } from "./outbox";

type OutboxCreateManyInput = {
    readonly data: Prisma.NotificationOutboxCreateManyInput[];
    readonly skipDuplicates?: boolean;
};

describe("IT Ticket outbox adapter", () => {
    it("adds LINE only for requester comments, waiting, and resolved facts", async () => {
        const createMany = vi.fn<
            (input: OutboxCreateManyInput) => Promise<{ count: number }>
        >(async () => ({ count: 0 }));
        const tx = {
            notificationOutbox: { createMany },
        } as unknown as Pick<Prisma.TransactionClient, "notificationOutbox">;
        const payloads: readonly ITTicketNotificationPayloadV1[] = [
            {
                version: 1,
                event: "OPERATOR_COMMENTED",
                ticketId: 123,
                recipientUserId: 42,
                audience: "REQUESTER",
                source: { kind: "COMMENT", id: "cmr-comment-1" },
            },
            {
                version: 1,
                event: "WAITING_REQUESTER",
                ticketId: 123,
                recipientUserId: 42,
                audience: "REQUESTER",
                source: { kind: "EVENT", id: 457 },
            },
            {
                version: 1,
                event: "RESOLVED",
                ticketId: 123,
                recipientUserId: 42,
                audience: "REQUESTER",
                source: { kind: "EVENT", id: 458 },
            },
            {
                version: 1,
                event: "CREATED",
                ticketId: 123,
                recipientUserId: 43,
                audience: "OPERATOR_QUEUE",
                source: { kind: "EVENT", id: 459 },
            },
            {
                version: 1,
                event: "ASSIGNED",
                ticketId: 123,
                recipientUserId: 44,
                audience: "ASSIGNEE",
                source: { kind: "EVENT", id: 460 },
            },
            {
                version: 1,
                event: "REQUESTER_COMMENTED",
                ticketId: 123,
                recipientUserId: 44,
                audience: "ASSIGNEE",
                source: { kind: "COMMENT", id: "cmr-comment-2" },
            },
            {
                version: 1,
                event: "REQUESTER_COMMENTED",
                ticketId: 123,
                recipientUserId: 45,
                audience: "OPERATOR_QUEUE",
                source: { kind: "COMMENT", id: "cmr-comment-2" },
            },
        ] as const;

        await enqueueITTicketNotificationIntents(
            tx,
            payloads,
        );

        expect(createMany).toHaveBeenCalledOnce();
        const call = createMany.mock.calls[0]?.[0];
        expect(call?.skipDuplicates).toBe(true);
        expect(call?.data.map(({ type }) => type)).toEqual([
            "IT_TICKET_IN_APP",
            "IT_TICKET_LINE",
            "IT_TICKET_IN_APP",
            "IT_TICKET_LINE",
            "IT_TICKET_IN_APP",
            "IT_TICKET_LINE",
            "IT_TICKET_IN_APP",
            "IT_TICKET_IN_APP",
            "IT_TICKET_IN_APP",
            "IT_TICKET_IN_APP",
        ]);

        const lineRows = call?.data.filter(({ type }) => type === "IT_TICKET_LINE");
        expect(lineRows).toHaveLength(3);
        for (const lineRow of lineRows ?? []) {
            const inAppRow = call?.data.find((row) =>
                row.type === "IT_TICKET_IN_APP"
                && row.payload === lineRow.payload,
            );
            expect(inAppRow).toBeDefined();
            expect(lineRow.eventKey).not.toBe(inAppRow?.eventKey);
        }
        expect(call?.data.every(({ payload }) =>
            !payload.includes("description")
            && !payload.includes("comment body")
            && !payload.includes("attachment"),
        )).toBe(true);
    });

    it("writes no rows for an empty semantic batch", async () => {
        const createMany = vi.fn();
        const tx = {
            notificationOutbox: { createMany },
        } as unknown as Pick<Prisma.TransactionClient, "notificationOutbox">;

        await enqueueITTicketNotificationIntents(tx, []);

        expect(createMany).not.toHaveBeenCalled();
    });
});
