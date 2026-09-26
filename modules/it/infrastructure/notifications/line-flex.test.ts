import { afterEach, describe, expect, it, vi } from "vitest";

import { buildITTicketLineFlexMessage } from "./line-flex";

describe("IT Ticket personal LINE Flex message", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it.each([
        {
            event: "OPERATOR_COMMENTED",
            source: { kind: "COMMENT", id: "cmr-comment-1" },
            title: "IT ตอบกลับคำขอของคุณ",
            body: "Ticket IT #123 มีข้อความตอบกลับใหม่",
            action: "เปิด Ticket",
        },
        {
            event: "WAITING_REQUESTER",
            source: { kind: "EVENT", id: 456 },
            title: "IT ต้องการข้อมูลเพิ่มเติม",
            body: "Ticket IT #123 รอข้อมูลเพิ่มเติมจากคุณ",
            action: "ตอบกลับ",
        },
        {
            event: "RESOLVED",
            source: { kind: "EVENT", id: 457 },
            title: "คำขอ IT ได้รับการแก้ไขแล้ว",
            body: "Ticket IT #123 ได้รับการแก้ไขแล้ว",
            action: "ดูรายละเอียด",
        },
    ] as const)("composes the privacy-safe $event message", ({
        event,
        source,
        title,
        body,
        action,
    }) => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        const message = buildITTicketLineFlexMessage({
            version: 1,
            event,
            ticketId: 123,
            recipientUserId: 42,
            audience: "REQUESTER",
            source,
        });
        const serialized = JSON.stringify(message);

        expect(message.type).toBe("flex");
        expect(message.altText).toContain("Ticket IT #123");
        expect(serialized).toContain(title);
        expect(serialized).toContain(body);
        expect(serialized).toContain(action);
        expect(serialized).toContain(
            "https://liff.line.me/nhfapp-liff-id/it/123",
        );
        expect(serialized).not.toContain("description");
        expect(serialized).not.toContain("attachment");
        expect(serialized).not.toContain("department");
        expect(serialized).not.toContain("assignee");
        expect(serialized).not.toContain("private");
    });
});
