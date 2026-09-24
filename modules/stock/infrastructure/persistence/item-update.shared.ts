import type { UpdateItemInput } from "../../schemas/stock";
import {
    assertNoPendingStockRequestsForItem,
    buildItemInclude,
} from "./shared";
import { resolveCanonicalDefaultVariantId } from "../../domain/canonical-default-variant";
import { updateItemWithVariants } from "./item-update.variant-sync";
import {
    type StockItemWithDetails,
    type StockTxClient,
    type UploadUrlTracking,
    trackReplacedUploadUrl,
} from "./item-update.types";
import { reconcileStockItemDefaultVariant } from "./default-variant-writer";
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
            defaultVariant: {
                select: { id: true, stockItemId: true, isActive: true },
            },
        },
    });

    const activeVariants = await tx.stockItemVariant.findMany({
        where: { stockItemId: itemId, isActive: true },
        select: { id: true },
    });
    const defaultVariantId = resolveCanonicalDefaultVariantId({
        itemId,
        defaultVariantId: currentItem.defaultVariantId,
        defaultVariant: currentItem.defaultVariant,
        activeVariantIds: activeVariants.map((variant) => variant.id),
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

    if (defaultVariantId !== null) {
        await tx.stockItemVariant.update({
            where: { id: defaultVariantId },
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
