-- AlterTable
ALTER TABLE `users`
    MODIFY `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER';
