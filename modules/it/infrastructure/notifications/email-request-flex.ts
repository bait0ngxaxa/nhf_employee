import type { LineFlexMessage } from "@/types/api";
import { buildNotificationFlex, notificationFlexText } from "@/lib/line/notification-flex";
import { NOTIFICATION_ACTIONS } from "@/shared/notifications/presentation";
import { getEmailRequestNotificationContent } from "../../domain/email-request/notification-content";

export function generateEmailRequestFlexMessage(emailRequestId: number | null, actionUrl: string, accessVersion?: number): LineFlexMessage {
    const copy = getEmailRequestNotificationContent(accessVersion);
    const label = `คำขออีเมลพนักงานใหม่${emailRequestId === null ? "" : ` #${emailRequestId}`}`;
    return buildNotificationFlex({
        module: "IT", categoryLabel: "คำขออีเมลพนักงานใหม่", title: copy.title,
        altText: `${copy.title}${emailRequestId === null ? "" : ` #${emailRequestId}`}`,
        contents: [notificationFlexText(label), notificationFlexText(copy.summary)],
        actionLabel: NOTIFICATION_ACTIONS.review, actionUrl, accentColor: "#7C3AED",
    });
}
