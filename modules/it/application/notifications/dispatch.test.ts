import type { NotificationOutbox } from "@prisma/client";
import { describe, expect, it } from "vitest";

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
});
