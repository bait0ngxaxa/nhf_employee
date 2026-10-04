import { getEmailRequestNotificationContent } from "../../domain/email-request/notification-content";
import { NOTIFICATION_ACTIONS, NOTIFICATION_FOOTER, NOTIFICATION_MODULES, notificationSubject } from "@/shared/notifications/presentation";
import { sendEmail } from "@/lib/email";
import type { EmailData } from "@/lib/email/types";
import { getPublicOrigin } from "@/lib/network/public-url";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { generateITNotificationEmailHTML } from "./email-template";

export function buildEmailRequestEmailData(
    emailRequestId: number | null,
    recipientEmail: string,
    recipientUserId: number,
    parentOutboxId: number,
    accessVersion?: number,
): EmailData {
    const actionUrl = new URL(
        APP_ROUTES.dashboardEmailRequest,
        getPublicOrigin(),
    ).toString();
    const label = emailRequestId === null
        ? "คำขออีเมลพนักงานใหม่"
        : `คำขออีเมลพนักงานใหม่ #${emailRequestId}`;
    const copy = getEmailRequestNotificationContent(accessVersion);
    const intro = copy.summary;
    const title = `${copy.title}${emailRequestId === null ? "" : ` #${emailRequestId}`}`;

    return {
        to: recipientEmail,
        subject: notificationSubject("IT", title),
        html: generateITNotificationEmailHTML({
            categoryLabel: "คำขออีเมลพนักงานใหม่",
            title,
            intro,
            referenceLabel: "รายการ",
            referenceValue: label,
            actionLabel: NOTIFICATION_ACTIONS.review,
            actionUrl,
        }),
        text: [
            "NHFapp | IT",
            "",
            title,
            intro,
            "",
            `รายการ: ${label}`,
            "",
            `ตรวจสอบคำขอ: ${actionUrl}`,
            "",
            NOTIFICATION_FOOTER,
        ].join("\n"),
        messageId: accessVersion !== undefined
            ? `<nhf-email-request-${emailRequestId}-access-${accessVersion}-user-${recipientUserId}@notifications.thainhf.org>`
            : emailRequestId === null
            ? `<nhf-email-request-outbox-${parentOutboxId}-user-${recipientUserId}@notifications.thainhf.org>`
            : `<nhf-email-request-${emailRequestId}-user-${recipientUserId}@notifications.thainhf.org>`,
        fromName: NOTIFICATION_MODULES.IT.sender,
    };
}

export function sendEmailRequestEmailNotification(
    emailRequestId: number | null,
    recipientEmail: string,
    recipientUserId: number,
    parentOutboxId: number,
    accessVersion?: number,
): Promise<boolean> {
    return sendEmail(buildEmailRequestEmailData(
        emailRequestId,
        recipientEmail,
        recipientUserId,
        parentOutboxId,
        accessVersion,
    ));
}
