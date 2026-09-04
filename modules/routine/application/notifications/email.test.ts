import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMailMock = vi.hoisted(() => vi.fn());
const verifyMock = vi.hoisted(() => vi.fn());
const createTransportMock = vi.hoisted(() => vi.fn(() => ({
    sendMail: sendMailMock,
    verify: verifyMock,
})));

vi.mock("nodemailer", () => ({
    default: {
        createTransport: () => createTransportMock(),
    },
}));

import { sendRoutineReminderNotification } from "./email";
import { generateRoutineReminderEmailHTML } from "./routine-reminder-email";

const XSS_PAYLOAD = `<script>alert("xss")</script><img src=x onerror="alert('x')">`;

function expectEscapedHtml(html: string): void {
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('onerror="');
    expect(html).not.toContain("onerror='");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x");
}

describe("Routine email notifications", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SMTP_USER = "user";
        process.env.SMTP_PASS = "pass";
        process.env.SMTP_HOST = "smtp.test";
        process.env.SMTP_PORT = "587";
        verifyMock.mockResolvedValue(true);
        sendMailMock.mockResolvedValue({ messageId: "123" });
    });

    it("sends an escaped HTML/text reminder with a deterministic Message-ID", async () => {
        const data = {
            to: "user@example.com",
            recipientName: "ผู้รับการแจ้งเตือน",
            taskTitle: "งาน <ทดสอบ>\n",
            unitName: "หน่วยงาน",
            categoryName: "หมวดหมู่",
            dueDate: "2026-08-05",
            daysBefore: 2,
            actionUrl: "/dashboard/routine?taskId=71&occurrenceId=91",
            occurrenceId: 91,
            ruleId: 31,
            userId: 17,
            reminderVersion: 2,
        };

        await sendRoutineReminderNotification(data);
        await sendRoutineReminderNotification(data);

        expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
            from: '"ระบบ NHF Routine" <user>',
            to: "user@example.com",
            subject: "[NHF Routine] งานใกล้ถึงกำหนด: งาน <ทดสอบ>",
            messageId: "<nhf-routine-91-rule-31-user-17-v2@notifications.thainhf.org>",
            html: expect.stringContaining("งาน &lt;ทดสอบ&gt;"),
            text: expect.stringContaining(
                "ดูรายการ Routine: http://localhost:3000/dashboard/routine?taskId=71&occurrenceId=91",
            ),
        }));
        expect(sendMailMock.mock.calls[0]?.[0].messageId).toBe(
            sendMailMock.mock.calls[1]?.[0].messageId,
        );
    });

    it("escapes Routine reminder fields and action links", () => {
        const html = generateRoutineReminderEmailHTML({
            to: "user@example.com",
            recipientName: XSS_PAYLOAD,
            taskTitle: XSS_PAYLOAD,
            unitName: XSS_PAYLOAD,
            categoryName: XSS_PAYLOAD,
            dueDate: "2026-05-28",
            daysBefore: 1,
            actionUrl: `https://example.com/dashboard?next=${XSS_PAYLOAD}`,
            occurrenceId: 1,
            ruleId: 2,
            userId: 3,
            reminderVersion: 4,
        });

        expectEscapedHtml(html);
        expect(html).toContain("ดูรายการ Routine");
    });
});
