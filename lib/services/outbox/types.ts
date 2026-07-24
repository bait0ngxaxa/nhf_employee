export const OUTBOX_NOTIFICATION_TYPES = [
    "TICKET_CREATED",
    "TICKET_UPDATED",
    "TICKET_CREATED_IN_APP",
    "TICKET_CREATED_LINE",
    "TICKET_CREATED_EMAIL_REPORTER",
    "TICKET_CREATED_EMAIL_IT",
    "TICKET_UPDATED_IN_APP_REPORTER",
    "TICKET_UPDATED_EMAIL_REPORTER",
    "TICKET_UPDATED_LINE",
    "TICKET_COMMENT_IN_APP",
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
    "DEAD",
    "SUPERSEDED",
] as const;

export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const MAX_OUTBOX_ATTEMPTS = 3;
export const OUTBOX_RETRY_BASE_DELAY_MS = 60_000;
export const STALE_OUTBOX_PROCESSING_MINUTES = 10;

export function isOutboxNotificationType(
    value: string,
): value is OutboxNotificationType {
    return OUTBOX_NOTIFICATION_TYPES.includes(value as OutboxNotificationType);
}

