import { afterEach, describe, expect, it, vi } from "vitest";

import { parseITTicketNotificationPayload } from "../../domain/ticket-notification";
import { buildITTicketEmailData } from "./ticket-email";

describe("IT Ticket Email composition", () => {
    afterEach(() => vi.unstubAllEnvs());

    it.each([
        ["CREATED", "OPERATOR_QUEUE", { kind: "EVENT", id: 1 }, "[NHFapp][IT] มี Ticket IT ใหม่ #123", "/dashboard/it/queue/123"],
        ["ASSIGNED", "ASSIGNEE", { kind: "EVENT", id: 2 }, "[NHFapp][IT] คุณได้รับมอบหมาย Ticket IT #123", "/dashboard/it/queue/123"],
        ["OPERATOR_COMMENTED", "REQUESTER", { kind: "COMMENT", id: "comment-3" }, "[NHFapp][IT] IT ตอบกลับ Ticket ของคุณ #123", "/dashboard/it/123"],
        ["REQUESTER_COMMENTED", "ASSIGNEE", { kind: "COMMENT", id: "comment-4" }, "[NHFapp][IT] ผู้ขอส่งข้อความใหม่ใน Ticket IT #123", "/dashboard/it/queue/123"],
        ["WAITING_REQUESTER", "REQUESTER", { kind: "EVENT", id: 5 }, "[NHFapp][IT] Ticket IT รอข้อมูลเพิ่มเติมจากคุณ #123", "/dashboard/it/123"],
        ["RESOLVED", "REQUESTER", { kind: "EVENT", id: 6 }, "[NHFapp][IT] Ticket IT ได้รับการแก้ไขแล้ว #123", "/dashboard/it/123"],
        ["REQUESTER_COMMENTED", "OPERATOR_QUEUE", { kind: "COMMENT", id: "comment-7" }, "[NHFapp][IT] ผู้ขอส่งข้อความใหม่ใน Ticket IT #123", "/dashboard/it/queue/123"],
    ] as const)("composes concise content for %s / %s", (
        event,
        audience,
        source,
        subject,
        route,
    ) => {
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://app.example.com");
        const payload = parseITTicketNotificationPayload({
            version: 1,
            event,
            ticketId: 123,
            recipientUserId: 42,
            audience,
            source,
        });

        const email = buildITTicketEmailData(
            payload,
            "operator@example.com",
            `it:ticket:123:source:user:42:email`,
        );

        expect(email.to).toBe("operator@example.com");
        expect(email.subject).toBe(subject);
        expect(email.fromName).toBe("NHFapp | ระบบ IT");
        expect(email.html).toContain("เปิด Ticket");
        expect(email.html).toContain("Ticket IT");
        expect(email.html).toContain(`https://app.example.com${route}`);
        expect(email.html).toContain("<table role=\"presentation\"");
        expect(email.html).toContain("NHFapp&nbsp; | &nbsp;IT");
        expect(email.html).toContain("<h1");
        expect(email.text).toContain(`https://app.example.com${route}`);
        expect(email.text).toContain("เลขที่ Ticket: Ticket IT #123");
        expect(email.text).toContain("กรุณาอย่าตอบกลับ");
        expect(email.messageId).toBe(
            "<nhf-it-it-ticket-123-source-user-42-email@notifications.thainhf.org>",
        );
        expect(email.html).not.toContain("description");
        expect(email.html).not.toContain("private comment");
        expect(email.html).not.toContain("attachment");
        expect(email.html).not.toContain("storageKey");
        expect(email.html).not.toContain("capability");
    });
});
