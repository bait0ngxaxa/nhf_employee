-- AlterTable
ALTER TABLE `stock_requests` ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `cancelledById` INTEGER NULL,
    MODIFY `status` ENUM('PENDING', 'APPROVED', 'CANCELLED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX `stock_requests_cancelledById_idx` ON `stock_requests`(`cancelledById`);

-- AddForeignKey
ALTER TABLE `stock_requests` ADD CONSTRAINT `stock_requests_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `stock_requests` RENAME INDEX `stock_requests_reviewedBy_fkey` TO `stock_requests_reviewedBy_idx`;
