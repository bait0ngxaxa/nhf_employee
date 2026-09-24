-- IT2 introduces new IT-owned Ticket persistence. Retired legacy Ticket
-- tables, Email Request, and historical notification/audit enums are untouched.
CREATE TABLE `it_ticket_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `it_ticket_categories_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `it_tickets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('INCIDENT', 'SERVICE_REQUEST', 'SUGGESTION') NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `requesterUserId` INTEGER NOT NULL,
    `assignedToUserId` INTEGER NULL,
    `categoryId` INTEGER NULL,
    `requesterDepartmentId` INTEGER NULL,
    `requesterDepartmentNameSnapshot` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `it_tickets_requesterUserId_createdAt_id_idx`(`requesterUserId`, `createdAt`, `id`),
    INDEX `it_tickets_status_createdAt_id_idx`(`status`, `createdAt`, `id`),
    INDEX `it_tickets_assignedToUserId_status_createdAt_idx`(`assignedToUserId`, `status`, `createdAt`),
    INDEX `it_tickets_type_createdAt_idx`(`type`, `createdAt`),
    INDEX `it_tickets_categoryId_createdAt_idx`(`categoryId`, `createdAt`),
    INDEX `it_tickets_requesterDepartmentId_idx`(`requesterDepartmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `it_ticket_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` INTEGER NOT NULL,
    `actorUserId` INTEGER NOT NULL,
    `kind` ENUM('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'CATEGORY_CHANGED') NOT NULL,
    `fromStatus` ENUM('OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED', 'CANCELLED') NULL,
    `toStatus` ENUM('OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED', 'CANCELLED') NULL,
    `fromAssigneeUserId` INTEGER NULL,
    `toAssigneeUserId` INTEGER NULL,
    `fromCategoryId` INTEGER NULL,
    `toCategoryId` INTEGER NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `it_ticket_events_ticketId_occurredAt_id_idx`(`ticketId`, `occurredAt`, `id`),
    INDEX `it_ticket_events_actorUserId_idx`(`actorUserId`),
    INDEX `it_ticket_events_fromAssigneeUserId_idx`(`fromAssigneeUserId`),
    INDEX `it_ticket_events_toAssigneeUserId_idx`(`toAssigneeUserId`),
    INDEX `it_ticket_events_fromCategoryId_idx`(`fromCategoryId`),
    INDEX `it_ticket_events_toCategoryId_idx`(`toCategoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `it_ticket_create_idempotency` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requesterUserId` INTEGER NOT NULL,
    `idempotencyKey` VARCHAR(255) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `ticketId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `it_ticket_create_idempotency_ticketId_key`(`ticketId`),
    UNIQUE INDEX `it_ticket_create_idempotency_requesterUserId_idempotencyKey_key`(`requesterUserId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `it_tickets`
    ADD CONSTRAINT `it_tickets_requesterUserId_fkey`
    FOREIGN KEY (`requesterUserId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_tickets`
    ADD CONSTRAINT `it_tickets_assignedToUserId_fkey`
    FOREIGN KEY (`assignedToUserId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_tickets`
    ADD CONSTRAINT `it_tickets_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `it_ticket_categories`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_tickets`
    ADD CONSTRAINT `it_tickets_requesterDepartmentId_fkey`
    FOREIGN KEY (`requesterDepartmentId`) REFERENCES `departments`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `it_ticket_events`
    ADD CONSTRAINT `it_ticket_events_ticketId_fkey`
    FOREIGN KEY (`ticketId`) REFERENCES `it_tickets`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_ticket_events`
    ADD CONSTRAINT `it_ticket_events_actorUserId_fkey`
    FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_ticket_events`
    ADD CONSTRAINT `it_ticket_events_fromAssigneeUserId_fkey`
    FOREIGN KEY (`fromAssigneeUserId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_ticket_events`
    ADD CONSTRAINT `it_ticket_events_toAssigneeUserId_fkey`
    FOREIGN KEY (`toAssigneeUserId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_ticket_events`
    ADD CONSTRAINT `it_ticket_events_fromCategoryId_fkey`
    FOREIGN KEY (`fromCategoryId`) REFERENCES `it_ticket_categories`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_ticket_events`
    ADD CONSTRAINT `it_ticket_events_toCategoryId_fkey`
    FOREIGN KEY (`toCategoryId`) REFERENCES `it_ticket_categories`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_ticket_create_idempotency`
    ADD CONSTRAINT `it_ticket_create_idempotency_requesterUserId_fkey`
    FOREIGN KEY (`requesterUserId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_ticket_create_idempotency`
    ADD CONSTRAINT `it_ticket_create_idempotency_ticketId_fkey`
    FOREIGN KEY (`ticketId`) REFERENCES `it_tickets`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
