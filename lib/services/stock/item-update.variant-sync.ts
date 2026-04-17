import type { UpdateItemInput } from "@/lib/validations/stock";
import {
    buildItemInclude,
    createVariantAttributes,
    ensureDefaultVariant,
    summarizeVariantInventory,
    variantHasReferences,
} from "./shared";
import {
    type ExistingItemRecord,
    type ExistingVariantRecord,
    type StockItemWithDetails,
    type StockTxClient,
    type SubmittedVariant,
    type UploadUrlTracking,
    trackReplacedUploadUrl,
    trackUploadUrl,
} from "./item-update.types";

async function getItemForVariantUpdate(
    tx: StockTxClient,
    itemId: number,
): Promise<ExistingItemRecord> {
    return tx.stockItem.findUniqueOrThrow({
        where: { id: itemId },
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
}

async function getExistingVariants(
    tx: StockTxClient,
    itemId: number,
    item: ExistingItemRecord,
): Promise<ExistingVariantRecord[]> {
    const existingVariants = await tx.stockItemVariant.findMany({
        where: { stockItemId: itemId },
        select: {
            id: true,
            sku: true,
            imageUrl: true,
            isActive: true,
        },
        orderBy: { id: "asc" },
    });

    if (existingVariants.length > 0) {
        return existingVariants;
    }

    await ensureDefaultVariant(tx, item);

    return tx.stockItemVariant.findMany({
        where: { stockItemId: itemId },
        select: {
            id: true,
            sku: true,
            imageUrl: true,
            isActive: true,
        },
        orderBy: { id: "asc" },
    });
}

function createExistingVariantMap(
    existingVariants: ExistingVariantRecord[],
): Map<number, ExistingVariantRecord> {
    return new Map(existingVariants.map((variant) => [variant.id, variant]));
}

function assertSubmittedVariantsExist(
    variants: SubmittedVariant[],
    existingVariantById: Map<number, ExistingVariantRecord>,
): void {
    for (const variant of variants) {
        if (variant.id && !existingVariantById.has(variant.id)) {
            throw new Error("พบรายการย่อยไม่ถูกต้อง");
        }
    }
}

function collectSubmittedVariantIds(variants: SubmittedVariant[]): Set<number> {
    return new Set(
        variants
            .map((variant) => variant.id)
            .filter((variantId): variantId is number => variantId !== undefined),
    );
}

async function createSubmittedVariant(
    tx: StockTxClient,
    itemId: number,
    parentSku: string,
    parentImageUrl: string | null,
    variant: SubmittedVariant,
    index: number,
    tracking: UploadUrlTracking,
): Promise<void> {
    const nextVariantImageUrl = variant.imageUrl ?? parentImageUrl;
    const createdVariant = await tx.stockItemVariant.create({
        data: {
            stockItemId: itemId,
            sku: variant.sku?.trim() || `${parentSku}-V${index + 1}`,
            unit: variant.unit,
            quantity: variant.quantity,
            minStock: variant.minStock,
            imageUrl: nextVariantImageUrl,
            isActive: true,
        },
        select: { id: true },
    });

    await createVariantAttributes(tx, createdVariant.id, variant.attributes);
    trackUploadUrl(nextVariantImageUrl, tracking.retainedUploadUrls);
}

async function updateSubmittedVariant(
    tx: StockTxClient,
    parentSku: string,
    parentImageUrl: string | null,
    variant: SubmittedVariant & { id: number },
    existingVariant: ExistingVariantRecord,
    index: number,
    tracking: UploadUrlTracking,
): Promise<void> {
    const nextVariantImageUrl =
        variant.imageUrl ?? existingVariant.imageUrl ?? parentImageUrl;

    await tx.stockItemVariant.update({
        where: { id: variant.id },
        data: {
            sku:
                variant.sku?.trim() ||
                existingVariant.sku ||
                `${parentSku}-V${index + 1}`,
            unit: variant.unit,
            quantity: variant.quantity,
            minStock: variant.minStock,
            imageUrl: nextVariantImageUrl,
        },
    });

    trackReplacedUploadUrl(existingVariant.imageUrl, nextVariantImageUrl, tracking);

    await tx.stockVariantAttributeValue.deleteMany({
        where: { variantId: variant.id },
    });
    await createVariantAttributes(tx, variant.id, variant.attributes);
}

async function syncSubmittedVariants(
    tx: StockTxClient,
    itemId: number,
    nextItem: Pick<ExistingItemRecord, "sku" | "imageUrl">,
    variants: SubmittedVariant[],
    existingVariantById: Map<number, ExistingVariantRecord>,
    tracking: UploadUrlTracking,
): Promise<Set<number>> {
    const submittedIds = collectSubmittedVariantIds(variants);

    for (let index = 0; index < variants.length; index += 1) {
        const variant = variants[index];

        if (!variant.id) {
            await createSubmittedVariant(
                tx,
                itemId,
                nextItem.sku,
                nextItem.imageUrl,
                variant,
                index,
                tracking,
            );
            continue;
        }

        const existingVariant = existingVariantById.get(variant.id);
        if (!existingVariant) {
            throw new Error("พบรายการย่อยไม่ถูกต้อง");
        }

        await updateSubmittedVariant(
            tx,
            nextItem.sku,
            nextItem.imageUrl,
            { ...variant, id: variant.id },
            existingVariant,
            index,
            tracking,
        );
    }

    return submittedIds;
}

async function handleRemovedVariants(
    tx: StockTxClient,
    existingVariants: ExistingVariantRecord[],
    submittedIds: Set<number>,
    tracking: UploadUrlTracking,
): Promise<void> {
    const removedVariants = existingVariants.filter(
        (variant) => !submittedIds.has(variant.id),
    );

    for (const removedVariant of removedVariants) {
        const hasReferences = await variantHasReferences(tx, removedVariant.id);
        if (hasReferences) {
            await tx.stockItemVariant.update({
                where: { id: removedVariant.id },
                data: { isActive: false },
            });
            continue;
        }

        if (removedVariant.imageUrl) {
            tracking.cleanupCandidates.add(removedVariant.imageUrl);
        }

        await tx.stockVariantAttributeValue.deleteMany({
            where: { variantId: removedVariant.id },
        });
        await tx.stockItemVariant.delete({
            where: { id: removedVariant.id },
        });
    }
}

export async function updateItemWithVariants(
    tx: StockTxClient,
    itemId: number,
    itemData: Omit<UpdateItemInput, "variants">,
    variants: SubmittedVariant[],
    tracking: UploadUrlTracking,
): Promise<StockItemWithDetails> {
    const item = await getItemForVariantUpdate(tx, itemId);
    const existingVariants = await getExistingVariants(tx, itemId, item);
    const existingVariantById = createExistingVariantMap(existingVariants);

    assertSubmittedVariantsExist(variants, existingVariantById);

    const inventorySummary = summarizeVariantInventory(variants, item.unit);
    const nextItem = await tx.stockItem.update({
        where: { id: itemId },
        data: {
            ...itemData,
            unit: variants[0]?.unit ?? item.unit,
            quantity: inventorySummary.quantity,
            minStock: inventorySummary.minStock,
        },
        select: {
            id: true,
            sku: true,
            imageUrl: true,
        },
    });

    trackReplacedUploadUrl(item.imageUrl, nextItem.imageUrl, tracking);

    const submittedIds = await syncSubmittedVariants(
        tx,
        itemId,
        nextItem,
        variants,
        existingVariantById,
        tracking,
    );

    await handleRemovedVariants(tx, existingVariants, submittedIds, tracking);

    return tx.stockItem.findUniqueOrThrow({
        where: { id: itemId },
        include: buildItemInclude(),
    });
}
