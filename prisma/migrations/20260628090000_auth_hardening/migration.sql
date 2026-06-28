-- Enforce one successor refresh token per rotated token.
CREATE UNIQUE INDEX `auth_refresh_tokens_rotatedFromId_key`
    ON `auth_refresh_tokens`(`rotatedFromId`);
