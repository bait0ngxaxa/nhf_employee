CREATE TABLE `routine_import_ledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sourceFileName` VARCHAR(255) NOT NULL,
    `sourceSheet` VARCHAR(255) NOT NULL,
    `sourceRow` INTEGER NOT NULL,
    `sourceFingerprint` CHAR(64) NOT NULL,
    `status` ENUM('APPLIED', 'SKIPPED', 'CONFLICT') NOT NULL,
    `taskId` INTEGER NULL,
    `appliedById` INTEGER NULL,
    `resolutionNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `routine_import_ledger_taskId_key`(`taskId`),
    UNIQUE INDEX `routine_import_ledger_source_identity`(`sourceFileName`, `sourceSheet`, `sourceRow`),
    INDEX `routine_import_ledger_sourceFingerprint_idx`(`sourceFingerprint`),
    INDEX `routine_import_ledger_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `routine_import_ledger`
    ADD CONSTRAINT `routine_import_ledger_taskId_fkey`
    FOREIGN KEY (`taskId`) REFERENCES `routine_tasks`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `routine_import_ledger`
    ADD CONSTRAINT `routine_import_ledger_appliedById_fkey`
    FOREIGN KEY (`appliedById`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
