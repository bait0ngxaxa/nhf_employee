import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

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
        expect(hash).toBe(createHash("sha256").update(JSON.stringify({
            ticketId: canonical.ticketId,
            authorSide: canonical.authorSide,
            body: canonical.body,
        })).digest("hex"));
        expect(createITTicketCommentRequestHash(canonical)).toBe(hash);
        expect(createITTicketCommentRequestHash({ ...canonical, ticketId: 20 })).not.toBe(hash);
        expect(createITTicketCommentRequestHash({ ...canonical, authorSide: "OPERATOR" }))
            .not.toBe(hash);
        expect(createITTicketCommentRequestHash({ ...canonical, body: "ข้อความอื่น" }))
            .not.toBe(hash);
    });

    it("uses versioned normalized facts only for attachment-bearing requests", () => {
        const base = {
            ticketId: 19,
            authorSide: "REQUESTER" as const,
            body: "ขอความช่วยเหลือค่ะ",
        };
        const first = createITTicketCommentRequestHash({
            ...base,
            attachments: [{ originalName: "หลักฐาน.jpg", contentSha256: "a".repeat(64) }],
        });
        expect(first).not.toBe(createITTicketCommentRequestHash(base));
        expect(createITTicketCommentRequestHash({
            ...base,
            attachments: [{ originalName: "หลักฐาน.jpg", contentSha256: "a".repeat(64) }],
        })).toBe(first);
        expect(createITTicketCommentRequestHash({
            ...base,
            attachments: [{ originalName: "อีกชื่อ.jpg", contentSha256: "a".repeat(64) }],
        })).not.toBe(first);
        expect(createITTicketCommentRequestHash({
            ...base,
            attachments: [{ originalName: "หลักฐาน.jpg", contentSha256: "b".repeat(64) }],
        })).not.toBe(first);
        expect(createITTicketCommentRequestHash({
            ...base,
            attachments: [
                { originalName: "แรก.jpg", contentSha256: "a".repeat(64) },
                { originalName: "สอง.jpg", contentSha256: "b".repeat(64) },
            ],
        })).not.toBe(createITTicketCommentRequestHash({
            ...base,
            attachments: [
                { originalName: "สอง.jpg", contentSha256: "b".repeat(64) },
                { originalName: "แรก.jpg", contentSha256: "a".repeat(64) },
            ],
        }));
    });
});
