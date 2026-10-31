-- AlterTable
ALTER TABLE `leave_requests` ADD COLUMN `approvalCalendarVersionId` VARCHAR(191) NULL,
    ADD COLUMN `calculationCalendarVersionId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_calculationCalendarVersionId_fkey` FOREIGN KEY (`calculationCalendarVersionId`) REFERENCES `holiday_calendar_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_approvalCalendarVersionId_fkey` FOREIGN KEY (`approvalCalendarVersionId`) REFERENCES `holiday_calendar_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
