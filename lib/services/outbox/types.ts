export const OUTBOX_NOTIFICATION_TYPES = [
    "TICKET_CREATED",
    "TICKET_UPDATED",
    "EMAIL_REQUEST",
    "LEAVE_ACTION",
    "LEAVE_RESULT",
    "LEAVE_CANCELLED",
    "LEAVE_NOT_TAKEN_REQUESTED",
    "LEAVE_NOT_TAKEN_CONFIRMED",
    "STOCK_REQUEST_LINE",
    "STOCK_LOW_LINE",
] as const;

export type OutboxNotificationType = (typeof OUTBOX_NOTIFICATION_TYPES)[number];

export const OUTBOX_STATUSES = [
    "PENDING",
    "PROCESSING",
    "SENT",
    "FAILED",
] as const;

export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const MAX_OUTBOX_ATTEMPTS = 3;
export const STALE_OUTBOX_PROCESSING_MINUTES = 10;

export function isOutboxNotificationType(
    value: string,
): value is OutboxNotificationType {
    return OUTBOX_NOTIFICATION_TYPES.includes(value as OutboxNotificationType);
}

