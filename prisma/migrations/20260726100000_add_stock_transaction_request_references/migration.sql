-- AlterTable
ALTER TABLE `stock_transactions`
    ADD COLUMN `stockRequestId` INTEGER NULL,
    ADD COLUMN `stockRequestItemId` INTEGER NULL,
    ADD COLUMN `referenceType` ENUM('STOCK_REQUEST') NULL,
    ADD COLUMN `referenceId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `stock_transactions_stockRequestId_idx` ON `stock_transactions`(`stockRequestId`);

-- CreateIndex
CREATE INDEX `stock_transactions_stockRequestItemId_idx` ON `stock_transactions`(`stockRequestItemId`);

-- CreateIndex
CREATE INDEX `stock_transactions_referenceType_referenceId_idx` ON `stock_transactions`(`referenceType`, `referenceId`);

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_stockRequestId_fkey` FOREIGN KEY (`stockRequestId`) REFERENCES `stock_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_stockRequestItemId_fkey` FOREIGN KEY (`stockRequestItemId`) REFERENCES `stock_request_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
