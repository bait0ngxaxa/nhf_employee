import { type StockTxType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { createStockCommandAudit } from "./command-audit";
import { persistLowStockNotifications } from "./notifications";
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
    StockCommandActor,
} from "./types";
import { lockStockInventoryRows } from "./locks";

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

export async function createCategory(
    data: CreateCategoryInput,
    actor: StockCommandActor,
) {
    return prisma.$transaction(async (tx) => {
        const category = await tx.stockCategory.create({ data });
        await createStockCommandAudit(
            tx,
            "STOCK_CATEGORY_CREATE",
            category.id,
            actor,
            { after: { name: category.name } },
        );
        return category;
    });
}

export async function deleteCategory(id: number, actor: StockCommandActor) {
    return prisma.$transaction(async (tx) => {
        const category = await tx.stockCategory.delete({ where: { id } });
        await createStockCommandAudit(
            tx,
            "STOCK_CATEGORY_DELETE",
            id,
            actor,
            { before: { name: category.name } },
        );
        return category;
    });
}

export async function createItem(
    data: CreateStockItemInput,
    actor: StockCommandActor,
) {
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

        const createdItem = await tx.stockItem.findUniqueOrThrow({
            where: { id: item.id },
            include: buildItemInclude(),
        });
        await createStockCommandAudit(
            tx,
            "STOCK_ITEM_CREATE",
            item.id,
            actor,
            { after: { name: createdItem.name, sku: createdItem.sku } },
        );
        return createdItem;
    });
}

export async function updateItem(
    id: number,
    data: UpdateItemInput,
    actor: StockCommandActor,
    auditAction: "STOCK_ITEM_UPDATE" | "STOCK_ITEM_DELETE" = "STOCK_ITEM_UPDATE",
) {
    const result = await runSerializableTransaction(async (tx) => {
        await lockStockInventoryRows(tx, [id]);
        const cleanupCandidates = new Set<string>();
        const retainedUploadUrls = new Set<string>();
        const item = await updateItemInTransaction(tx, id, data, actor.id, {
            cleanupCandidates,
            retainedUploadUrls,
        });
        await createStockCommandAudit(tx, auditAction, id, actor, {
            after: {
                name: item.name,
                sku: item.sku,
                isActive: item.isActive,
            },
        });
        return { item, cleanupCandidates, retainedUploadUrls };
    });

    await cleanupUnusedUploadUrls(
        result.cleanupCandidates,
        result.retainedUploadUrls,
    );
    return result.item;
}

export async function adjustStock(
    itemId: number,
    input: AdjustStockInput,
    actor: StockCommandActor,
): Promise<AdjustStockResult> {
    return runSerializableTransaction(async (tx) => {
        await lockStockInventoryRows(tx, [itemId]);
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
        const adjustment = await applyStockAdjustment(
            tx,
            item,
            variant,
            input,
            actor.id,
        );
        await createStockCommandAudit(
            tx,
            "STOCK_ADJUST",
            itemId,
            actor,
            {
                after: {
                    name: adjustment.itemName,
                    sku: adjustment.sku,
                    type: input.type,
                    quantity: input.quantity,
                    previousQty: adjustment.previousQty,
                    newQty: adjustment.newQty,
                    previousMinStock: adjustment.previousMinStock,
                    newMinStock: adjustment.newMinStock,
                },
            },
        );
        await persistLowStockNotifications(adjustment.lowStockAlerts, tx);

        return adjustment;
    });
}
