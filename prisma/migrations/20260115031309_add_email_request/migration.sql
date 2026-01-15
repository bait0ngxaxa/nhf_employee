/*
  Warnings:

  - You are about to drop the column `completedAt` on the `email_requests` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `email_requests` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `email_requests` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `email_requests_status_idx` ON `email_requests`;

-- AlterTable
ALTER TABLE `email_requests` DROP COLUMN `completedAt`,
    DROP COLUMN `note`,
    DROP COLUMN `status`;
