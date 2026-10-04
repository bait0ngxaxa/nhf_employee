import { NOTIFICATION_FOOTER, NOTIFICATION_MODULES, type NotificationModule } from "@/shared/notifications/presentation";
import { escapeHtml, textToHtml } from "./html";

export interface NotificationEmailDetail {
    readonly label: string;
    readonly value: string;
}

export interface NotificationEmailTemplateData {
    readonly module: NotificationModule;
    readonly categoryLabel: string;
    readonly title: string;
    readonly intro: string;
    readonly preheader?: string;
    readonly details: readonly NotificationEmailDetail[];
    readonly actionLabel: string;
    readonly actionUrl: string;
}

/** All content is plain text. Domains select fields; this shell escapes and renders. */
export function generateNotificationEmailHTML(data: NotificationEmailTemplateData): string {
    const title = escapeHtml(data.title);
    const actionUrl = escapeHtml(data.actionUrl);
    const rows = data.details.map(({ label, value }) => `
        <tr><td style="padding:12px 16px; border-bottom:1px solid #dce5eb; color:#527084; font-size:13px; vertical-align:top; width:30%;">${escapeHtml(label)}:</td><td style="padding:12px 16px; border-bottom:1px solid #dce5eb; color:#173b50; font-size:15px; word-break:break-word;">${textToHtml(value)}</td></tr>`).join("");

    return `<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0; padding:0; background-color:#f1f5f8; color:#243746; font-family:Arial, Tahoma, sans-serif; line-height:1.6;">
<span style="display:none; max-height:0; max-width:0; overflow:hidden; opacity:0; mso-hide:all;">${escapeHtml(data.preheader ?? data.intro)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background-color:#f1f5f8;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border:1px solid #dce5eb; border-radius:8px;">
<tr><td style="padding:22px 24px; background-color:#174a63; color:#ffffff; border-radius:8px 8px 0 0;">NHFapp&nbsp; | &nbsp;${escapeHtml(NOTIFICATION_MODULES[data.module].label)}</td></tr>
<tr><td style="padding:28px 24px;">
<p style="margin:0 0 8px; color:#527084; font-size:13px; font-weight:bold;">${escapeHtml(data.categoryLabel)}</p>
<h1 style="margin:0 0 16px; color:#173b50; font-size:24px; line-height:1.4;">${title}</h1>
<p style="margin:0 0 24px;">${textToHtml(data.intro)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0 0 26px; background-color:#f7fafc;">${rows}</table>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;"><tr><td align="center" bgcolor="#176b87" style="border-radius:5px;"><a href="${actionUrl}" style="display:inline-block; padding:12px 24px; border:1px solid #176b87; border-radius:5px; color:#ffffff; font-size:15px; font-weight:bold; text-decoration:none;">${escapeHtml(data.actionLabel)}</a></td></tr></table>
<p style="margin:0; color:#527084; font-size:12px; word-break:break-word;">หากปุ่มเปิดไม่ได้ ให้คัดลอกลิงก์นี้ไปยังเบราว์เซอร์:<br><a href="${actionUrl}" style="color:#176b87;">${actionUrl}</a></p>
</td></tr>
<tr><td style="padding:18px 24px; border-top:1px solid #e3eaf0; color:#527084; font-size:12px;">${NOTIFICATION_FOOTER}</td></tr>
</table></td></tr></table>
</body></html>`;
}
