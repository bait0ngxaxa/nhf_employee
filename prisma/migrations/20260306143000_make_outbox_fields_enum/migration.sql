-- Convert notification_outbox columns to strict ENUM types for SSOT alignment
ALTER TABLE `notification_outbox`
    MODIFY `type` ENUM('TICKET_CREATED', 'TICKET_UPDATED', 'EMAIL_REQUEST') NOT NULL,
    MODIFY `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING';

