import { describe, expect, it } from "vitest";

import {
    buildITTicketEmailEventKey,
    buildITTicketLineEventKey,
    buildITTicketNotificationEventKey,
    isITTicketLineNotification,
    parseITTicketNotificationPayload,
} from "./ticket-notification";

describe("IT Ticket notification payload", () => {
    it("strictly accepts versioned event and comment source shapes", () => {
        expect(parseITTicketNotificationPayload({
            version: 1,
            event: "CREATED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "OPERATOR_QUEUE",
            source: { kind: "EVENT", id: 456 },
        })).toMatchObject({ event: "CREATED", source: { id: 456 } });

        expect(parseITTicketNotificationPayload({
            version: 1,
            event: "OPERATOR_COMMENTED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "REQUESTER",
            source: { kind: "COMMENT", id: "cmr-comment-1" },
        }).source).toEqual({ kind: "COMMENT", id: "cmr-comment-1" });
    });

    it("rejects payload fields that could carry comment, attachment, or authorization data", () => {
        const base = {
            version: 1,
            event: "REQUESTER_COMMENTED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "OPERATOR_QUEUE",
            source: { kind: "COMMENT", id: "cmr-comment-1" },
        } as const;

        expect(() => parseITTicketNotificationPayload({ ...base, body: "private comment text" }))
            .toThrow("Invalid IT Ticket notification payload");
        expect(() => parseITTicketNotificationPayload({ ...base, attachmentStorageKey: "private/key" }))
            .toThrow("Invalid IT Ticket notification payload");
        expect(() => parseITTicketNotificationPayload({ ...base, capability: "it.ticket.manage" }))
            .toThrow("Invalid IT Ticket notification payload");
    });

    it("rejects impossible event and audience combinations", () => {
        expect(() => parseITTicketNotificationPayload({
            version: 1,
            event: "ASSIGNED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "OPERATOR_QUEUE",
            source: { kind: "EVENT", id: 456 },
        })).toThrow("Invalid IT Ticket notification payload");
    });

    it("allows LINE only for the explicitly approved event and audience matrix", () => {
        const allowed = [
            ["CREATED", "OPERATOR_QUEUE", { kind: "EVENT", id: 1 }],
            ["ASSIGNED", "ASSIGNEE", { kind: "EVENT", id: 2 }],
            ["OPERATOR_COMMENTED", "REQUESTER", { kind: "COMMENT", id: "c1" }],
            ["REQUESTER_COMMENTED", "ASSIGNEE", { kind: "COMMENT", id: "c2" }],
            ["REQUESTER_COMMENTED", "OPERATOR_QUEUE", { kind: "COMMENT", id: "c3" }],
            ["WAITING_REQUESTER", "REQUESTER", { kind: "EVENT", id: 4 }],
            ["RESOLVED", "REQUESTER", { kind: "EVENT", id: 5 }],
        ] as const;

        for (const [event, audience, source] of allowed) {
            const payload = parseITTicketNotificationPayload({
                version: 1,
                event,
                ticketId: 123,
                recipientUserId: 42,
                audience,
                source,
            });
            expect(isITTicketLineNotification(payload)).toBe(true);
        }
    });

    it("builds deterministic channel identities from source, ticket, and recipient", () => {
        const payload = {
            version: 1,
            event: "ASSIGNED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "ASSIGNEE",
            source: { kind: "EVENT", id: 456 },
        } as const;

        expect(buildITTicketNotificationEventKey(payload))
            .toBe("it:ticket:123:event:456:user:42:in-app");
        expect(buildITTicketLineEventKey(payload))
            .toBe("it:ticket:123:event:456:user:42:line");
        expect(buildITTicketEmailEventKey(payload))
            .toBe("it:ticket:123:event:456:user:42:email");
        expect(buildITTicketEmailEventKey({ ...payload, recipientUserId: 43 }))
            .not.toBe(buildITTicketEmailEventKey(payload));
        expect(buildITTicketEmailEventKey({
            ...payload,
            source: { kind: "EVENT", id: 457 },
        })).not.toBe(buildITTicketEmailEventKey(payload));
    });
});
