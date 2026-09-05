export interface EmailData {
    to: string;
    subject: string;
    html: string;
    text?: string;
    messageId?: string;
    fromName?: string;
}

export type {
    StockRequestResultEmailPayload,
    StockRequestResultStatus,
} from "@/modules/stock";
