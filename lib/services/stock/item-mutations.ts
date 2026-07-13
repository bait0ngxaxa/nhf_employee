import { type StockTxType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
    AdjustStockInput,
    CreateCategoryInput,
    UpdateItemInput,
} from "@/lib/validations/stock";
import {
    buildItemInclude,
    cleanupUnusedUploadUrls,
    createVariantAttributes,
    ensureDefaultCategoryId,
    ensureDefaultVariant,
    generateSku,
} from "./shared";
import { updateItemInTransaction } from "./item-update.shared";
import type { StockTxClient } from "./item-update.types";
import type {
    AdjustStockResult,
    CreateStockItemInput,
    LowStockAlertCandidate,
} from "./types";

function buildLowStockAlert(
    item: {
        id: number;
        name: string;
        sku: string;
        unit: string;
        quantity: number;
    },
    nextQuantity: number,
    nextMinStock: number,
): LowStockAlertCandidate[] {
    if (item.quantity <= nextMinStock || nextQuantity > nextMinStock) {
        return [];
    }

    return [
        {
            itemId: item.id,
            name: item.name,
            sku: item.sku,
            quantity: nextQuantity,
            minStock: nextMinStock,
            unit: item.unit,
        },
    ];
}

type AdjustmentItem = {
    id: number;
    name: string;
    sku: string;
    unit: string;
    quantity: number;
    minStock: number;
    imageUrl: string | null;
    isActive: boolean;
};

type AdjustmentVariant = {
    id: number;
    quantity: number;
    minStock: number;
};

async function findAdjustmentVariant(
    tx: StockTxClient,
    item: AdjustmentItem,
    variantId: number | undefined,
): Promise<AdjustmentVariant> {
    if (variantId !== undefined) {
        const variant = await tx.stockItemVariant.findFirst({
            where: { id: variantId, stockItemId: item.id, isActive: true },
            select: { id: true, quantity: true, minStock: true },
        });
        if (!variant) {
            throw new Error("ไม่พบรายการย่อยของวัสดุ");
        }
        return variant;
    }

    const activeVariants = await tx.stockItemVariant.findMany({
        where: { stockItemId: item.id, isActive: true },
        select: { id: true, quantity: true, minStock: true },
        orderBy: { id: "asc" },
    });
    if (activeVariants.length > 1) {
        throw new Error("กรุณาเลือกรายการย่อยของวัสดุ");
    }
    if (activeVariants.length === 1) {
        return activeVariants[0];
    }

    const fallbackVariant = await ensureDefaultVariant(tx, item);
    return tx.stockItemVariant.findUniqueOrThrow({
        where: { id: fallbackVariant.id },
        select: { id: true, quantity: true, minStock: true },
    });
}

async function applyStockAdjustment(
    tx: StockTxClient,
    item: AdjustmentItem,
    variant: AdjustmentVariant,
    input: AdjustStockInput,
    userId: number,
): Promise<AdjustStockResult> {
    const updatedVariant = await tx.stockItemVariant.updateMany({
        where: {
            id: variant.id,
            stockItemId: item.id,
            isActive: true,
            minStock: variant.minStock,
        },
        data: {
            quantity: { increment: input.quantity },
            minStock: input.minStock,
        },
    });
    if (updatedVariant.count === 0) {
        throw new Error("รายการย่อยของวัสดุถูกปรับปรุงพร้อมกัน กรุณาลองใหม่");
    }

    const minStockDelta = input.minStock - variant.minStock;
    const updatedItem = await tx.stockItem.update({
        where: { id: item.id },
        data: {
            quantity: { increment: input.quantity },
            minStock: { increment: minStockDelta },
        },
        select: { quantity: true, minStock: true },
    });
    await tx.stockTransaction.create({
        data: {
            itemId: item.id,
            variantId: variant.id,
            type: input.type as StockTxType,
            quantity: input.quantity,
            note: null,
            performedBy: userId,
        },
    });

    const previousQty = updatedItem.quantity - input.quantity;
    const previousMinStock = updatedItem.minStock - minStockDelta;
    return {
        itemId: item.id,
        variantId: variant.id,
        itemName: item.name,
        sku: item.sku,
        previousQty,
        newQty: updatedItem.quantity,
        previousMinStock,
        newMinStock: updatedItem.minStock,
        lowStockAlerts: buildLowStockAlert(
            { ...item, quantity: previousQty },
            updatedItem.quantity,
            updatedItem.minStock,
        ),
    };
}

export async function createCategory(data: CreateCategoryInput) {
    return prisma.stockCategory.create({ data });
}

export async function deleteCategory(id: number) {
    return prisma.stockCategory.delete({ where: { id } });
}

export async function createItem(data: CreateStockItemInput) {
    const categoryId = data.categoryId ?? (await ensureDefaultCategoryId());
    const sku = data.sku?.trim() ? data.sku.trim() : generateSku();
    const variants = data.variants ?? [];
    const totalQuantity =
        variants.length > 0
            ? variants.reduce((sum, variant) => sum + variant.quantity, 0)
            : (data.quantity ?? 1);
    const totalMinStock =
        variants.length > 0
            ? variants.reduce((sum, variant) => sum + variant.minStock, 0)
            : (data.minStock ?? 1);
    const fallbackUnit = variants[0]?.unit ?? data.unit ?? "ชิ้น";

    return prisma.$transaction(async (tx) => {
        const item = await tx.stockItem.create({
            data: {
                name: data.name,
                description: data.description ?? null,
                imageUrl: data.imageUrl ?? null,
                sku,
                unit: fallbackUnit,
                quantity: totalQuantity,
                minStock: totalMinStock,
                categoryId,
            },
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

        // Initial quantities are opening balances; only later adjustments create ledger entries.
        if (variants.length === 0) {
            await ensureDefaultVariant(tx, item);
        } else {
            for (let index = 0; index < variants.length; index += 1) {
                const variant = variants[index];
                const variantRecord = await tx.stockItemVariant.create({
                    data: {
                        stockItemId: item.id,
                        sku: variant.sku?.trim() ? variant.sku.trim() : `${sku}-V${index + 1}`,
                        unit: variant.unit,
                        quantity: variant.quantity,
                        minStock: variant.minStock,
                        imageUrl: variant.imageUrl ?? item.imageUrl,
                        isActive: true,
                    },
                    select: { id: true },
                });

                await createVariantAttributes(
                    tx,
                    variantRecord.id,
                    variant.attributes,
                );
            }
        }

        return tx.stockItem.findUniqueOrThrow({
            where: { id: item.id },
            include: buildItemInclude(),
        });
    });
}

export async function updateItem(id: number, data: UpdateItemInput, userId: number) {
    const cleanupCandidates = new Set<string>();
    const retainedUploadUrls = new Set<string>();

    const updatedItem = await prisma.$transaction((tx) =>
        updateItemInTransaction(tx, id, data, userId, {
            cleanupCandidates,
            retainedUploadUrls,
        }),
    );

    await cleanupUnusedUploadUrls(cleanupCandidates, retainedUploadUrls);
    return updatedItem;
}

export async function adjustStock(
    itemId: number,
    input: AdjustStockInput,
    userId: number,
): Promise<AdjustStockResult> {
    return prisma.$transaction(async (tx) => {
        const item = await tx.stockItem.findUnique({
            where: { id: itemId },
            select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
                quantity: true,
                minStock: true,
                imageUrl: true,
                isActive: true,
            },
        });

        if (!item) {
            throw new Error("ไม่พบวัสดุ");
        }

        const variant = await findAdjustmentVariant(tx, item, input.variantId);
        return applyStockAdjustment(tx, item, variant, input, userId);
    });
}
