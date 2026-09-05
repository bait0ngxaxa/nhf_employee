import { describe, expect, it } from "vitest";
import { generatePasswordResetEmailHTML } from "@/lib/email/templates/password-reset";
import { generateStockRequestResultEmailHTML } from "@/lib/email/templates/stock-request-result";

const XSS_PAYLOAD = `<script>alert("xss")</script><img src=x onerror="alert('x')">`;

function expectEscapedHtml(html: string): void {
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('onerror="');
    expect(html).not.toContain("onerror='");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x");
}

describe("email template XSS escaping", () => {
    it("escapes password reset display name and link attributes", () => {
        const html = generatePasswordResetEmailHTML(
            `https://example.com/reset?token=${XSS_PAYLOAD}`,
            XSS_PAYLOAD,
        );

        expectEscapedHtml(html);
    });

    it("escapes stock request result fields and dashboard URL", () => {
        const html = generateStockRequestResultEmailHTML(
            {
                schemaVersion: 1,
                requestId: 1,
                status: "CANCELLED",
                projectCode: XSS_PAYLOAD,
                recipient: {
                    userId: 1,
                    name: XSS_PAYLOAD,
                    email: "user@example.com",
                },
                items: [{
                    name: XSS_PAYLOAD,
                    quantity: 1,
                    unit: XSS_PAYLOAD,
                    variantLabel: XSS_PAYLOAD,
                }],
                cancelReason: XSS_PAYLOAD,
                actedAt: "2026-05-28T00:00:00.000Z",
            },
            `https://example.com/dashboard?next=${XSS_PAYLOAD}`,
        );

        expectEscapedHtml(html);
        expect(html).toContain("เหตุผลยกเลิก:");
    });

});
