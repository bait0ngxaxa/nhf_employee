import { afterEach, describe, expect, it, vi } from "vitest";

import { buildITTicketLineFlexMessage } from "./line-flex";
import { parseITTicketNotificationPayload } from "../../domain/ticket-notification";

describe("IT Ticket personal LINE Flex message", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it.each([
        {
            event: "CREATED",
            color: "#2563EB",
            audience: "OPERATOR_QUEUE",
            source: { kind: "EVENT", id: 451 },
            title: "มี Ticket IT ใหม่",
            body: "รอรับเรื่องในคิว IT",
            action: "เปิด Ticket",
            destination: "https://app.example.com/dashboard/it/queue/123",
        },
        {
            event: "ASSIGNED",
            color: "#2563EB",
            audience: "ASSIGNEE",
            source: { kind: "EVENT", id: 452 },
            title: "คุณได้รับมอบหมาย Ticket IT",
            body: "อยู่ในความรับผิดชอบของคุณ",
            action: "เปิด Ticket",
            destination: "https://app.example.com/dashboard/it/queue/123",
        },
        {
            event: "OPERATOR_COMMENTED",
            color: "#2563EB",
            audience: "REQUESTER",
            source: { kind: "COMMENT", id: "cmr-comment-1" },
            title: "IT ตอบกลับ Ticket ของคุณ",
            body: "มีข้อความตอบกลับใหม่จาก IT",
            action: "เปิด Ticket",
            destination: "https://liff.line.me/nhfapp-liff-id/it/123",
        },
        {
            event: "REQUESTER_COMMENTED",
            color: "#7C3AED",
            audience: "ASSIGNEE",
            source: { kind: "COMMENT", id: "cmr-comment-2" },
            title: "ผู้ขอส่งข้อความใหม่ใน Ticket IT",
            body: "มีข้อความใหม่จากผู้ขอ",
            action: "เปิด Ticket",
            destination: "https://app.example.com/dashboard/it/queue/123",
        },
        {
            event: "WAITING_REQUESTER",
            color: "#B45309",
            audience: "REQUESTER",
            source: { kind: "EVENT", id: 453 },
            title: "Ticket IT รอข้อมูลเพิ่มเติมจากคุณ",
            body: "กรุณาให้ข้อมูลเพิ่มเติมเพื่อให้ IT ดำเนินการต่อ",
            action: "เปิด Ticket",
            destination: "https://liff.line.me/nhfapp-liff-id/it/123",
        },
        {
            event: "RESOLVED",
            color: "#047857",
            audience: "REQUESTER",
            source: { kind: "EVENT", id: 454 },
            title: "Ticket IT ได้รับการแก้ไขแล้ว",
            body: "ตรวจสอบผลการแก้ไขได้ในรายละเอียด Ticket",
            action: "เปิด Ticket",
            destination: "https://liff.line.me/nhfapp-liff-id/it/123",
        },
        {
            event: "REQUESTER_COMMENTED",
            color: "#7C3AED",
            audience: "OPERATOR_QUEUE",
            source: { kind: "COMMENT", id: "cmr-comment-3" },
            title: "ผู้ขอส่งข้อความใหม่ใน Ticket IT",
            body: "มีข้อความใหม่จากผู้ขอ",
            action: "เปิด Ticket",
            destination: "https://app.example.com/dashboard/it/queue/123",
        },
    ] as const)("composes a privacy-safe $event message for $audience", (input) => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://app.example.com");

        const payload = parseITTicketNotificationPayload({
            version: 1,
            event: input.event,
            ticketId: 123,
            recipientUserId: 42,
            audience: input.audience,
            source: input.source,
        });
        const message = buildITTicketLineFlexMessage(payload);
        const serialized = JSON.stringify(message);

        expect(message.type).toBe("flex");
        expect(message.contents.header?.backgroundColor).toBe(input.color);
        expect(message.contents.footer?.contents[0]).toMatchObject({
            type: "button", color: input.color, action: { label: input.action },
        });
        expect(message.altText).toBe(`IT: ${input.title} · Ticket IT #123`);
        expect(message.contents.header?.contents[0]).toMatchObject({ type: "text", text: "NHFapp | IT · Ticket IT" });
        expect(message.contents.body?.contents[0]).toMatchObject({ type: "text", text: input.title });
        expect(message.altText).toContain("Ticket IT #123");
        expect(serialized).toContain(input.title);
        expect(serialized).toContain(input.body);
        expect(serialized).toContain(input.action);
        expect(serialized).toContain(input.destination);
        expect(serialized).not.toContain("description");
        expect(serialized).not.toContain("attachment");
        expect(serialized).not.toContain("department");
        expect(serialized).not.toContain("assignee");
        expect(serialized).not.toContain("private");
        expect(serialized).not.toContain("cmr-comment");
    });
});
