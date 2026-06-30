-- AlterTable
ALTER TABLE `email_requests`
    ADD COLUMN `needsDocumentSystem` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `sharedDriveAccess` JSON NULL;
