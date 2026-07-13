-- Terminal state for deliveries whose immutable recipient identity is no longer current.
ALTER TABLE `notification_outbox`
    MODIFY `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING';
