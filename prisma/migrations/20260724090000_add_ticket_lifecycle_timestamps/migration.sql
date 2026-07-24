-- AlterTable
ALTER TABLE `tickets`
    ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL;

-- Backfill the best available lifecycle timestamp for existing terminal tickets.
UPDATE `tickets`
SET `closedAt` = `updatedAt`
WHERE `status` = 'CLOSED' AND `closedAt` IS NULL;

UPDATE `tickets`
SET `cancelledAt` = `updatedAt`
WHERE `status` = 'CANCELLED' AND `cancelledAt` IS NULL;
