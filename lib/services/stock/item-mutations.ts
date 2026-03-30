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
    summarizeVariantInventory,
    variantHasReferences,
} from "./shared";
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

    const updatedItem = await prisma.$transaction(async (tx) => {
        const { variants, ...itemData } = data;

        if (variants && variants.length > 0) {
            const item = await tx.stockItem.findUniqueOrThrow({
                where: { id },
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

            const existingVariants = await tx.stockItemVariant.findMany({
                where: { stockItemId: id },
                select: {
                    id: true,
                    sku: true,
                    imageUrl: true,
                    isActive: true,
                },
                orderBy: { id: "asc" },
            });

            if (existingVariants.length === 0) {
                await ensureDefaultVariant(tx, {
                    id: item.id,
                    sku: item.sku,
                    unit: item.unit,
                    quantity: item.quantity,
                    minStock: item.minStock,
                    imageUrl: item.imageUrl,
                    isActive: item.isActive,
                });
            }

            const syncedVariants = existingVariants.length
                ? existingVariants
                : await tx.stockItemVariant.findMany({
                      where: { stockItemId: id },
                      select: {
                          id: true,
                          sku: true,
                          imageUrl: true,
                          isActive: true,
                      },
                      orderBy: { id: "asc" },
                  });

            const existingVariantById = new Map(
                syncedVariants.map((variant) => [variant.id, variant]),
            );

            for (const variant of variants) {
                if (variant.id && !existingVariantById.has(variant.id)) {
                    throw new Error("พบรายการย่อยไม่ถูกต้อง");
                }
            }

            const inventorySummary = summarizeVariantInventory(variants, item.unit);
            const nextItem = await tx.stockItem.update({
                where: { id },
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

            if (item.imageUrl && item.imageUrl !== nextItem.imageUrl) {
                cleanupCandidates.add(item.imageUrl);
            }
            if (nextItem.imageUrl) {
                retainedUploadUrls.add(nextItem.imageUrl);
            }

            const submittedIds = new Set(
                variants
                    .map((variant) => variant.id)
                    .filter((variantId): variantId is number => variantId !== undefined),
            );

            for (let index = 0; index < variants.length; index += 1) {
                const variant = variants[index];
                if (!variant.id) {
                    const nextVariantImageUrl = variant.imageUrl ?? nextItem.imageUrl;
                    const createdVariant = await tx.stockItemVariant.create({
                        data: {
                            stockItemId: id,
                            sku:
                                variant.sku?.trim() ||
                                `${nextItem.sku}-V${index + 1}`,
                            unit: variant.unit,
                            quantity: variant.quantity,
                            minStock: variant.minStock,
                            imageUrl: variant.imageUrl ?? nextItem.imageUrl,
                            isActive: true,
                        },
                        select: { id: true },
                    });
                    await createVariantAttributes(
                        tx,
                        createdVariant.id,
                        variant.attributes,
                    );
                    if (nextVariantImageUrl) {
                        retainedUploadUrls.add(nextVariantImageUrl);
                    }
                    continue;
                }

                const existingVariant = existingVariantById.get(variant.id);
                if (!existingVariant) {
                    throw new Error("พบรายการย่อยไม่ถูกต้อง");
                }

                await tx.stockItemVariant.update({
                    where: { id: variant.id },
                    data: {
                        sku:
                            variant.sku?.trim() ||
                            existingVariant.sku ||
                            `${nextItem.sku}-V${index + 1}`,
                        unit: variant.unit,
                        quantity: variant.quantity,
                        minStock: variant.minStock,
                        imageUrl:
                            variant.imageUrl ??
                            existingVariant.imageUrl ??
                            nextItem.imageUrl,
                    },
                });

                const nextVariantImageUrl =
                    variant.imageUrl ?? existingVariant.imageUrl ?? nextItem.imageUrl;

                if (
                    existingVariant.imageUrl &&
                    existingVariant.imageUrl !== nextVariantImageUrl
                ) {
                    cleanupCandidates.add(existingVariant.imageUrl);
                }
                if (nextVariantImageUrl) {
                    retainedUploadUrls.add(nextVariantImageUrl);
                }

                await tx.stockVariantAttributeValue.deleteMany({
                    where: { variantId: variant.id },
                });
                await createVariantAttributes(tx, variant.id, variant.attributes);
            }

            const removedVariants = syncedVariants.filter(
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
                    cleanupCandidates.add(removedVariant.imageUrl);
                }

                await tx.stockVariantAttributeValue.deleteMany({
                    where: { variantId: removedVariant.id },
                });
                await tx.stockItemVariant.delete({
                    where: { id: removedVariant.id },
                });
            }

            return tx.stockItem.findUniqueOrThrow({
                where: { id },
                include: buildItemInclude(),
            });
        }

        const currentItem = await tx.stockItem.findUniqueOrThrow({
            where: { id },
            select: { imageUrl: true },
        });

        const nextItem = await tx.stockItem.update({
            where: { id },
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

        if (currentItem.imageUrl && currentItem.imageUrl !== nextItem.imageUrl) {
            cleanupCandidates.add(currentItem.imageUrl);
        }
        if (nextItem.imageUrl) {
            retainedUploadUrls.add(nextItem.imageUrl);
        }

        const defaultVariant = await ensureDefaultVariant(tx, nextItem);
        await tx.stockItemVariant.update({
            where: { id: defaultVariant.id },
            data: {
                ...(data.sku !== undefined && { sku: nextItem.sku }),
                ...(data.unit !== undefined && { unit: nextItem.unit }),
                ...(data.minStock !== undefined && { minStock: nextItem.minStock }),
                ...(data.imageUrl !== undefined && { imageUrl: nextItem.imageUrl }),
                ...(data.isActive !== undefined && { isActive: nextItem.isActive }),
            },
        });

        return tx.stockItem.findUniqueOrThrow({
            where: { id },
            include: buildItemInclude(),
        });
    });

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
