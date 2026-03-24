-- CreateTable
CREATE TABLE `auth_refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `tokenHash` VARCHAR(128) NOT NULL,
    `familyId` VARCHAR(64) NOT NULL,
    `rotatedFromId` VARCHAR(36) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `userAgent` VARCHAR(512) NULL,
    `ipAddress` VARCHAR(64) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `auth_refresh_tokens_tokenHash_key`(`tokenHash`),
    INDEX `auth_refresh_tokens_userId_idx`(`userId`),
    INDEX `auth_refresh_tokens_familyId_idx`(`familyId`),
    INDEX `auth_refresh_tokens_expiresAt_idx`(`expiresAt`),
    INDEX `auth_refresh_tokens_revokedAt_idx`(`revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `auth_refresh_tokens` ADD CONSTRAINT `auth_refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
