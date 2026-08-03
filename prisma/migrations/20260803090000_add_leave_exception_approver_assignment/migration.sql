ALTER TABLE `leave_requests`
    ADD COLUMN `exceptionApproverId` INTEGER NULL,
    ADD COLUMN `exceptionApproverAssignedAt` DATETIME(3) NULL;

CREATE INDEX `leave_requests_exceptionApproverId_idx`
    ON `leave_requests`(`exceptionApproverId`);

ALTER TABLE `leave_requests`
    ADD CONSTRAINT `leave_requests_exceptionApproverId_fkey`
    FOREIGN KEY (`exceptionApproverId`) REFERENCES `employees`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
