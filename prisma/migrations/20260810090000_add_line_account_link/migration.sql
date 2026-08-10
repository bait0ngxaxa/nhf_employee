CREATE TABLE `line_account_links` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `lineUserId` VARCHAR(64) NOT NULL,
    `linkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `line_account_links_userId_key` (`userId`),
    UNIQUE INDEX `line_account_links_lineUserId_key` (`lineUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `line_account_links`
    ADD CONSTRAINT `line_account_links_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
