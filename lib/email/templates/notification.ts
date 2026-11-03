import {
    NOTIFICATION_COLORS,
    NOTIFICATION_FOOTER,
    NOTIFICATION_MODULES,
    NOTIFICATION_STATUS_COLORS,
    type NotificationModule,
    type NotificationStatus,
} from "@/shared/notifications/presentation";
import { escapeHtml, textToHtml } from "./html";

export interface NotificationEmailDetail {
    readonly label: string;
    readonly value: string;
    readonly status?: NotificationStatus;
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
    readonly status?: NotificationStatus;
}

/** All content is plain text. Domains select fields; this shell escapes and renders. */
export function generateNotificationEmailHTML(data: NotificationEmailTemplateData): string {
    const title = escapeHtml(data.title);
    const actionUrl = escapeHtml(data.actionUrl);
    const titleColor = data.status
        ? NOTIFICATION_STATUS_COLORS[data.status]
        : NOTIFICATION_COLORS.heading;
    const rows = data.details.map(({ label, value, status }) => {
        const valueColor = status
            ? NOTIFICATION_STATUS_COLORS[status]
            : NOTIFICATION_COLORS.body;

        return `
        <tr><td width="34%" style="padding:10px 12px; border-bottom:1px solid ${NOTIFICATION_COLORS.border}; color:${NOTIFICATION_COLORS.muted}; font-size:13px; vertical-align:top; width:34%; word-break:break-word;">${escapeHtml(label)}:</td><td width="66%" style="padding:10px 12px; border-bottom:1px solid ${NOTIFICATION_COLORS.border}; color:${valueColor}; font-size:14px; vertical-align:top; word-break:break-word;">${textToHtml(value)}</td></tr>`;
    }).join("");
    const detailsTable = rows
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0 0 20px; background-color:${NOTIFICATION_COLORS.surfaceSubtle}; border:1px solid ${NOTIFICATION_COLORS.border}; border-collapse:collapse;">${rows}</table>`
        : "";

    return `<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0; padding:0; background-color:${NOTIFICATION_COLORS.surfaceSubtle}; color:${NOTIFICATION_COLORS.body}; font-family:'Noto Sans Thai', Tahoma, Arial, sans-serif; line-height:1.6;">
<span style="display:none; max-height:0; max-width:0; overflow:hidden; opacity:0; mso-hide:all;">${escapeHtml(data.preheader ?? data.intro)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background-color:${NOTIFICATION_COLORS.surfaceSubtle};"><tr><td align="center" style="padding:20px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background-color:${NOTIFICATION_COLORS.surface}; border:1px solid ${NOTIFICATION_COLORS.border}; border-radius:8px;">
<tr><td style="padding:15px 20px; background-color:${NOTIFICATION_COLORS.brandPrimary}; color:${NOTIFICATION_COLORS.surface}; border-radius:8px 8px 0 0; font-size:15px; font-weight:bold;">NHFapp&nbsp; | &nbsp;${escapeHtml(NOTIFICATION_MODULES[data.module].label)}</td></tr>
<tr><td style="padding:20px;">
<p style="margin:0 0 5px; color:${NOTIFICATION_COLORS.muted}; font-size:12px; font-weight:bold;">${escapeHtml(data.categoryLabel)}</p>
<h1 style="margin:0 0 12px; color:${titleColor}; font-size:21px; line-height:1.4; word-break:break-word;">${title}</h1>
<p style="margin:0 0 18px; color:${NOTIFICATION_COLORS.body}; font-size:14px;">${textToHtml(data.intro)}</p>
${detailsTable}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 18px;"><tr><td align="center" bgcolor="${NOTIFICATION_COLORS.brandAction}" style="border-radius:5px;"><a href="${actionUrl}" style="display:inline-block; padding:11px 22px; border:1px solid ${NOTIFICATION_COLORS.brandAction}; border-radius:5px; color:${NOTIFICATION_COLORS.surface}; font-size:14px; font-weight:bold; line-height:1.5; text-decoration:none;">${escapeHtml(data.actionLabel)}</a></td></tr></table>
<p style="margin:0; color:${NOTIFICATION_COLORS.muted}; font-size:12px; word-break:break-all;">หากปุ่มเปิดไม่ได้ ให้คัดลอกลิงก์นี้ไปยังเบราว์เซอร์:<br><a href="${actionUrl}" style="color:${NOTIFICATION_COLORS.brandAction}; word-break:break-all;">${actionUrl}</a></p>
</td></tr>
<tr><td style="padding:14px 20px; border-top:1px solid ${NOTIFICATION_COLORS.border}; color:${NOTIFICATION_COLORS.muted}; font-size:12px;">${NOTIFICATION_FOOTER}</td></tr>
</table></td></tr></table>
</body></html>`;
}
