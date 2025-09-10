/*
  Warnings:

  - You are about to drop the column `employeeCode` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `salary` on the `employees` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `employees_employeeCode_key` ON `employees`;

-- AlterTable
ALTER TABLE `employees` DROP COLUMN `employeeCode`,
    DROP COLUMN `salary`,
    ADD COLUMN `affiliation` VARCHAR(191) NULL;
