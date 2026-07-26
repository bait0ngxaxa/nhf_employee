CREATE TABLE `leave_request_idempotency` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `idempotencyKey` VARCHAR(255) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `leaveRequestId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `leave_request_idempotency_userId_idempotencyKey_key` (`userId`, `idempotencyKey`),
    UNIQUE INDEX `leave_request_idempotency_leaveRequestId_key` (`leaveRequestId`),
    INDEX `leave_request_idempotency_createdAt_idx` (`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `leave_request_idempotency`
    ADD CONSTRAINT `leave_request_idempotency_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `leave_request_idempotency`
    ADD CONSTRAINT `leave_request_idempotency_leaveRequestId_fkey`
    FOREIGN KEY (`leaveRequestId`) REFERENCES `leave_requests`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
