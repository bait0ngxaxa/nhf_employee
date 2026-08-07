-- Split Routine reminder email delivery into one retryable outbox event per recipient.
ALTER TABLE `notification_outbox`
    MODIFY `type` ENUM(
        'TICKET_CREATED',
        'TICKET_UPDATED',
        'TICKET_CREATED_IN_APP',
        'TICKET_CREATED_LINE',
        'TICKET_CREATED_EMAIL_REPORTER',
        'TICKET_CREATED_EMAIL_IT',
        'TICKET_UPDATED_IN_APP_REPORTER',
        'TICKET_UPDATED_EMAIL_REPORTER',
        'TICKET_UPDATED_LINE',
        'TICKET_COMMENT_IN_APP',
        'EMAIL_REQUEST',
        'LEAVE_ACTION',
        'LEAVE_RESULT',
        'LEAVE_CANCELLED',
        'LEAVE_CANCELLATION_REQUESTED',
        'LEAVE_CANCELLED_AFTER_APPROVAL',
        'LEAVE_NOT_TAKEN_REQUESTED',
        'LEAVE_NOT_TAKEN_CONFIRMED',
        'STOCK_REQUEST_LINE',
        'STOCK_LOW_LINE',
        'STOCK_REQUEST_RESULT_EMAIL',
        'ROUTINE_REMINDER_IN_APP',
        'ROUTINE_REMINDER_EMAIL'
    ) NOT NULL;
