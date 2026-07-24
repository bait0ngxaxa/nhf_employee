CREATE TABLE `ticket_mutation_idempotency` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `idempotencyKey` VARCHAR(255) NOT NULL,
    `operation` ENUM('TICKET_CREATE', 'TICKET_COMMENT') NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `resourceId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ticket_mutation_idempotency_userId_idempotencyKey_key`
        (`userId`, `idempotencyKey`),
    INDEX `ticket_mutation_idempotency_createdAt_idx` (`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ticket_mutation_idempotency`
    ADD CONSTRAINT `ticket_mutation_idempotency_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
