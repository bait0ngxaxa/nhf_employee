-- CreateTable
CREATE TABLE `email_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `thaiName` VARCHAR(191) NOT NULL,
    `englishName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `replyEmail` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `requestedBy` INTEGER NOT NULL,
    `note` TEXT NULL,

    INDEX `email_requests_requestedBy_idx`(`requestedBy`),
    INDEX `email_requests_status_idx`(`status`),
    INDEX `email_requests_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_requests` ADD CONSTRAINT `email_requests_requestedBy_fkey` FOREIGN KEY (`requestedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
