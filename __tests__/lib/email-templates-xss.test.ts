import { describe, expect, it } from "vitest";
import { generatePasswordResetEmailHTML } from "@/lib/email/templates/password-reset";

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

});
