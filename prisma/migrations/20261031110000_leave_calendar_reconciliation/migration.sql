-- AlterTable
ALTER TABLE `leave_requests` ADD COLUMN `chargedHalfDays` INTEGER NULL;

-- CreateTable
CREATE TABLE `leave_calendar_adjustments` (
    `id` VARCHAR(191) NOT NULL,
    `leaveRequestId` VARCHAR(191) NOT NULL,
    `calendarVersionId` VARCHAR(191) NOT NULL,
    `previousHalfDays` INTEGER NOT NULL,
    `resultingHalfDays` INTEGER NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `overQuotaJustification` VARCHAR(1000) NULL,
    `confirmationHash` CHAR(64) NOT NULL,
    `administratorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `leave_calendar_adjustments_calendarVersionId_idx`(`calendarVersionId`),
    UNIQUE INDEX `leave_calendar_adjustments_leaveRequestId_calendarVersionId_key`(`leaveRequestId`, `calendarVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `leave_requests_startDate_id_idx` ON `leave_requests`(`startDate`, `id`);

-- AddForeignKey
ALTER TABLE `leave_calendar_adjustments` ADD CONSTRAINT `leave_calendar_adjustments_leaveRequestId_fkey` FOREIGN KEY (`leaveRequestId`) REFERENCES `leave_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_calendar_adjustments` ADD CONSTRAINT `leave_calendar_adjustments_calendarVersionId_fkey` FOREIGN KEY (`calendarVersionId`) REFERENCES `holiday_calendar_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_calendar_adjustments` ADD CONSTRAINT `leave_calendar_adjustments_administratorId_fkey` FOREIGN KEY (`administratorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- No backfill: NULL preserves legacy status/duration facts until a transactional accounting write.
ALTER TABLE leave_requests ADD CONSTRAINT leave_request_nonnegative_charge
    CHECK (chargedHalfDays IS NULL OR chargedHalfDays >= 0);
ALTER TABLE leave_requests ADD CONSTRAINT leave_request_terminal_charge
    CHECK (status IN ('APPROVED', 'CANCELLATION_REQUESTED') OR COALESCE(chargedHalfDays, 0) = 0);
ALTER TABLE leave_calendar_adjustments ADD CONSTRAINT leave_calendar_adjustment_units
    CHECK (previousHalfDays >= 0 AND resultingHalfDays >= 0 AND previousHalfDays <> resultingHalfDays);

CREATE TRIGGER leave_calendar_adjustment_immutable_update BEFORE UPDATE ON leave_calendar_adjustments
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Calendar adjustment ledger is immutable';

CREATE TRIGGER leave_calendar_adjustment_immutable_delete BEFORE DELETE ON leave_calendar_adjustments
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Calendar adjustment ledger is immutable';
