import { describe, expect, it } from "vitest";
import { generateLeaveActionEmailHTML } from "@/lib/email/templates/leave-action";
import { generateLeaveEventEmailHTML } from "@/lib/email/templates/leave-event";
import { generateLeaveResultEmailHTML } from "@/lib/email/templates/leave-result";
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
    it("escapes leave action and result free-text fields", () => {
        const actionHtml = generateLeaveActionEmailHTML(
            {
                leaveId: "leave-1",
                employee: {
                    employeeId: 1,
                    userId: 1,
                    email: "user@example.com",
                    name: XSS_PAYLOAD,
                },
                approver: {
                    employeeId: 2,
                    userId: 2,
                    email: "manager@example.com",
                    name: "Manager",
                },
                leaveType: "SICK",
                startDate: "2026-05-28T00:00:00.000Z",
                endDate: "2026-05-29T00:00:00.000Z",
                period: "FULL_DAY",
                durationDays: 2,
                reason: XSS_PAYLOAD,
                emergencyReason: XSS_PAYLOAD,
                specialReason: null,
                overQuotaDays: 0,
            },
            `https://example.com/dashboard?next=${XSS_PAYLOAD}`,
        );
        const resultHtml = generateLeaveResultEmailHTML({
            leaveId: "leave-1",
            employee: {
                employeeId: 1,
                userId: 1,
                email: "user@example.com",
                name: "User",
            },
            approverName: XSS_PAYLOAD,
            leaveType: "SICK",
            startDate: "2026-05-28T00:00:00.000Z",
            endDate: "2026-05-29T00:00:00.000Z",
            period: "FULL_DAY",
            durationDays: 2,
            status: "REJECTED",
            reason: XSS_PAYLOAD,
        }, "https://example.com/dashboard/leave");

        expect(actionHtml).toContain("เหตุผลในการลาย้อนหลัง");
        expectEscapedHtml(actionHtml);
        expectEscapedHtml(resultHtml);
    });

    it("escapes leave event email fields", () => {
        const html = generateLeaveEventEmailHTML({
            title: XSS_PAYLOAD,
            intro: XSS_PAYLOAD,
            employeeName: XSS_PAYLOAD,
            leaveType: "SICK",
            startDate: "2026-05-28T00:00:00.000Z",
            endDate: "2026-05-29T00:00:00.000Z",
            period: "FULL_DAY",
            durationDays: 2,
            dashboardLink: `https://example.com/dashboard?next=${XSS_PAYLOAD}`,
            ctaLabel: XSS_PAYLOAD,
            noteLabel: XSS_PAYLOAD,
            note: XSS_PAYLOAD,
        });

        expectEscapedHtml(html);
    });

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
