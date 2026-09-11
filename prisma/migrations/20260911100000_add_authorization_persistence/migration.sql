-- Phase 2 authorization configuration persistence.
-- Teams and their authorization records are lifecycle-managed; dependent rows
-- are restricted from hard deletion to preserve configuration identity.
CREATE TABLE `teams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `teams_key_key`(`key`),
    INDEX `teams_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `team_roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teamId` INTEGER NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `team_roles_teamId_isActive_idx`(`teamId`, `isActive`),
    UNIQUE INDEX `team_roles_teamId_id_key`(`teamId`, `id`),
    UNIQUE INDEX `team_roles_teamId_key_key`(`teamId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `team_memberships` (
    `teamId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `teamRoleId` INTEGER NULL,

    INDEX `team_memberships_userId_teamId_idx`(`userId`, `teamId`),
    INDEX `team_memberships_teamId_teamRoleId_idx`(`teamId`, `teamRoleId`),
    INDEX `team_memberships_teamRoleId_idx`(`teamRoleId`),
    PRIMARY KEY (`teamId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `team_capability_grants` (
    `teamId` INTEGER NOT NULL,
    `capabilityKey` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`teamId`, `capabilityKey`, `scope`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `team_role_capability_grants` (
    `teamRoleId` INTEGER NOT NULL,
    `capabilityKey` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,

    INDEX `team_role_capability_grants_capabilityKey_scope_idx`(`capabilityKey`, `scope`),
    PRIMARY KEY (`teamRoleId`, `capabilityKey`, `scope`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_capability_grants` (
    `userId` INTEGER NOT NULL,
    `capabilityKey` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`userId`, `capabilityKey`, `scope`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `team_roles`
    ADD CONSTRAINT `team_roles_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `team_memberships`
    ADD CONSTRAINT `team_memberships_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `team_memberships`
    ADD CONSTRAINT `team_memberships_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `team_memberships`
    ADD CONSTRAINT `team_memberships_teamId_teamRoleId_fkey`
    FOREIGN KEY (`teamId`, `teamRoleId`) REFERENCES `team_roles`(`teamId`, `id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `team_capability_grants`
    ADD CONSTRAINT `team_capability_grants_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `team_role_capability_grants`
    ADD CONSTRAINT `team_role_capability_grants_teamRoleId_fkey`
    FOREIGN KEY (`teamRoleId`) REFERENCES `team_roles`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `user_capability_grants`
    ADD CONSTRAINT `user_capability_grants_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
