import { sendEmail } from "@/lib/email";
import type { EmailData } from "@/lib/email/types";
import { escapeHtml } from "@/lib/email/templates/html";
import { getPublicOrigin } from "@/lib/network/public-url";
import { APP_ROUTES } from "@/lib/ssot/routes";

export function buildEmailRequestEmailData(
    emailRequestId: number | null,
    recipientEmail: string,
    recipientUserId: number,
    parentOutboxId: number,
): EmailData {
    const actionUrl = new URL(
        APP_ROUTES.dashboardEmailRequest,
        getPublicOrigin(),
    ).toString();
    const label = emailRequestId === null
        ? "คำร้องอีเมลพนักงานใหม่"
        : `คำร้องอีเมลพนักงานใหม่ #${emailRequestId}`;

    return {
        to: recipientEmail,
        subject: emailRequestId === null
            ? "มีคำขออีเมลพนักงานใหม่"
            : `มีคำขออีเมลพนักงานใหม่ #${emailRequestId}`,
        html: [
            `<p>${escapeHtml("มีคำขออีเมลพนักงานใหม่รอตรวจสอบ")}</p>`,
            `<p>${escapeHtml(label)}</p>`,
            `<p><a href="${escapeHtml(actionUrl)}">${escapeHtml("เปิดคำร้องในระบบ")}</a></p>`,
        ].join("\n"),
        text: `มีคำขออีเมลพนักงานใหม่รอตรวจสอบ\n${label}\nเปิดคำร้องในระบบ: ${actionUrl}`,
        messageId: emailRequestId === null
            ? `<nhf-email-request-outbox-${parentOutboxId}-user-${recipientUserId}@notifications.thainhf.org>`
            : `<nhf-email-request-${emailRequestId}-user-${recipientUserId}@notifications.thainhf.org>`,
        fromName: "ระบบ NHF IT",
    };
}

export function sendEmailRequestEmailNotification(
    emailRequestId: number | null,
    recipientEmail: string,
    recipientUserId: number,
    parentOutboxId: number,
): Promise<boolean> {
    return sendEmail(buildEmailRequestEmailData(
        emailRequestId,
        recipientEmail,
        recipientUserId,
        parentOutboxId,
    ));
}
