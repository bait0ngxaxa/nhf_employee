-- Add nullable columns first so existing requests can be backfilled safely.
ALTER TABLE `stock_requests`
    ADD COLUMN `idempotencyKey` VARCHAR(255) NULL,
    ADD COLUMN `requestHash` CHAR(64) NULL;

-- Historical rows predate idempotency, so assign a unique synthetic key and hash
-- to each row before enforcing the non-null and compound-unique constraints.
UPDATE `stock_requests`
SET
    `idempotencyKey` = CONCAT('legacy:', `id`),
    `requestHash` = SHA2(CONCAT('legacy:', `id`), 256)
WHERE `idempotencyKey` IS NULL;

ALTER TABLE `stock_requests`
    MODIFY `idempotencyKey` VARCHAR(255) NOT NULL,
    MODIFY `requestHash` CHAR(64) NOT NULL,
    ADD UNIQUE INDEX `stock_requests_requestedBy_idempotencyKey_key`
        (`requestedBy`, `idempotencyKey`);
