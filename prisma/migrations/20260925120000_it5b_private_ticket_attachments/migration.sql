ALTER TABLE `it_ticket_comments`
    ADD UNIQUE INDEX `it_ticket_comments_ticketId_id_key` (`ticketId`, `id`);

CREATE TABLE `it_ticket_attachments` (
    `id` VARCHAR(32) NOT NULL,
    `ticketId` INTEGER NOT NULL,
    `commentId` VARCHAR(30) NOT NULL,
    `uploaderUserId` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `contentType` VARCHAR(64) NOT NULL,
    `contentSha256` CHAR(64) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `it_ticket_attachments_storageKey_key` (`storageKey`),
    UNIQUE INDEX `it_ticket_attachments_commentId_position_key` (`commentId`, `position`),
    INDEX `it_ticket_attachments_ticketId_commentId_idx` (`ticketId`, `commentId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `it_ticket_attachments_ticketId_fkey`
        FOREIGN KEY (`ticketId`) REFERENCES `it_tickets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `it_ticket_attachments_ticketId_commentId_fkey`
        FOREIGN KEY (`ticketId`, `commentId`) REFERENCES `it_ticket_comments` (`ticketId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `it_ticket_attachments_uploaderUserId_fkey`
        FOREIGN KEY (`uploaderUserId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
