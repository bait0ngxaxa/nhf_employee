import type { EmailData } from "@/lib/email/types";
import { sendEmail } from "@/lib/email";
import { getPublicOrigin } from "@/lib/network/public-url";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { generateITNotificationEmailHTML } from "./email-template";

import type { ITTicketNotificationPayloadV1 } from "../../domain/ticket-notification";

interface ITTicketEmailCopy {
    readonly subject: (ticketId: number) => string;
    readonly body: string;
    readonly actionLabel: string;
}

const IT_TICKET_EMAIL_COPY: Record<ITTicketNotificationPayloadV1["event"], ITTicketEmailCopy> = {
    CREATED: {
        subject: (ticketId) => `มี Ticket IT ใหม่ #${ticketId}`,
        body: "มีคำขอ IT ใหม่รอรับเรื่อง",
        actionLabel: "เปิด Ticket ในระบบ",
    },
    ASSIGNED: {
        subject: (ticketId) => `คุณได้รับมอบหมาย Ticket IT #${ticketId}`,
        body: "มี Ticket IT มอบหมายให้คุณ",
        actionLabel: "เปิด Ticket ในระบบ",
    },
    OPERATOR_COMMENTED: {
        subject: (ticketId) => `IT ตอบกลับ Ticket IT #${ticketId} แล้ว`,
        body: "IT ตอบกลับคำขอของคุณแล้ว",
        actionLabel: "เปิด Ticket ในระบบ",
    },
    REQUESTER_COMMENTED: {
        subject: (ticketId) => `มีข้อความใหม่ใน Ticket IT #${ticketId}`,
        body: "ผู้ขอส่งข้อความใหม่ใน Ticket IT",
        actionLabel: "เปิด Ticket ในระบบ",
    },
    WAITING_REQUESTER: {
        subject: (ticketId) => `IT ต้องการข้อมูลเพิ่มเติมสำหรับ Ticket IT #${ticketId}`,
        body: "IT ต้องการข้อมูลเพิ่มเติมเพื่อดำเนินการต่อ",
        actionLabel: "เปิด Ticket ในระบบ",
    },
    RESOLVED: {
        subject: (ticketId) => `Ticket IT #${ticketId} ได้รับการแก้ไขแล้ว`,
        body: "คำขอ IT ของคุณได้รับการแก้ไขแล้ว",
        actionLabel: "ดู Ticket ในระบบ",
    },
};

function getTicketActionUrl(payload: ITTicketNotificationPayloadV1): string {
    const route = payload.audience === "REQUESTER"
        ? APP_ROUTES.dashboardIT
        : APP_ROUTES.dashboardITQueue;
    return new URL(`${route}/${payload.ticketId}`, getPublicOrigin()).toString();
}

function buildITTicketMessageId(eventKey: string): string {
    const safeIdentity = eventKey.replace(/[^a-zA-Z0-9._-]/g, "-");
    return `<nhf-it-${safeIdentity}@notifications.thainhf.org>`;
}

export function buildITTicketEmailData(
    payload: ITTicketNotificationPayloadV1,
    to: string,
    eventKey: string,
): EmailData {
    const copy = IT_TICKET_EMAIL_COPY[payload.event];
    const ticketLabel = `Ticket IT #${payload.ticketId}`;
    const actionUrl = getTicketActionUrl(payload);
    const subject = copy.subject(payload.ticketId);

    return {
        to,
        subject,
        html: generateITNotificationEmailHTML({
            title: subject,
            intro: copy.body,
            referenceLabel: "เลขที่ Ticket",
            referenceValue: ticketLabel,
            actionLabel: copy.actionLabel,
            actionUrl,
        }),
        text: [
            "ระบบ NHFapp | ระบบ NHF IT",
            "",
            copy.body,
            "",
            `เลขที่ Ticket: ${ticketLabel}`,
            "",
            `${copy.actionLabel}: ${actionUrl}`,
            "",
            "ระบบ NHFapp ส่งอีเมลฉบับนี้โดยอัตโนมัติ กรุณาอย่าตอบกลับ",
        ].join("\n"),
        messageId: buildITTicketMessageId(eventKey),
        fromName: "ระบบ NHF IT",
    };
}

export function sendITTicketEmailNotification(
    payload: ITTicketNotificationPayloadV1,
    to: string,
    eventKey: string,
): Promise<boolean> {
    return sendEmail(buildITTicketEmailData(payload, to, eventKey));
}
