export interface EmailData {
    to: string;
    subject: string;
    html: string;
    text?: string;
    messageId?: string;
    fromName?: string;
}

export interface RoutineReminderEmailData {
    to: string;
    recipientName: string;
    taskTitle: string;
    unitName: string;
    categoryName: string;
    dueDate: string;
    daysBefore: number;
    actionUrl: string;
    occurrenceId: number;
    ruleId: number;
    userId: number;
    reminderVersion: number;
}

export interface RoutineContractExpiryEmailData {
    to: string;
    recipientName: string;
    taskTitle: string;
    unitName: string;
    categoryName: string;
    contractEndDate: string;
    actionUrl: string;
    taskId: number;
    userId: number;
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
} from "@/lib/services/stock/notification-payloads";
