import { NOTIFICATION_ACTIONS } from "@/shared/notifications/presentation";
import { buildNotificationFlex, notificationFlexText } from "@/lib/line/notification-flex";
import { getITTicketNotificationContent } from "../../domain/ticket-notification-content";
import type { LineFlexMessage } from "@/types/api";
import { getPublicOrigin } from "@/lib/network/public-url";
import { APP_ROUTES } from "@/lib/ssot/routes";

import { buildITTicketLiffUrl } from "../../application/liff-links";
import type { ITTicketLineNotificationPayload } from "../../domain/ticket-notification";

const IT_TICKET_ACCENT_COLORS = {
    CREATED: "#2563EB",
    ASSIGNED: "#2563EB",
    OPERATOR_COMMENTED: "#2563EB",
    REQUESTER_COMMENTED: "#7C3AED",
    WAITING_REQUESTER: "#B45309",
    RESOLVED: "#047857",
} satisfies Record<ITTicketLineNotificationPayload["event"], string>;

function getActionUrl(payload: ITTicketLineNotificationPayload): string {
    if (payload.audience === "REQUESTER") {
        return buildITTicketLiffUrl(payload.ticketId);
    }

    return new URL(
        `${APP_ROUTES.dashboardITQueue}/${payload.ticketId}`,
        getPublicOrigin(),
    ).toString();
}

export function buildITTicketLineFlexMessage(
    payload: ITTicketLineNotificationPayload,
): LineFlexMessage {
    const copy = getITTicketNotificationContent(payload);
    return buildNotificationFlex({
        module: "IT", categoryLabel: "Ticket IT", title: copy.title,
        altText: `${copy.title} · ${copy.reference}`,
        contents: [notificationFlexText(copy.reference), notificationFlexText(copy.summary)],
        actionLabel: NOTIFICATION_ACTIONS.ticket, actionUrl: getActionUrl(payload), accentColor: IT_TICKET_ACCENT_COLORS[payload.event],
    });
}
