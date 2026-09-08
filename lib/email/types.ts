export interface EmailData {
    to: string;
    subject: string;
    html: string;
    text?: string;
    messageId?: string;
    fromName?: string;
}
