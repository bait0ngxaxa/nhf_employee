-- AlterTable
ALTER TABLE `stock_requests`
ADD COLUMN `projectCode` VARCHAR(100) NOT NULL AFTER `requestedBy`;

-- CreateIndex
CREATE INDEX `stock_requests_projectCode_idx` ON `stock_requests`(`projectCode`);
