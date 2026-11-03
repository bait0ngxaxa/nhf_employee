import type { NotificationStatus } from "@/shared/notifications/presentation";
import type { ITTicketNotificationPayloadV1 } from "../../domain/ticket-notification";

const IT_TICKET_NOTIFICATION_STATUS = {
    CREATED: "information",
    ASSIGNED: "information",
    OPERATOR_COMMENTED: "information",
    REQUESTER_COMMENTED: "information",
    WAITING_REQUESTER: "warning",
    RESOLVED: "success",
} satisfies Record<ITTicketNotificationPayloadV1["event"], NotificationStatus>;

export function getITTicketNotificationStatus(
    event: ITTicketNotificationPayloadV1["event"],
): NotificationStatus {
    return IT_TICKET_NOTIFICATION_STATUS[event];
}
