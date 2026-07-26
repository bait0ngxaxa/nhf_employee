-- Add a nullable unique identity for opening-balance ledger entries.
-- Historical rows remain nullable; new explicit writes use one key per variant.
ALTER TABLE `stock_transactions`
    ADD COLUMN `openingBalanceKey` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `stock_transactions_openingBalanceKey_key`
    ON `stock_transactions`(`openingBalanceKey`);
