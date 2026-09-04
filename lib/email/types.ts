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
} from "@/modules/leave";

export type {
    StockRequestResultEmailPayload,
    StockRequestResultStatus,
} from "@/modules/stock";
