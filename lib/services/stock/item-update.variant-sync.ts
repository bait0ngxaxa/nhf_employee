import { StockTxType } from "@prisma/client";
import type { UpdateItemInput } from "@/lib/validations/stock";
import {
    assertNoPendingStockRequestsForVariants,
    buildItemInclude,
    createVariantAttributes,
    variantHasReferences,
} from "./shared";
import { createStockOpeningBalanceTransaction } from "./write-helpers";
import { reconcileStockItemDefaultVariant } from "./default-variant-writer";
import { LEGACY_DEFAULT_VARIANT_ORDER_BY } from "./legacy-default-variant";
import { withVariantInventorySummary } from "./inventory-quantity-read";
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

const MAX_VARIANT_SKU_LENGTH = 50;

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
            imageUrl: true,
            isActive: true,
        },
    });
}

async function getExistingVariants(
    tx: StockTxClient,
    itemId: number,
): Promise<ExistingVariantRecord[]> {
    return tx.stockItemVariant.findMany({
        where: { stockItemId: itemId },
        select: {
            id: true,
            sku: true,
            imageUrl: true,
            quantity: true,
            isActive: true,
        },
        orderBy: LEGACY_DEFAULT_VARIANT_ORDER_BY,
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

function buildVariantSku(parentSku: string, suffixNumber: number): string {
    const suffix = `-V${suffixNumber}`;
    const base = parentSku.slice(0, MAX_VARIANT_SKU_LENGTH - suffix.length);
    return `${base}${suffix}`;
}

function collectUsedVariantSkus(
    existingVariants: ExistingVariantRecord[],
    variants: SubmittedVariant[],
): Set<string> {
    const usedSkus = new Set(existingVariants.map((variant) => variant.sku));

    for (const variant of variants) {
        const normalizedSku = variant.sku?.trim();
        if (normalizedSku) {
            usedSkus.add(normalizedSku);
        }
    }

    return usedSkus;
}

function createAvailableVariantSku(
    parentSku: string,
    preferredNumber: number,
    usedSkus: Set<string>,
): string {
    let nextNumber = preferredNumber;

    while (nextNumber <= Number.MAX_SAFE_INTEGER) {
        const candidate = buildVariantSku(parentSku, nextNumber);
        if (!usedSkus.has(candidate)) {
            usedSkus.add(candidate);
            return candidate;
        }
        nextNumber += 1;
    }

    throw new Error("ไม่สามารถสร้าง SKU รายการย่อยได้");
}

async function createSubmittedVariant(
    tx: StockTxClient,
    itemId: number,
    parentSku: string,
    parentImageUrl: string | null,
    variant: SubmittedVariant,
    index: number,
    usedSkus: Set<string>,
    performedBy: number,
    tracking: UploadUrlTracking,
): Promise<void> {
    // A variant added during item editing follows createItem: its initial quantity is an opening balance.
    const nextVariantImageUrl = variant.imageUrl ?? parentImageUrl;
    const normalizedSku = variant.sku?.trim();
    const nextSku =
        normalizedSku || createAvailableVariantSku(parentSku, index + 1, usedSkus);
    const createdVariant = await tx.stockItemVariant.create({
        data: {
            stockItemId: itemId,
            sku: nextSku,
            unit: variant.unit,
            quantity: variant.quantity,
            minStock: variant.minStock,
            imageUrl: nextVariantImageUrl,
            isActive: true,
        },
        select: { id: true },
    });

    await createStockOpeningBalanceTransaction(
        tx,
        itemId,
        createdVariant.id,
        variant.quantity,
        performedBy,
    );

    await createVariantAttributes(tx, createdVariant.id, variant.attributes);
    trackUploadUrl(nextVariantImageUrl, tracking.retainedUploadUrls);
}

async function updateSubmittedVariant(
    tx: StockTxClient,
    itemId: number,
    parentSku: string,
    parentImageUrl: string | null,
    variant: SubmittedVariant & { id: number },
    existingVariant: ExistingVariantRecord,
    index: number,
    userId: number,
    tracking: UploadUrlTracking,
): Promise<void> {
    const nextVariantImageUrl =
        variant.imageUrl ?? existingVariant.imageUrl ?? parentImageUrl;

    if (variant.expectedQuantity === undefined) {
        throw new Error("กรุณาระบุจำนวนคงเหลือเดิมของรายการย่อย");
    }

    const delta = variant.quantity - variant.expectedQuantity;
    const updatedVariant = await tx.stockItemVariant.updateMany({
        where: {
            id: variant.id,
            stockItemId: itemId,
            isActive: true,
            quantity: variant.expectedQuantity,
        },
        data: {
            sku:
                variant.sku?.trim() ||
                existingVariant.sku ||
                `${parentSku}-V${index + 1}`,
            unit: variant.unit,
            minStock: variant.minStock,
            imageUrl: nextVariantImageUrl,
            quantity: { increment: delta },
        },
    });
    if (updatedVariant.count === 0) {
        throw new Error("ยอดคงเหลือของรายการย่อยเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่");
    }

    if (delta !== 0) {
        const transaction = await tx.stockTransaction.create({
            data: {
                itemId,
                variantId: variant.id,
                type: delta > 0 ? StockTxType.IN : StockTxType.OUT,
                quantity: delta,
                note: "ปรับยอดจากหน้าแก้ไขสินค้า",
                performedBy: userId,
            },
            select: { id: true },
        });
        const transactionIds = tracking.transactionIdsByVariantId.get(variant.id) ?? [];
        tracking.transactionIdsByVariantId.set(
            variant.id,
            [...transactionIds, transaction.id],
        );
    }

    trackReplacedUploadUrl(existingVariant.imageUrl, nextVariantImageUrl, tracking);

    await tx.stockVariantAttributeValue.deleteMany({
        where: { variantId: variant.id },
    });
    await createVariantAttributes(tx, variant.id, variant.attributes);
}

async function syncSubmittedVariants(
    tx: StockTxClient,
    itemId: number,
    nextItem: Pick<ExistingItemRecord, "sku" | "imageUrl" | "isActive">,
    variants: SubmittedVariant[],
    existingVariantById: Map<number, ExistingVariantRecord>,
    usedSkus: Set<string>,
    userId: number,
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
                usedSkus,
                userId,
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
            itemId,
            nextItem.sku,
            nextItem.imageUrl,
            { ...variant, id: variant.id },
            existingVariant,
            index,
            userId,
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

    await assertNoPendingStockRequestsForVariants(
        tx,
        removedVariants.map((variant) => variant.id),
    );

    for (const removedVariant of removedVariants) {
        if (removedVariant.quantity !== 0) {
            throw new Error(
                "ไม่สามารถปิดรายการย่อยที่ยังมียอดคงเหลือ กรุณาปรับยอดเป็นศูนย์ก่อน",
            );
        }

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
    userId: number,
    tracking: UploadUrlTracking,
): Promise<StockItemWithDetails> {
    const { minStock: _minStock, ...parentData } = itemData;
    const item = await getItemForVariantUpdate(tx, itemId);
    const existingVariants = await getExistingVariants(tx, itemId);
    const existingVariantById = createExistingVariantMap(existingVariants);
    const usedSkus = collectUsedVariantSkus(existingVariants, variants);

    assertSubmittedVariantsExist(variants, existingVariantById);

    const nextItem = await tx.stockItem.update({
        where: { id: itemId },
        data: {
            ...parentData,
            unit: variants[0]?.unit ?? item.unit,
        },
        select: {
            id: true,
            sku: true,
            imageUrl: true,
            isActive: true,
        },
    });

    trackReplacedUploadUrl(item.imageUrl, nextItem.imageUrl, tracking);

    const submittedIds = await syncSubmittedVariants(
        tx,
        itemId,
        nextItem,
        variants,
        existingVariantById,
        usedSkus,
        userId,
        tracking,
    );

    await handleRemovedVariants(tx, existingVariants, submittedIds, tracking);

    if (submittedIds.size > 0) {
        await tx.stockItemVariant.updateMany({
            where: { stockItemId: itemId, id: { in: Array.from(submittedIds) } },
            data: { isActive: true },
        });
    }
    await reconcileStockItemDefaultVariant(tx, itemId);

    const updatedItem = await tx.stockItem.findUniqueOrThrow({
        where: { id: itemId },
        include: buildItemInclude(),
    });
    return withVariantInventorySummary(updatedItem);
}
