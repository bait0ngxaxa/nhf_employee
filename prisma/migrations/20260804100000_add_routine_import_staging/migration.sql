-- Add audit actions for the server-side Routine import workflow.
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
        'ROUTINE_OCCURRENCE_DUE_DATE_CHANGE',
        'ROUTINE_IMPORT_UPLOAD', 'ROUTINE_IMPORT_ROW_UPDATE', 'ROUTINE_IMPORT_APPLY', 'ROUTINE_IMPORT_CANCEL'
    ) NOT NULL;

CREATE TABLE `routine_import_batches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `originalFileName` VARCHAR(255) NOT NULL,
    `fileHash` CHAR(64) NOT NULL,
    `targetSheet` VARCHAR(255) NOT NULL,
    `asOfDate` DATE NOT NULL,
    `ignoredSheets` JSON NULL,
    `status` ENUM('PREVIEW', 'READY', 'APPLYING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PREVIEW',
    `uploadedById` INTEGER NOT NULL,
    `totalRows` INTEGER NOT NULL DEFAULT 0,
    `validRows` INTEGER NOT NULL DEFAULT 0,
    `reviewRows` INTEGER NOT NULL DEFAULT 0,
    `excludedRows` INTEGER NOT NULL DEFAULT 0,
    `alreadyImportedRows` INTEGER NOT NULL DEFAULT 0,
    `appliedRows` INTEGER NOT NULL DEFAULT 0,
    `conflictRows` INTEGER NOT NULL DEFAULT 0,
    `failedRows` INTEGER NOT NULL DEFAULT 0,
    `selectedRows` INTEGER NOT NULL DEFAULT 0,
    `activeRows` INTEGER NOT NULL DEFAULT 0,
    `inactiveRows` INTEGER NOT NULL DEFAULT 0,
    `expiredRows` INTEGER NOT NULL DEFAULT 0,
    `unresolvedOwnerRows` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NULL,
    `appliedAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `routine_import_batches_fileHash_targetSheet_status_idx`(`fileHash`, `targetSheet`, `status`),
    INDEX `routine_import_batches_uploadedById_createdAt_idx`(`uploadedById`, `createdAt`),
    INDEX `routine_import_batches_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `routine_import_rows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `batchId` INTEGER NOT NULL,
    `sourceSheet` VARCHAR(255) NOT NULL,
    `sourceRow` INTEGER NOT NULL,
    `sourceKey` VARCHAR(255) NOT NULL,
    `sourceFingerprint` CHAR(64) NOT NULL,
    `categoryName` VARCHAR(200) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `ownerNamesText` TEXT NOT NULL,
    `rawData` JSON NOT NULL,
    `normalizedData` JSON NOT NULL,
    `status` ENUM('VALID', 'REQUIRES_REVIEW', 'EXCLUDED', 'ALREADY_IMPORTED', 'CONFLICT', 'APPLIED', 'FAILED') NOT NULL DEFAULT 'REQUIRES_REVIEW',
    `selected` BOOLEAN NOT NULL DEFAULT false,
    `proposedActivation` ENUM('ACTIVE', 'INACTIVE', 'HISTORY_ONLY') NOT NULL DEFAULT 'INACTIVE',
    `reviewReasons` JSON NOT NULL,
    `appliedTaskId` INTEGER NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `routine_import_rows_source_identity`(`batchId`, `sourceSheet`, `sourceRow`),
    INDEX `routine_import_rows_batchId_status_selected_idx`(`batchId`, `status`, `selected`),
    INDEX `routine_import_rows_batchId_title_idx`(`batchId`, `title`),
    INDEX `routine_import_rows_sourceKey_sourceFingerprint_idx`(`sourceKey`, `sourceFingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `routine_import_batches`
    ADD CONSTRAINT `routine_import_batches_uploadedById_fkey`
    FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `routine_import_rows`
    ADD CONSTRAINT `routine_import_rows_batchId_fkey`
    FOREIGN KEY (`batchId`) REFERENCES `routine_import_batches`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `routine_import_rows`
    ADD CONSTRAINT `routine_import_rows_appliedTaskId_fkey`
    FOREIGN KEY (`appliedTaskId`) REFERENCES `routine_tasks`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
