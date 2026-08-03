-- Add the Routine reminder delivery type to the existing transactional outbox.
ALTER TABLE `notification_outbox`
    MODIFY `type` ENUM(
        'TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_CREATED_IN_APP',
        'TICKET_CREATED_LINE', 'TICKET_CREATED_EMAIL_REPORTER',
        'TICKET_CREATED_EMAIL_IT', 'TICKET_UPDATED_IN_APP_REPORTER',
        'TICKET_UPDATED_EMAIL_REPORTER', 'TICKET_UPDATED_LINE',
        'TICKET_COMMENT_IN_APP', 'EMAIL_REQUEST', 'LEAVE_ACTION',
        'LEAVE_RESULT', 'LEAVE_CANCELLED', 'LEAVE_CANCELLATION_REQUESTED',
        'LEAVE_CANCELLED_AFTER_APPROVAL', 'LEAVE_NOT_TAKEN_REQUESTED',
        'LEAVE_NOT_TAKEN_CONFIRMED', 'STOCK_REQUEST_LINE', 'STOCK_LOW_LINE',
        'ROUTINE_REMINDER_IN_APP'
    ) NOT NULL;

-- Add the in-app notification type without changing existing stored values.
ALTER TABLE `notifications`
    MODIFY `type` ENUM(
        'TICKET_CREATED', 'NEW_COMMENT', 'TICKET_UPDATED', 'SYSTEM_ALERT',
        'LEAVE_REQUESTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED',
        'LEAVE_CANCELLED', 'LEAVE_CANCELLATION_REQUESTED',
        'LEAVE_CANCELLED_AFTER_APPROVAL', 'LEAVE_NOT_TAKEN_REQUESTED',
        'LEAVE_NOT_TAKEN_CONFIRMED', 'STOCK_REQUEST_NEW', 'STOCK_APPROVED',
        'STOCK_REJECTED', 'ROUTINE_REMINDER'
    ) NOT NULL;

ALTER TABLE `routine_occurrences`
    ADD COLUMN `reminderVersion` INTEGER NOT NULL DEFAULT 1;

CREATE TABLE `routine_reminder_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NOT NULL,
    `daysBefore` INTEGER NOT NULL,
    `sendHour` INTEGER NOT NULL,
    `channel` ENUM('IN_APP') NOT NULL DEFAULT 'IN_APP',
    `recipientScope` ENUM('ASSIGNEES', 'ADMINS', 'ASSIGNEES_AND_ADMINS') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `routine_reminder_rules_unique`(`taskId`, `daysBefore`, `channel`, `recipientScope`),
    INDEX `routine_reminder_rules_taskId_isActive_idx`(`taskId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `routine_reminder_rules`
    ADD CONSTRAINT `routine_reminder_rules_taskId_fkey`
    FOREIGN KEY (`taskId`) REFERENCES `routine_tasks`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
