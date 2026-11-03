import { describe, expect, it } from "vitest";
import { generateNotificationEmailHTML } from "@/lib/email/templates/notification";
import {
    NOTIFICATION_COLORS,
    NOTIFICATION_MODULES,
    NOTIFICATION_STATUS_COLORS,
    notificationSubject,
    notificationAltText,
    type NotificationModule,
} from "@/shared/notifications/presentation";
import { generatePasswordResetEmailHTML } from "@/lib/email/templates/password-reset";

describe("NHFapp notification presentation contract", () => {
    it("keeps brand and semantic status colors in separate serializable token maps", () => {
        expect(NOTIFICATION_COLORS).toMatchObject({
            brandPrimary: "#174A63",
            brandAction: "#176B87",
            surface: "#FFFFFF",
            surfaceSubtle: "#F3F7F9",
        });
        expect(NOTIFICATION_STATUS_COLORS).toEqual({
            information: "#2563EB",
            success: "#047857",
            warning: "#B45309",
            danger: "#B91C1C",
            neutral: NOTIFICATION_COLORS.muted,
        });
        expect(JSON.parse(JSON.stringify(NOTIFICATION_STATUS_COLORS))).toEqual(NOTIFICATION_STATUS_COLORS);
    });

    it.each(["IT", "Leave", "Routine", "Stock", "Account"] as const)("renders the same Email structure with %s identity", (module) => {
        const html = generateNotificationEmailHTML({ module, categoryLabel: "หมวดทดสอบ", title: "ผลการดำเนินการ",
            intro: "กรุณาตรวจสอบรายละเอียด", details: [{ label: "เลขที่", value: "#123" }],
            actionLabel: "เปิดรายละเอียด", actionUrl: "https://app.example.com/details" });
        expect(html).toContain(`NHFapp&nbsp; | &nbsp;${NOTIFICATION_MODULES[module].label}`);
        expect(html).toContain('lang="th"');
        expect(html).toContain('role="presentation"');
        expect(html).toContain("max-width:600px");
        expect(html).toContain("หมวดทดสอบ");
        expect(html).toContain("<h1");
        expect(html).toContain("ผลการดำเนินการ");
        expect(html).toContain("เปิดรายละเอียด");
        expect(html.match(/href="https:\/\/app.example.com\/details"/g)).toHaveLength(2);
        expect(html).toContain("หากปุ่มเปิดไม่ได้");
        expect(html).toContain("กรุณาอย่าตอบกลับ");
    });

    it("escapes every dynamic content position without accepting raw HTML", () => {
        const unsafe = '<script>bad()</script>"&';
        const html = generateNotificationEmailHTML({ module: "IT", categoryLabel: unsafe, title: unsafe, intro: unsafe,
            preheader: unsafe, details: [{ label: unsafe, value: `${unsafe}\nอีกบรรทัด` }], actionLabel: unsafe,
            actionUrl: `https://app.example.com/?q=${unsafe}` });
        expect(html).not.toContain("<script>");
        expect(html).not.toContain('q=<script>');
        expect(html).toContain("&lt;script&gt;bad()&lt;/script&gt;&quot;&amp;");
        expect(html).toContain("<br>อีกบรรทัด");
    });

    it("uses email-safe Thai fallbacks, compact spacing, semantic colors and wrapping", () => {
        const longThaiValue = "ชื่องานภาษาไทย".repeat(30);
        const longActionLabel = "เปิดดูงาน".repeat(8);
        const longUrl = `https://app.example.com/task?name=${"งาน".repeat(80)}&view=details`;
        const html = generateNotificationEmailHTML({
            module: "Routine",
            categoryLabel: "งานตามกำหนด",
            title: "งานใกล้ถึงกำหนด",
            intro: "กรุณาตรวจสอบงาน",
            details: [{ label: "ชื่อหน่วยงาน".repeat(8), value: longThaiValue, status: "warning" }],
            actionLabel: longActionLabel,
            actionUrl: longUrl,
            status: "warning",
        });

        expect(html).toContain("font-family:'Noto Sans Thai', Tahoma, Arial, sans-serif");
        expect(html).toContain("max-width:600px");
        expect(html).toContain("word-break:break-word");
        expect(html).toContain("word-break:break-all");
        expect(html).toContain("color:#B45309");
        expect(html).toContain("ชื่อหน่วยงาน".repeat(8));
        expect(html).toContain(longThaiValue);
        expect(html).toContain(`href="https://app.example.com/task?name=${"งาน".repeat(80)}&amp;view=details"`);
        expect(html).toContain(longActionLabel);
        expect(html).not.toContain("<script");
    });

    it("omits the details table when no optional detail rows are present", () => {
        const html = generateNotificationEmailHTML({
            module: "IT",
            categoryLabel: "Ticket IT",
            title: "มี Ticket IT ใหม่",
            intro: "รอรับเรื่องในคิว IT",
            details: [],
            actionLabel: "เปิด Ticket",
            actionUrl: "https://app.example.com/dashboard/it/queue/123",
        });

        expect(html).toContain("รอรับเรื่องในคิว IT");
        expect(html).not.toContain("border-collapse:collapse");
    });

    it.each(Object.keys(NOTIFICATION_MODULES) as NotificationModule[])("uses one subject convention and rejects CR/LF in %s content", (module) => {
        expect(notificationSubject(module, " งาน\r\nทดสอบ ")).toBe(`[NHFapp][${module}] งาน ทดสอบ`);
        expect(NOTIFICATION_MODULES[module].sender).toMatch(/^NHFapp \| /);
        expect(notificationAltText(module, "ผลการดำเนินการ")).toBe(`${NOTIFICATION_MODULES[module].label}: ผลการดำเนินการ`);
        expect(notificationAltText(module, "ก".repeat(500))).toHaveLength(400);
    });

    it("keeps password reset identity, expiry and non-requester advice without showing a token in the preheader", () => {
        const html = generatePasswordResetEmailHTML("https://app.example.com/reset-password?token=secret-token", "ผู้ใช้");
        expect(html).toContain("บัญชีผู้ใช้");
        expect(html).toContain("คำขอรีเซ็ตรหัสผ่าน");
        expect(html).toContain("ตั้งรหัสผ่านใหม่");
        expect(html).toContain("1 ชั่วโมง");
        expect(html).toContain("รหัสผ่านของคุณจะไม่ถูกเปลี่ยนแปลง");
        const preheader = html.match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1];
        expect(preheader).not.toContain("secret-token");
        expect(html.match(/secret-token/g)).toHaveLength(3); // CTA href and fallback href/text only.
    });
});
