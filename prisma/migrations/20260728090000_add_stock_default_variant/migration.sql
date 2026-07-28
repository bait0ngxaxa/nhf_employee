-- Phase 2 adds an explicit nullable default-variant reference.
-- Existing rows remain NULL; backfill is performed separately after a dry run.
ALTER TABLE `stock_items`
    ADD COLUMN `defaultVariantId` INTEGER NULL,
    ADD UNIQUE INDEX `stock_items_defaultVariantId_key` (`defaultVariantId`),
    ADD CONSTRAINT `stock_items_defaultVariantId_fkey`
    FOREIGN KEY (`defaultVariantId`) REFERENCES `stock_item_variants`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
