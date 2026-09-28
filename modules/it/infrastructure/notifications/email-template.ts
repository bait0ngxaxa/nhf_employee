import { escapeHtml } from "@/lib/email/templates/html";

export interface ITNotificationEmailTemplateData {
    readonly title: string;
    readonly intro: string;
    readonly referenceLabel: string;
    readonly referenceValue: string;
    readonly actionLabel: string;
    readonly actionUrl: string;
}

export function generateITNotificationEmailHTML(
    data: ITNotificationEmailTemplateData,
): string {
    const title = escapeHtml(data.title);
    const intro = escapeHtml(data.intro);
    const referenceLabel = escapeHtml(data.referenceLabel);
    const referenceValue = escapeHtml(data.referenceValue);
    const actionLabel = escapeHtml(data.actionLabel);
    const actionUrl = escapeHtml(data.actionUrl);

    return `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f8; color:#243746; font-family:Arial, Tahoma, sans-serif; line-height:1.6;">
    <span style="display:none; max-height:0; max-width:0; overflow:hidden; opacity:0; color:#f1f5f8; mso-hide:all;">${intro} ${referenceLabel}: ${referenceValue}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background-color:#f1f5f8;">
        <tr>
            <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border:1px solid #dce5eb; border-radius:8px;">
                    <tr>
                        <td style="padding:22px 32px; background-color:#174a63; border-radius:8px 8px 0 0; color:#ffffff;">
                            <p style="margin:0; font-size:13px; letter-spacing:0.4px;">NHFapp&nbsp; | &nbsp;ระบบ NHF IT</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;">
                            <p style="margin:0 0 8px; color:#527084; font-size:13px; font-weight:bold;">แจ้งเตือนระบบสารสนเทศ</p>
                            <h1 style="margin:0 0 16px; color:#173b50; font-size:24px; line-height:1.4;">${title}</h1>
                            <p style="margin:0 0 24px; color:#405563;">${intro}</p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0 0 26px; border:1px solid #dce5eb; border-radius:6px; background-color:#f7fafc;">
                                <tr>
                                    <td style="padding:14px 16px; color:#607482; font-size:13px;">${referenceLabel}</td>
                                    <td align="right" style="padding:14px 16px; color:#173b50; font-size:15px; font-weight:bold;">${referenceValue}</td>
                                </tr>
                            </table>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                                <tr>
                                    <td align="center" bgcolor="#176b87" style="border-radius:5px;">
                                        <a href="${actionUrl}" style="display:inline-block; padding:12px 24px; border:1px solid #176b87; border-radius:5px; color:#ffffff; font-size:15px; font-weight:bold; text-decoration:none;">${actionLabel}</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:0; color:#718391; font-size:12px; word-break:break-word;">หากปุ่มเปิดไม่ได้ ให้คัดลอกลิงก์นี้ไปยังเบราว์เซอร์:<br><a href="${actionUrl}" style="color:#176b87;">${actionUrl}</a></p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 32px; border-top:1px solid #e3eaf0; color:#718391; font-size:12px;">
                            ระบบ NHFapp ส่งอีเมลฉบับนี้โดยอัตโนมัติ กรุณาอย่าตอบกลับ
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}
