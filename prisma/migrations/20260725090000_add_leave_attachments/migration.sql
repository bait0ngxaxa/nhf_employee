-- CreateTable
CREATE TABLE `leave_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `leaveRequestId` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `contentType` VARCHAR(64) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `leave_attachments_storageKey_key`(`storageKey`),
    INDEX `leave_attachments_leaveRequestId_idx`(`leaveRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `leave_attachments`
    ADD CONSTRAINT `leave_attachments_leaveRequestId_fkey`
    FOREIGN KEY (`leaveRequestId`) REFERENCES `leave_requests`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
