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
        expect(hash).toBe(createITTicketRequestHash({
            type: "SERVICE_REQUEST",
            title: "ขอเปิดสิทธิ์ระบบ",
            description: "ขอให้ตรวจสอบและดำเนินการ",
            attachments: [],
        }));
    });

    it("includes original names and normalized content hashes when attachments exist", () => {
        const input = {
            type: "INCIDENT" as const,
            title: "เข้าใช้งานไม่ได้",
            description: "ระบบแจ้งข้อผิดพลาด",
            attachments: [{ originalName: "หน้าจอ.png", contentSha256: "a".repeat(64) }],
        };
        const hash = createITTicketRequestHash(input);

        expect(hash).toBe(createITTicketRequestHash(input));
        expect(hash).not.toBe(createITTicketRequestHash({
            ...input,
            attachments: [{ originalName: "หน้าจอ.png", contentSha256: "b".repeat(64) }],
        }));
        expect(hash).not.toBe(createITTicketRequestHash({
            ...input,
            attachments: [{ originalName: "อีกชื่อ.png", contentSha256: "a".repeat(64) }],
        }));
    });
});
