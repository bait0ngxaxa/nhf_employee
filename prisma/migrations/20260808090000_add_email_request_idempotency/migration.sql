CREATE TABLE `email_request_idempotency` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `idempotencyKey` VARCHAR(255) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `emailRequestId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_request_idempotency_userId_idempotencyKey_key` (`userId`, `idempotencyKey`),
    UNIQUE INDEX `email_request_idempotency_emailRequestId_key` (`emailRequestId`),
    INDEX `email_request_idempotency_createdAt_idx` (`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `email_request_idempotency`
    ADD CONSTRAINT `email_request_idempotency_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `email_request_idempotency`
    ADD CONSTRAINT `email_request_idempotency_emailRequestId_fkey`
    FOREIGN KEY (`emailRequestId`) REFERENCES `email_requests`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
