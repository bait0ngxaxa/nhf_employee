import {
    type EmailRequestData,
    type LineFlexMessage,
} from "@/types/api";

export interface LineWebhookData {
    type: "email_request";
    emailRequest: EmailRequestData;
    flexMessage: LineFlexMessage;
}

export interface VerifiedLineIdentity {
    lineUserId: string;
}
