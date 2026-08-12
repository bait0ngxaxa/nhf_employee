-- AlterTable
ALTER TABLE `leave_quotas`
    ADD COLUMN `carryBalanceHalfDays` INTEGER NOT NULL DEFAULT 0;
