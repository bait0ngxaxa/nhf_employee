-- Add the approved operator-managed IT Ticket priority contract.
-- The database default is a safe fallback; application creation maps priority from Ticket type.
ALTER TABLE `it_tickets`
    ADD COLUMN `priority` ENUM('P0', 'P1', 'P2', 'P3') NOT NULL DEFAULT 'P2',
    ADD COLUMN `triagedAt` DATETIME(3) NULL,
    ADD COLUMN `triagedByUserId` INTEGER NULL,
    ADD INDEX `it_tickets_status_priority_createdAt_id_idx`(`status`, `priority`, `createdAt`, `id`),
    ADD INDEX `it_tickets_status_triagedAt_priority_createdAt_id_idx`(`status`, `triagedAt`, `priority`, `createdAt`, `id`),
    ADD INDEX `it_tickets_triagedByUserId_idx`(`triagedByUserId`),
    ADD CONSTRAINT `it_tickets_triagedByUserId_fkey`
        FOREIGN KEY (`triagedByUserId`) REFERENCES `users`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `it_ticket_events`
    MODIFY COLUMN `kind` ENUM(
        'CREATED',
        'STATUS_CHANGED',
        'ASSIGNED',
        'UNASSIGNED',
        'CATEGORY_CHANGED',
        'PRIORITY_TRIAGED',
        'PRIORITY_CHANGED'
    ) NOT NULL,
    ADD COLUMN `fromPriority` ENUM('P0', 'P1', 'P2', 'P3') NULL,
    ADD COLUMN `toPriority` ENUM('P0', 'P1', 'P2', 'P3') NULL,
    ADD COLUMN `priorityReason` VARCHAR(500) NULL;
