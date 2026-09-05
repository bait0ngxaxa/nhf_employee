import { describe, expect, it } from "vitest";

import { generateLeaveActionEmailHTML } from "./leave-action";
import { generateLeaveEventEmailHTML } from "./leave-event";
import { generateLeaveResultEmailHTML } from "./leave-result";

const XSS_PAYLOAD = `<script>alert("xss")</script><img src=x onerror="alert('x')">`;

function expectEscapedHtml(html: string): void {
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('onerror="');
    expect(html).not.toContain("onerror='");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x");
}

describe("Leave email template XSS escaping", () => {
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
});
