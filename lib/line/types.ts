import {
    type LineNotificationData,
    type EmailRequestData,
    type LineFlexMessage,
} from "@/types/api";

export interface LineWebhookData {
    type: "new_ticket" | "status_update" | "it_team_urgent" | "email_request";
    ticket?: LineNotificationData;
    emailRequest?: EmailRequestData;
    oldStatus?: string;
    flexMessage: LineFlexMessage;
}
