import { type StockTxType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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

export async function updateItem(id: number, data: UpdateItemInput) {
    const cleanupCandidates = new Set<string>();
    const retainedUploadUrls = new Set<string>();

    const updatedItem = await prisma.$transaction((tx) =>
        updateItemInTransaction(tx, id, data, {
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

        const newQty = item.quantity + input.quantity;
        if (newQty < 0) {
            throw new Error("ยอดคงเหลือต้องไม่ติดลบ");
        }

        const lowStockAlerts = buildLowStockAlert(item, newQty, input.minStock);

        await tx.stockItem.update({
            where: { id: itemId },
            data: {
                quantity: newQty,
                minStock: input.minStock,
            },
        });

        const defaultVariant = await ensureDefaultVariant(tx, item);
        await tx.stockItemVariant.update({
            where: { id: defaultVariant.id },
            data: {
                quantity: newQty,
                minStock: input.minStock,
            },
        });

        await tx.stockTransaction.create({
            data: {
                itemId,
                variantId: defaultVariant.id,
                type: input.type as StockTxType,
                quantity: input.quantity,
                note: null,
                performedBy: userId,
            },
        });

        return {
            itemId,
            variantId: defaultVariant.id,
            previousQty: item.quantity,
            newQty,
            previousMinStock: item.minStock,
            newMinStock: input.minStock,
            lowStockAlerts,
        };
    });
}
