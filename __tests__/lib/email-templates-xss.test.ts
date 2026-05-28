import { describe, expect, it } from "vitest";
import type { TicketEmailData } from "@/types/api";
import { generateLeaveActionEmailHTML } from "@/lib/email/templates/leave-action";
import { generateLeaveResultEmailHTML } from "@/lib/email/templates/leave-result";
import { generateNewTicketEmailHTML } from "@/lib/email/templates/new-ticket";
import { generatePasswordResetEmailHTML } from "@/lib/email/templates/password-reset";
import { generateStatusUpdateEmailHTML } from "@/lib/email/templates/status-update";

const XSS_PAYLOAD = `<script>alert("xss")</script><img src=x onerror="alert('x')">`;

function expectEscapedHtml(html: string): void {
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('onerror="');
    expect(html).not.toContain("onerror='");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x");
}

function buildTicketEmailData(): TicketEmailData {
    return {
        ticketId: 1,
        title: XSS_PAYLOAD,
        description: `${XSS_PAYLOAD}\nรายละเอียดบรรทัดสอง`,
        category: "HARDWARE",
        priority: "HIGH",
        status: "OPEN",
        reportedBy: {
            email: "user@example.com",
            name: XSS_PAYLOAD,
            department: XSS_PAYLOAD,
        },
        assignedTo: {
            email: "agent@example.com",
            name: XSS_PAYLOAD,
        },
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T01:00:00.000Z",
    };
}

describe("email template XSS escaping", () => {
    it("escapes user controlled ticket fields in new ticket emails", () => {
        const html = generateNewTicketEmailHTML(buildTicketEmailData());

        expectEscapedHtml(html);
        expect(html).toContain("รายละเอียดบรรทัดสอง");
        expect(html).toContain("<br>");
    });

    it("escapes user controlled ticket fields in status update emails", () => {
        const html = generateStatusUpdateEmailHTML(
            buildTicketEmailData(),
            "OPEN",
        );

        expectEscapedHtml(html);
    });

    it("escapes leave action and result free-text fields", () => {
        const actionHtml = generateLeaveActionEmailHTML(
            {
                leaveId: "leave-1",
                employeeName: XSS_PAYLOAD,
                managerId: 1,
                leaveType: "SICK",
                startDate: "2026-05-28",
                endDate: "2026-05-29",
                durationDays: 2,
                reason: XSS_PAYLOAD,
            },
            `https://example.com/dashboard?next=${XSS_PAYLOAD}`,
        );
        const resultHtml = generateLeaveResultEmailHTML({
            leaveId: "leave-1",
            employeeId: 1,
            employeeEmail: "user@example.com",
            status: "REJECTED",
            reason: XSS_PAYLOAD,
        });

        expectEscapedHtml(actionHtml);
        expectEscapedHtml(resultHtml);
    });

    it("escapes password reset display name and link attributes", () => {
        const html = generatePasswordResetEmailHTML(
            `https://example.com/reset?token=${XSS_PAYLOAD}`,
            XSS_PAYLOAD,
        );

        expectEscapedHtml(html);
    });
});
