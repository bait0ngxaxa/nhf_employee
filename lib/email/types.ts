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
    LeaveCancellationRequestedPayload,
    LeaveCancelledAfterApprovalPayload,
    LeaveNotTakenConfirmedPayload,
    LeaveNotTakenRequestedPayload,
    LeaveResultPayload,
} from "@/lib/services/leave/notification-payloads";

export type {
    StockRequestResultEmailPayload,
    StockRequestResultStatus,
} from "@/modules/stock";
