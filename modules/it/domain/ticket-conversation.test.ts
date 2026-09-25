import { describe, expect, it } from "vitest";

import {
    createITTicketCommentRequestHash,
    isITTicketCommentableStatus,
} from "./ticket-conversation";

describe("IT Ticket conversation policy", () => {
    it.each(["OPEN", "IN_PROGRESS", "WAITING_REQUESTER"] as const)(
        "allows comments while %s",
        (status) => expect(isITTicketCommentableStatus(status)).toBe(true),
    );

    it.each(["RESOLVED", "CLOSED", "CANCELLED"] as const)(
        "rejects comments while %s",
        (status) => expect(isITTicketCommentableStatus(status)).toBe(false),
    );

    it("hashes canonical comment context including Ticket and author side", () => {
        const canonical = {
            ticketId: 19,
            authorSide: "REQUESTER" as const,
            body: "ขอความช่วยเหลือค่ะ",
        };
        const hash = createITTicketCommentRequestHash(canonical);

        expect(hash).toMatch(/^[a-f0-9]{64}$/);
        expect(createITTicketCommentRequestHash(canonical)).toBe(hash);
        expect(createITTicketCommentRequestHash({ ...canonical, ticketId: 20 })).not.toBe(hash);
        expect(createITTicketCommentRequestHash({ ...canonical, authorSide: "OPERATOR" }))
            .not.toBe(hash);
        expect(createITTicketCommentRequestHash({ ...canonical, body: "ข้อความอื่น" }))
            .not.toBe(hash);
    });
});
