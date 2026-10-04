import { afterEach, describe, expect, it, vi } from "vitest";

import { buildEmailRequestEmailData } from "./email-request-email";

describe("Email Request Email content", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("targets the account email and includes only a concise request summary", () => {
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://app.example.com");

        const email = buildEmailRequestEmailData(
            77,
            "it-reader@example.com",
            10,
            900,
        );

        expect(email.to).toBe("it-reader@example.com");
        expect(email.subject).toBe("[NHFapp][IT] มีคำขออีเมลพนักงานใหม่ #77");
        expect(email.fromName).toBe("NHFapp | ระบบ IT");
        expect(email.html).toContain("ตรวจสอบคำขอ");
        expect(email.messageId).toBe(
            "<nhf-email-request-77-user-10@notifications.thainhf.org>",
        );
        expect(email.html).toContain("https://app.example.com/dashboard/email-request");
        expect(email.html).toContain("<table role=\"presentation\"");
        expect(email.html).toContain("มีคำขออีเมลพนักงานใหม่รอตรวจสอบ");
        expect(email.text).toContain("รายการ: คำขออีเมลพนักงานใหม่ #77");
        expect(email.html).not.toContain("somchai@example.com");
        expect(email.html).not.toContain("replyEmail");
        expect(email.html).not.toContain("phone");
    });

    it("uses parent outbox identity when an old parent has no request id", () => {
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://app.example.com");

        const email = buildEmailRequestEmailData(null, "it@example.com", 10, 901);

        expect(email.subject).toBe("[NHFapp][IT] มีคำขออีเมลพนักงานใหม่");
        expect(email.messageId).toBe(
            "<nhf-email-request-outbox-901-user-10@notifications.thainhf.org>",
        );
    });

    it("uses update copy and a new stable message identity per access version without phone", () => {
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://app.example.com");
        const first = buildEmailRequestEmailData(77, "it@example.com", 10, 901, 2);
        const retry = buildEmailRequestEmailData(77, "it@example.com", 10, 901, 2);
        const later = buildEmailRequestEmailData(77, "it@example.com", 10, 902, 3);
        expect(first.subject).toBe("[NHFapp][IT] มีการอัปเดตสิทธิ์พนักงานใหม่ #77");
        expect(first.html).toContain("มีการระบุหรือแก้ไขสิทธิ์การใช้งานเพิ่มเติม");
        expect(first.text).not.toContain("มีคำขออีเมลพนักงานใหม่รอตรวจสอบ");
        expect(first.messageId).toBe(retry.messageId);
        expect(first.messageId).not.toBe(later.messageId);
        expect(JSON.stringify(first)).not.toMatch(/phone|081/);
    });
});
