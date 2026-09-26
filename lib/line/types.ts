import type { EmailRequestData } from "@/modules/it";
import type { LineFlexMessage } from "@/types/api";

export interface LineWebhookData {
    type: "email_request";
    emailRequest: EmailRequestData;
    flexMessage: LineFlexMessage;
}
