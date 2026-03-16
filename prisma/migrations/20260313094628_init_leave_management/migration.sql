-- AlterTable
ALTER TABLE `employees` ADD COLUMN `managerId` INTEGER NULL;

-- AlterTable
ALTER TABLE `notifications` MODIFY `type` ENUM('TICKET_CREATED', 'NEW_COMMENT', 'TICKET_UPDATED', 'SYSTEM_ALERT', 'LEAVE_REQUESTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED') NOT NULL;

-- CreateTable
CREATE TABLE `leave_quotas` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `leaveType` ENUM('SICK', 'PERSONAL', 'VACATION') NOT NULL,
    `totalDays` DOUBLE NOT NULL,
    `usedDays` DOUBLE NOT NULL DEFAULT 0,

    UNIQUE INDEX `leave_quotas_employeeId_year_leaveType_key`(`employeeId`, `year`, `leaveType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `leaveType` ENUM('SICK', 'PERSONAL', 'VACATION') NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `period` ENUM('FULL_DAY', 'MORNING', 'AFTERNOON') NOT NULL DEFAULT 'FULL_DAY',
    `durationDays` DOUBLE NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `approverId` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectReason` TEXT NULL,
    `attachmentUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `leave_requests_employeeId_idx`(`employeeId`),
    INDEX `leave_requests_approverId_idx`(`approverId`),
    INDEX `leave_requests_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_quotas` ADD CONSTRAINT `leave_quotas_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
