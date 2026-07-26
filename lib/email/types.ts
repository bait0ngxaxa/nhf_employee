export interface EmailData {
    to: string;
    subject: string;
    html: string;
    text?: string;
    messageId?: string;
    fromName?: string;
}

export type {
    LeaveActionPayload,
    LeaveCancelledPayload,
    LeaveNotTakenConfirmedPayload,
    LeaveNotTakenRequestedPayload,
    LeaveResultPayload,
} from "@/lib/services/leave/notification-payloads";
