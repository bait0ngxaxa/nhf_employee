-- AlterTable
ALTER TABLE `stock_items` ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `imageUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `stock_request_items` ADD COLUMN `variantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `stock_transactions` ADD COLUMN `variantId` INTEGER NULL;

-- CreateTable
CREATE TABLE `stock_item_variants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockItemId` INTEGER NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `minStock` INTEGER NOT NULL DEFAULT 0,
    `imageUrl` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_item_variants_sku_key`(`sku`),
    INDEX `stock_item_variants_stockItemId_idx`(`stockItemId`),
    INDEX `stock_item_variants_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_attributes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_attributes_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_attribute_values` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attributeId` INTEGER NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stock_attribute_values_attributeId_idx`(`attributeId`),
    UNIQUE INDEX `stock_attribute_values_attributeId_value_key`(`attributeId`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_variant_attribute_values` (
    `variantId` INTEGER NOT NULL,
    `attributeValueId` INTEGER NOT NULL,

    INDEX `stock_variant_attribute_values_attributeValueId_idx`(`attributeValueId`),
    PRIMARY KEY (`variantId`, `attributeValueId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `stock_request_items_variantId_idx` ON `stock_request_items`(`variantId`);

-- CreateIndex
CREATE INDEX `stock_transactions_variantId_idx` ON `stock_transactions`(`variantId`);

-- AddForeignKey
ALTER TABLE `stock_item_variants` ADD CONSTRAINT `stock_item_variants_stockItemId_fkey` FOREIGN KEY (`stockItemId`) REFERENCES `stock_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_attribute_values` ADD CONSTRAINT `stock_attribute_values_attributeId_fkey` FOREIGN KEY (`attributeId`) REFERENCES `stock_attributes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_variant_attribute_values` ADD CONSTRAINT `stock_variant_attribute_values_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `stock_item_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_variant_attribute_values` ADD CONSTRAINT `stock_variant_attribute_values_attributeValueId_fkey` FOREIGN KEY (`attributeValueId`) REFERENCES `stock_attribute_values`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `stock_item_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_request_items` ADD CONSTRAINT `stock_request_items_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `stock_item_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
