import type { UpdateItemInput } from "../../schemas/stock";
import {
    assertNoPendingStockRequestsForItem,
    buildItemInclude,
} from "./shared";
import { updateItemWithVariants } from "./item-update.variant-sync";
import {
    type StockItemWithDetails,
    type StockTxClient,
    type UploadUrlTracking,
    trackReplacedUploadUrl,
} from "./item-update.types";
import { reconcileStockItemDefaultVariant } from "./default-variant-writer";
import {
    isExplicitDefaultVariantReadEnabled,
    resolveDefaultVariantId,
} from "../../domain/default-variant-shadow";
import {
    LEGACY_DEFAULT_VARIANT_ORDER_BY,
    selectLegacyDefaultVariantId,
} from "../../domain/legacy-default-variant";
import { withVariantInventorySummary } from "../../domain/inventory-quantity-read";

async function updateItemWithoutVariants(
    tx: StockTxClient,
    itemId: number,
    itemData: Omit<UpdateItemInput, "variants">,
    originalData: UpdateItemInput,
    tracking: UploadUrlTracking,
): Promise<StockItemWithDetails> {
    const { minStock: _minStock, ...parentData } = itemData;
    const currentItem = await tx.stockItem.findUniqueOrThrow({
        where: { id: itemId },
        select: {
            imageUrl: true,
            defaultVariantId: true,
        },
    });

    const nextItem = await tx.stockItem.update({
        where: { id: itemId },
        data: parentData,
        select: {
            id: true,
            sku: true,
            unit: true,
            imageUrl: true,
            isActive: true,
        },
    });

    trackReplacedUploadUrl(currentItem.imageUrl, nextItem.imageUrl, tracking);

    const existingVariants = await tx.stockItemVariant.findMany({
        where: { stockItemId: itemId },
        select: {
            id: true,
            isActive: true,
        },
        orderBy: LEGACY_DEFAULT_VARIANT_ORDER_BY,
    });
    const defaultVariantId = resolveDefaultVariantId({
        legacyDefaultVariantId:
            selectLegacyDefaultVariantId(existingVariants),
        explicitDefaultVariantId: currentItem.defaultVariantId,
        explicitDefaultIsUsable: currentItem.defaultVariantId !== null
            && existingVariants.some(
                (variant) =>
                    variant.id === currentItem.defaultVariantId
                    && variant.isActive,
            ),
        explicitReadEnabled: isExplicitDefaultVariantReadEnabled(),
    });
    const defaultVariant = existingVariants.find(
        (variant) => variant.id === defaultVariantId,
    );

    if (defaultVariant) {
        await tx.stockItemVariant.update({
            where: { id: defaultVariant.id },
            data: {
                ...(originalData.sku !== undefined && { sku: nextItem.sku }),
                ...(originalData.unit !== undefined && { unit: nextItem.unit }),
                ...(originalData.minStock !== undefined && {
                    minStock: originalData.minStock,
                }),
                ...(originalData.imageUrl !== undefined && { imageUrl: nextItem.imageUrl }),
            },
        });
    }

    await reconcileStockItemDefaultVariant(tx, itemId);

    const updatedItem = await tx.stockItem.findUniqueOrThrow({
        where: { id: itemId },
        include: buildItemInclude(),
    });
    return withVariantInventorySummary(updatedItem);
}

export async function updateItemInTransaction(
    tx: StockTxClient,
    itemId: number,
    data: UpdateItemInput,
    userId: number,
    tracking: UploadUrlTracking,
): Promise<StockItemWithDetails> {
    const { variants, ...itemData } = data;

    if (itemData.isActive === false) {
        await assertNoPendingStockRequestsForItem(tx, itemId);
    }

    if (variants && variants.length > 0) {
        return updateItemWithVariants(tx, itemId, itemData, variants, userId, tracking);
    }

    return updateItemWithoutVariants(tx, itemId, itemData, data, tracking);
}
