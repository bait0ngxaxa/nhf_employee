import { describe, expect, it } from "vitest";

import {
    buildITTicketLineEventKey,
    buildITTicketNotificationEventKey,
    isITTicketRequesterLineNotification,
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

    it("keeps the in-app key stable and gives requester LINE a distinct deterministic identity", () => {
        const payload = {
            version: 1,
            event: "OPERATOR_COMMENTED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "REQUESTER",
            source: { kind: "COMMENT", id: "cmr-comment-1" },
        } as const;

        const inAppKey = buildITTicketNotificationEventKey(payload);
        const lineKey = buildITTicketLineEventKey(payload);

        expect(inAppKey).toBe(
            "it:ticket:123:comment:cmr-comment-1:user:42:in-app",
        );
        expect(lineKey).toBe(
            "it:ticket:123:comment:cmr-comment-1:user:42:line",
        );
        expect(buildITTicketLineEventKey(payload)).toBe(lineKey);
        expect(lineKey).not.toBe(inAppKey);
        expect(buildITTicketLineEventKey({
            ...payload,
            source: { kind: "COMMENT", id: "cmr-comment-2" },
        })).not.toBe(lineKey);
        expect(buildITTicketLineEventKey({
            ...payload,
            recipientUserId: 43,
        })).not.toBe(lineKey);

        const waitingPayload = {
            ...payload,
            event: "WAITING_REQUESTER",
            source: { kind: "EVENT", id: 456 },
        } as const;
        expect(buildITTicketLineEventKey({
            ...waitingPayload,
            source: { kind: "EVENT", id: 457 },
        })).not.toBe(buildITTicketLineEventKey(waitingPayload));
    });

    it("limits personal LINE intents to requester-facing event facts", () => {
        const requesterComment = {
            version: 1,
            event: "OPERATOR_COMMENTED",
            ticketId: 123,
            recipientUserId: 42,
            audience: "REQUESTER",
            source: { kind: "COMMENT", id: "cmr-comment-1" },
        } as const;

        expect(isITTicketRequesterLineNotification(requesterComment)).toBe(true);
        expect(isITTicketRequesterLineNotification({
            ...requesterComment,
            event: "REQUESTER_COMMENTED",
            audience: "ASSIGNEE",
        })).toBe(false);
        expect(isITTicketRequesterLineNotification({
            ...requesterComment,
            event: "CREATED",
            audience: "OPERATOR_QUEUE",
            source: { kind: "EVENT", id: 457 },
        })).toBe(false);
        expect(isITTicketRequesterLineNotification({
            ...requesterComment,
            event: "ASSIGNED",
            audience: "ASSIGNEE",
            source: { kind: "EVENT", id: 458 },
        })).toBe(false);
    });
});
