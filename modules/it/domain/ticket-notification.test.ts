import { describe, expect, it } from "vitest";

import {
    buildITTicketNotificationEventKey,
    parseITTicketNotificationPayload,
} from "./ticket-notification";

describe("IT Ticket notification payload", () => {
    it("strictly accepts the versioned event and comment source shapes", () => {
        expect(parseITTicketNotificationPayload({
            version: 1,
            event: "CREATED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "OPERATOR_QUEUE",
            source: { kind: "EVENT", id: 456 },
        })).toEqual({
            version: 1,
            event: "CREATED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "OPERATOR_QUEUE",
            source: { kind: "EVENT", id: 456 },
        });

        expect(parseITTicketNotificationPayload({
            version: 1,
            event: "OPERATOR_COMMENTED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "REQUESTER",
            source: { kind: "COMMENT", id: "cmr-comment-1" },
        }).source).toEqual({ kind: "COMMENT", id: "cmr-comment-1" });
    });

    it("rejects payload fields that could carry comment or authorization data", () => {
        const base = {
            version: 1,
            event: "REQUESTER_COMMENTED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "OPERATOR_QUEUE",
            source: { kind: "COMMENT", id: "cmr-comment-1" },
        } as const;

        expect(() => parseITTicketNotificationPayload({
            ...base,
            body: "private comment text",
        })).toThrow("Invalid IT_TICKET_IN_APP payload");
        expect(() => parseITTicketNotificationPayload({
            ...base,
            attachmentStorageKey: "private/key",
        })).toThrow("Invalid IT_TICKET_IN_APP payload");
        expect(() => parseITTicketNotificationPayload({
            ...base,
            capability: "it.ticket.manage",
        })).toThrow("Invalid IT_TICKET_IN_APP payload");
    });

    it("rejects source and audience combinations that conflict with the event", () => {
        expect(() => parseITTicketNotificationPayload({
            version: 1,
            event: "ASSIGNED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "OPERATOR_QUEUE",
            source: { kind: "COMMENT", id: "cmr-comment-1" },
        })).toThrow("Invalid IT_TICKET_IN_APP payload");
    });

    it("builds a stable identity from each persisted source and recipient", () => {
        const payload = {
            version: 1,
            event: "ASSIGNED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "ASSIGNEE",
            source: { kind: "EVENT", id: 456 },
        } as const;

        const key = buildITTicketNotificationEventKey(payload);

        expect(key).toBe("it:ticket:123:event:456:user:42:in-app");
        expect(buildITTicketNotificationEventKey({
            ...payload,
            source: { kind: "EVENT", id: 457 },
        })).not.toBe(key);
        expect(buildITTicketNotificationEventKey({
            ...payload,
            recipientUserId: 43,
        })).not.toBe(key);
    });
});
