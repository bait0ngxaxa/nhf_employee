-- AlterTable
ALTER TABLE `audit_logs` MODIFY `action` ENUM('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'EMPLOYEE_CREATE', 'EMPLOYEE_UPDATE', 'EMPLOYEE_DELETE', 'EMPLOYEE_STATUS_CHANGE', 'EMPLOYEE_IMPORT', 'TICKET_CREATE', 'TICKET_UPDATE', 'TICKET_STATUS_CHANGE', 'TICKET_ASSIGN', 'TICKET_COMMENT', 'TICKET_DELETE', 'LEAVE_REQUEST_CREATE', 'LEAVE_REQUEST_APPROVE', 'LEAVE_REQUEST_REJECT', 'LEAVE_REQUEST_CANCEL', 'LEAVE_REQUEST_CANCELLATION_REQUEST', 'LEAVE_REQUEST_CANCELLATION_CONFIRM', 'LEAVE_REQUEST_NOT_TAKEN_REQUEST', 'LEAVE_REQUEST_NOT_TAKEN_CONFIRM', 'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_ROLE_CHANGE', 'TEAM_CREATE', 'TEAM_UPDATE', 'TEAM_DISABLE', 'TEAM_MEMBER_ADD', 'TEAM_MEMBER_REMOVE', 'TEAM_MEMBER_ROLE_CHANGE', 'TEAM_ROLE_CREATE', 'TEAM_ROLE_UPDATE', 'TEAM_ROLE_DISABLE', 'TEAM_CAPABILITY_GRANT_UPDATE', 'TEAM_ROLE_CAPABILITY_GRANT_UPDATE', 'USER_CAPABILITY_GRANT_ADD', 'USER_CAPABILITY_GRANT_REMOVE', 'STOCK_ITEM_CREATE', 'STOCK_ITEM_UPDATE', 'STOCK_ITEM_DELETE', 'STOCK_ADJUST', 'STOCK_REQUEST_CREATE', 'STOCK_REQUEST_APPROVE', 'STOCK_REQUEST_REJECT', 'STOCK_CATEGORY_CREATE', 'STOCK_CATEGORY_DELETE', 'SETTINGS_UPDATE', 'DATA_EXPORT', 'EMAIL_REQUEST', 'ROUTINE_TASK_CREATE', 'ROUTINE_TASK_UPDATE', 'ROUTINE_TASK_DEACTIVATE', 'ROUTINE_TASK_DELETE', 'ROUTINE_OCCURRENCE_REASSIGN', 'ROUTINE_OCCURRENCE_DUE_DATE_CHANGE', 'ROUTINE_IMPORT_UPLOAD', 'ROUTINE_IMPORT_ROW_UPDATE', 'ROUTINE_IMPORT_APPLY', 'ROUTINE_IMPORT_CANCEL', 'ANNOUNCEMENT_UPDATE', 'LEAVE_CALENDAR_DRAFT', 'LEAVE_CALENDAR_PUBLISH', 'LEAVE_CALENDAR_RECONCILE') NOT NULL;

-- Additive only: existing requests, quotas and historical audit values are retained.
-- CreateTable
CREATE TABLE `holiday_calendars` (
    `year` INTEGER NOT NULL,
    `activeVersionNumber` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `holiday_calendar_versions` (
    `id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `number` INTEGER NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `baseVersionNumber` INTEGER NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publishedAt` DATETIME(3) NULL,
    `publishedById` INTEGER NULL,
    `publicationNote` VARCHAR(1000) NULL,

    UNIQUE INDEX `holiday_calendar_versions_year_number_key`(`year`, `number`),
    UNIQUE INDEX `holiday_calendar_versions_year_id_key`(`year`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `holiday_calendar_days` (
    `id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `category` ENUM('OFFICIAL', 'ORGANIZATION') NOT NULL,
    `source` VARCHAR(1000) NOT NULL,
    `note` VARCHAR(1000) NULL,

    UNIQUE INDEX `holiday_calendar_days_versionId_date_key`(`versionId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `holiday_calendars` ADD CONSTRAINT `holiday_calendars_year_activeVersionNumber_fkey` FOREIGN KEY (`year`, `activeVersionNumber`) REFERENCES `holiday_calendar_versions`(`year`, `number`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `holiday_calendar_versions` ADD CONSTRAINT `holiday_calendar_versions_year_fkey` FOREIGN KEY (`year`) REFERENCES `holiday_calendars`(`year`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `holiday_calendar_versions` ADD CONSTRAINT `holiday_calendar_versions_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `holiday_calendar_versions` ADD CONSTRAINT `holiday_calendar_versions_publishedById_fkey` FOREIGN KEY (`publishedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `holiday_calendar_days` ADD CONSTRAINT `holiday_calendar_days_year_versionId_fkey` FOREIGN KEY (`year`, `versionId`) REFERENCES `holiday_calendar_versions`(`year`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE holiday_calendars ADD CONSTRAINT holiday_calendar_year CHECK (year BETWEEN 1900 AND 9999);
ALTER TABLE holiday_calendar_versions ADD CONSTRAINT holiday_version_number CHECK (number > 0 AND revision >= 0);
ALTER TABLE holiday_calendar_days ADD CONSTRAINT holiday_day_year CHECK (YEAR(date) = year);

CREATE TRIGGER holiday_version_immutable_update BEFORE UPDATE ON holiday_calendar_versions
FOR EACH ROW BEGIN
    IF OLD.publishedAt IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Published holiday versions are immutable';
    END IF;
END;

CREATE TRIGGER holiday_version_immutable_delete BEFORE DELETE ON holiday_calendar_versions
FOR EACH ROW BEGIN
    IF OLD.publishedAt IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Published holiday versions are immutable';
    END IF;
END;

CREATE TRIGGER holiday_day_immutable_insert BEFORE INSERT ON holiday_calendar_days
FOR EACH ROW BEGIN
    IF (SELECT publishedAt FROM holiday_calendar_versions WHERE id = NEW.versionId) IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Published holiday days are immutable';
    END IF;
END;

CREATE TRIGGER holiday_day_immutable_update BEFORE UPDATE ON holiday_calendar_days
FOR EACH ROW BEGIN
    IF (SELECT publishedAt FROM holiday_calendar_versions WHERE id = OLD.versionId) IS NOT NULL
        OR (SELECT publishedAt FROM holiday_calendar_versions WHERE id = NEW.versionId) IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Published holiday days are immutable';
    END IF;
END;

CREATE TRIGGER holiday_day_immutable_delete BEFORE DELETE ON holiday_calendar_days
FOR EACH ROW BEGIN
    IF (SELECT publishedAt FROM holiday_calendar_versions WHERE id = OLD.versionId) IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Published holiday days are immutable';
    END IF;
END;

CREATE TRIGGER holiday_active_published BEFORE UPDATE ON holiday_calendars
FOR EACH ROW BEGIN
    IF NEW.activeVersionNumber IS NOT NULL AND
        (SELECT publishedAt FROM holiday_calendar_versions WHERE year = NEW.year AND number = NEW.activeVersionNumber) IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Active calendar version must be published';
    END IF;
END;
