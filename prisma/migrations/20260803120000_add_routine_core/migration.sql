-- CreateTable
CREATE TABLE `routine_units` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `routine_units_code_key`(`code`),
    INDEX `routine_units_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `routine_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `routine_categories_name_key`(`name`),
    INDEX `routine_categories_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `routine_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `scheduleType` ENUM('MONTHLY_DAY', 'MONTH_END', 'INTERVAL_MONTHS', 'YEARLY_DATE', 'ONE_TIME', 'MANUAL') NOT NULL,
    `scheduleConfig` JSON NULL,
    `scheduleText` VARCHAR(500) NULL,
    `contractStartDate` DATE NULL,
    `contractEndDate` DATE NULL,
    `contractText` VARCHAR(500) NULL,
    `extraDetails` TEXT NULL,
    `businessDayPolicy` ENUM('NONE', 'PREVIOUS_BUSINESS_DAY', 'NEXT_BUSINESS_DAY') NOT NULL DEFAULT 'NONE',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `sourceFileName` VARCHAR(255) NULL,
    `sourceSheet` VARCHAR(255) NULL,
    `sourceRow` INTEGER NULL,
    `createdById` INTEGER NOT NULL,
    `updatedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `routine_tasks_unitId_idx`(`unitId`),
    INDEX `routine_tasks_categoryId_idx`(`categoryId`),
    INDEX `routine_tasks_isActive_scheduleType_idx`(`isActive`, `scheduleType`),
    INDEX `routine_tasks_contractEndDate_idx`(`contractEndDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `routine_task_assignees` (
    `taskId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `role` ENUM('OWNER', 'CO_OWNER') NOT NULL,

    INDEX `routine_task_assignees_employeeId_role_idx`(`employeeId`, `role`),
    PRIMARY KEY (`taskId`, `employeeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `routine_occurrences` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NOT NULL,
    `periodKey` VARCHAR(32) NOT NULL,
    `dueDate` DATE NOT NULL,
    `originalDueDate` DATE NOT NULL,
    `status` ENUM('TODO', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED') NOT NULL DEFAULT 'TODO',
    `scheduleVersion` INTEGER NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `completedById` INTEGER NULL,
    `completionNote` TEXT NULL,
    `referenceNo` VARCHAR(255) NULL,
    `skippedAt` DATETIME(3) NULL,
    `skippedById` INTEGER NULL,
    `skipReason` TEXT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` INTEGER NULL,
    `cancellationReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `routine_occurrences_taskId_periodKey_key`(`taskId`, `periodKey`),
    INDEX `routine_occurrences_status_dueDate_idx`(`status`, `dueDate`),
    INDEX `routine_occurrences_taskId_status_idx`(`taskId`, `status`),
    INDEX `routine_occurrences_dueDate_idx`(`dueDate`),
    INDEX `routine_occurrences_completedAt_idx`(`completedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `routine_occurrence_assignees` (
    `occurrenceId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `role` ENUM('OWNER', 'CO_OWNER') NOT NULL,

    INDEX `routine_occurrence_assignees_employeeId_role_idx`(`employeeId`, `role`),
    PRIMARY KEY (`occurrenceId`, `employeeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Extend audit action vocabulary without changing existing stored values.
ALTER TABLE `audit_logs`
    MODIFY `action` ENUM(
        'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE', 'PASSWORD_RESET',
        'EMPLOYEE_CREATE', 'EMPLOYEE_UPDATE', 'EMPLOYEE_DELETE', 'EMPLOYEE_STATUS_CHANGE', 'EMPLOYEE_IMPORT',
        'TICKET_CREATE', 'TICKET_UPDATE', 'TICKET_STATUS_CHANGE', 'TICKET_ASSIGN', 'TICKET_COMMENT', 'TICKET_DELETE',
        'LEAVE_REQUEST_CREATE', 'LEAVE_REQUEST_APPROVE', 'LEAVE_REQUEST_REJECT', 'LEAVE_REQUEST_CANCEL',
        'LEAVE_REQUEST_CANCELLATION_REQUEST', 'LEAVE_REQUEST_CANCELLATION_CONFIRM',
        'LEAVE_REQUEST_NOT_TAKEN_REQUEST', 'LEAVE_REQUEST_NOT_TAKEN_CONFIRM',
        'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_ROLE_CHANGE',
        'STOCK_ITEM_CREATE', 'STOCK_ITEM_UPDATE', 'STOCK_ITEM_DELETE', 'STOCK_ADJUST',
        'STOCK_REQUEST_CREATE', 'STOCK_REQUEST_APPROVE', 'STOCK_REQUEST_REJECT',
        'STOCK_CATEGORY_CREATE', 'STOCK_CATEGORY_DELETE', 'SETTINGS_UPDATE', 'DATA_EXPORT', 'EMAIL_REQUEST',
        'ROUTINE_TASK_CREATE', 'ROUTINE_TASK_UPDATE', 'ROUTINE_TASK_DEACTIVATE',
        'ROUTINE_OCCURRENCE_START', 'ROUTINE_OCCURRENCE_COMPLETE', 'ROUTINE_OCCURRENCE_SKIP',
        'ROUTINE_OCCURRENCE_CANCEL', 'ROUTINE_OCCURRENCE_REOPEN', 'ROUTINE_OCCURRENCE_REASSIGN',
        'ROUTINE_OCCURRENCE_DUE_DATE_CHANGE'
    ) NOT NULL;

-- AddForeignKey
ALTER TABLE `routine_tasks`
    ADD CONSTRAINT `routine_tasks_unitId_fkey`
    FOREIGN KEY (`unitId`) REFERENCES `routine_units`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `routine_tasks`
    ADD CONSTRAINT `routine_tasks_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `routine_categories`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `routine_tasks`
    ADD CONSTRAINT `routine_tasks_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `routine_tasks`
    ADD CONSTRAINT `routine_tasks_updatedById_fkey`
    FOREIGN KEY (`updatedById`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `routine_task_assignees`
    ADD CONSTRAINT `routine_task_assignees_taskId_fkey`
    FOREIGN KEY (`taskId`) REFERENCES `routine_tasks`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `routine_task_assignees`
    ADD CONSTRAINT `routine_task_assignees_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `routine_occurrences`
    ADD CONSTRAINT `routine_occurrences_taskId_fkey`
    FOREIGN KEY (`taskId`) REFERENCES `routine_tasks`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `routine_occurrences`
    ADD CONSTRAINT `routine_occurrences_completedById_fkey`
    FOREIGN KEY (`completedById`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `routine_occurrences`
    ADD CONSTRAINT `routine_occurrences_skippedById_fkey`
    FOREIGN KEY (`skippedById`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `routine_occurrences`
    ADD CONSTRAINT `routine_occurrences_cancelledById_fkey`
    FOREIGN KEY (`cancelledById`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `routine_occurrence_assignees`
    ADD CONSTRAINT `routine_occurrence_assignees_occurrenceId_fkey`
    FOREIGN KEY (`occurrenceId`) REFERENCES `routine_occurrences`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `routine_occurrence_assignees`
    ADD CONSTRAINT `routine_occurrence_assignees_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
