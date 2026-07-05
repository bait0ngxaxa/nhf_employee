import { describe, expect, it } from "vitest";
import type { TicketEmailData } from "@/types/api";
import { generateLeaveActionEmailHTML } from "@/lib/email/templates/leave-action";
import { generateLeaveEventEmailHTML } from "@/lib/email/templates/leave-event";
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
        const html = generateNewTicketEmailHTML(
            buildTicketEmailData(),
            "https://example.com/dashboard/it-issues",
        );

        expectEscapedHtml(html);
        expect(html).toContain("รายละเอียดบรรทัดสอง");
        expect(html).toContain("<br>");
    });

    it("escapes user controlled ticket fields in status update emails", () => {
        const html = generateStatusUpdateEmailHTML(
            buildTicketEmailData(),
            "OPEN",
            "https://example.com/dashboard/it-issues",
        );

        expectEscapedHtml(html);
    });

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
});
