import type { UpdateItemInput } from "@/lib/validations/stock";
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

async function updateItemWithoutVariants(
    tx: StockTxClient,
    itemId: number,
    itemData: Omit<UpdateItemInput, "variants">,
    originalData: UpdateItemInput,
    tracking: UploadUrlTracking,
): Promise<StockItemWithDetails> {
    const currentItem = await tx.stockItem.findUniqueOrThrow({
        where: { id: itemId },
        select: { imageUrl: true },
    });

    const nextItem = await tx.stockItem.update({
        where: { id: itemId },
        data: itemData,
        select: {
            id: true,
            sku: true,
            unit: true,
            quantity: true,
            minStock: true,
            imageUrl: true,
            isActive: true,
        },
    });

    trackReplacedUploadUrl(currentItem.imageUrl, nextItem.imageUrl, tracking);

    const existingVariants = await tx.stockItemVariant.findMany({
        where: { stockItemId: itemId },
        select: { id: true },
        orderBy: { id: "asc" },
    });
    const defaultVariant = existingVariants[0];

    if (defaultVariant) {
        await tx.stockItemVariant.update({
            where: { id: defaultVariant.id },
            data: {
                ...(originalData.sku !== undefined && { sku: nextItem.sku }),
                ...(originalData.unit !== undefined && { unit: nextItem.unit }),
                ...(originalData.minStock !== undefined && { minStock: nextItem.minStock }),
                ...(originalData.imageUrl !== undefined && { imageUrl: nextItem.imageUrl }),
            },
        });
    }

    if (originalData.isActive !== undefined) {
        await tx.stockItemVariant.updateMany({
            where: { stockItemId: itemId },
            data: { isActive: nextItem.isActive },
        });
    }

    return tx.stockItem.findUniqueOrThrow({
        where: { id: itemId },
        include: buildItemInclude(),
    });
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
