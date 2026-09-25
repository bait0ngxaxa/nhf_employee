-- IT5A adds shared, immutable Ticket conversation history and its retry contract.
-- Attachment, Notification, Audit, and historical Ticket storage remain untouched.
ALTER TABLE `it_tickets`
    ADD COLUMN `firstRespondedAt` DATETIME(3) NULL;

CREATE TABLE `it_ticket_comments` (
    `id` VARCHAR(30) NOT NULL,
    `ticketId` INTEGER NOT NULL,
    `authorUserId` INTEGER NOT NULL,
    `kind` ENUM('REQUESTER', 'OPERATOR') NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `it_ticket_comments_ticketId_createdAt_id_idx`(`ticketId`, `createdAt`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `it_ticket_comment_idempotency` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `authorUserId` INTEGER NOT NULL,
    `idempotencyKey` VARCHAR(255) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `commentId` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `it_ticket_comment_idempotency_commentId_key`(`commentId`),
    UNIQUE INDEX `it_ticket_comment_idempotency_authorUserId_idempotencyKey_key`(`authorUserId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `it_ticket_comments`
    ADD CONSTRAINT `it_ticket_comments_ticketId_fkey`
    FOREIGN KEY (`ticketId`) REFERENCES `it_tickets`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_ticket_comments`
    ADD CONSTRAINT `it_ticket_comments_authorUserId_fkey`
    FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_ticket_comment_idempotency`
    ADD CONSTRAINT `it_ticket_comment_idempotency_authorUserId_fkey`
    FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_ticket_comment_idempotency`
    ADD CONSTRAINT `it_ticket_comment_idempotency_commentId_fkey`
    FOREIGN KEY (`commentId`) REFERENCES `it_ticket_comments`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
