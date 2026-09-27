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
        expect(email.subject).toContain("#77");
        expect(email.messageId).toBe(
            "<nhf-email-request-77-user-10@notifications.thainhf.org>",
        );
        expect(email.html).toContain("https://app.example.com/dashboard/email-request");
        expect(email.html).not.toContain("somchai@example.com");
        expect(email.html).not.toContain("replyEmail");
        expect(email.html).not.toContain("phone");
    });

    it("uses parent outbox identity when an old parent has no request id", () => {
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://app.example.com");

        const email = buildEmailRequestEmailData(null, "it@example.com", 10, 901);

        expect(email.subject).toBe("มีคำขออีเมลพนักงานใหม่");
        expect(email.messageId).toBe(
            "<nhf-email-request-outbox-901-user-10@notifications.thainhf.org>",
        );
    });
});
