-- AlterTable
ALTER TABLE `notification_outbox`
    ADD COLUMN `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD') NOT NULL DEFAULT 'PENDING';

-- Replace the status-only index with the due-work lookup index.
DROP INDEX `notification_outbox_status_idx` ON `notification_outbox`;
CREATE INDEX `notification_outbox_status_nextAttemptAt_idx`
    ON `notification_outbox`(`status`, `nextAttemptAt`);
