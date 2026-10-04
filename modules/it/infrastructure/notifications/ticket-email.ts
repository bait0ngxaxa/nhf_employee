import { NOTIFICATION_ACTIONS, NOTIFICATION_FOOTER, NOTIFICATION_MODULES, notificationSubject } from "@/shared/notifications/presentation";
import { getITTicketNotificationContent } from "../../domain/ticket-notification-content";
import type { EmailData } from "@/lib/email/types";
import { sendEmail } from "@/lib/email";
import { getPublicOrigin } from "@/lib/network/public-url";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { generateITNotificationEmailHTML } from "./email-template";

import type { ITTicketNotificationPayloadV1 } from "../../domain/ticket-notification";

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
    const copy = getITTicketNotificationContent(payload);
    const ticketLabel = `Ticket IT #${payload.ticketId}`;
    const actionUrl = getTicketActionUrl(payload);
    const subject = `${copy.title} #${payload.ticketId}`;

    return {
        to,
        subject: notificationSubject("IT", subject),
        html: generateITNotificationEmailHTML({
            categoryLabel: "Ticket IT",
            title: subject,
            intro: copy.summary,
            referenceLabel: "เลขที่ Ticket",
            referenceValue: ticketLabel,
            actionLabel: NOTIFICATION_ACTIONS.ticket,
            actionUrl,
        }),
        text: [
            "NHFapp | IT",
            "",
            subject,
            copy.summary,
            "",
            `เลขที่ Ticket: ${ticketLabel}`,
            "",
            `${NOTIFICATION_ACTIONS.ticket}: ${actionUrl}`,
            "",
            NOTIFICATION_FOOTER,
        ].join("\n"),
        messageId: buildITTicketMessageId(eventKey),
        fromName: NOTIFICATION_MODULES.IT.sender,
    };
}

export function sendITTicketEmailNotification(
    payload: ITTicketNotificationPayloadV1,
    to: string,
    eventKey: string,
): Promise<boolean> {
    return sendEmail(buildITTicketEmailData(payload, to, eventKey));
}
