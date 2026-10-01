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
        ? "คำร้องอีเมลพนักงานใหม่"
        : `คำร้องอีเมลพนักงานใหม่ #${emailRequestId}`;
    const intro = accessVersion === undefined ? "มีคำขออีเมลพนักงานใหม่รอตรวจสอบ" : "มีการระบุหรือแก้ไขสิทธิ์การใช้งานเพิ่มเติม";
    const subject = accessVersion !== undefined
        ? `มีการอัปเดตสิทธิ์พนักงานใหม่ #${emailRequestId}`
        : emailRequestId === null
        ? "มีคำขออีเมลพนักงานใหม่"
        : `มีคำขออีเมลพนักงานใหม่ #${emailRequestId}`;

    return {
        to: recipientEmail,
        subject,
        html: generateITNotificationEmailHTML({
            title: subject,
            intro,
            referenceLabel: "รายการ",
            referenceValue: label,
            actionLabel: "เปิดคำร้องในระบบ",
            actionUrl,
        }),
        text: [
            "ระบบ NHFapp | ระบบ NHF IT",
            "",
            intro,
            "",
            `รายการ: ${label}`,
            "",
            `เปิดคำร้องในระบบ: ${actionUrl}`,
            "",
            "ระบบ NHFapp ส่งอีเมลฉบับนี้โดยอัตโนมัติ กรุณาอย่าตอบกลับ",
        ].join("\n"),
        messageId: accessVersion !== undefined
            ? `<nhf-email-request-${emailRequestId}-access-${accessVersion}-user-${recipientUserId}@notifications.thainhf.org>`
            : emailRequestId === null
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
