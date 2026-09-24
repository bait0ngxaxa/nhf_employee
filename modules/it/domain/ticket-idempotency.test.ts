import { describe, expect, it } from "vitest";

import { createITTicketRequestHash } from "./ticket-idempotency";

describe("IT Ticket creation idempotency hash", () => {
    it("hashes only canonical type, title, and description as SHA-256", () => {
        const hash = createITTicketRequestHash({
            type: "SERVICE_REQUEST",
            title: "ขอเปิดสิทธิ์ระบบ",
            description: "ขอให้ตรวจสอบและดำเนินการ",
        });

        expect(hash).toMatch(/^[a-f0-9]{64}$/);
        expect(hash).toBe(createITTicketRequestHash({
            type: "SERVICE_REQUEST",
            title: "ขอเปิดสิทธิ์ระบบ",
            description: "ขอให้ตรวจสอบและดำเนินการ",
        }));
        expect(hash).not.toBe(createITTicketRequestHash({
            type: "INCIDENT",
            title: "ขอเปิดสิทธิ์ระบบ",
            description: "ขอให้ตรวจสอบและดำเนินการ",
        }));
    });
});
