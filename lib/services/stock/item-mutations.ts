import { type StockTxType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import {
    createStockCommandAudit,
    createStockVariantAudit,
} from "./command-audit";
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

type AppliedStockAdjustment = AdjustStockResult & {
    transactionId: number;
};

type AuditableStockVariant = {
    id: number;
    sku: string;
    unit: string;
    quantity: number;
    minStock: number;
    imageUrl: string | null;
    isActive: boolean;
    attributeValues?: Array<{
        attributeValue: {
            value: string;
            attribute: { name: string };
        };
    }>;
};

type AuditableStockItem = {
    id: number;
    name: string;
    description: string | null;
    sku: string;
    unit: string;
    quantity: number;
    minStock: number;
    imageUrl: string | null;
    categoryId: number;
    isActive: boolean;
    variants: AuditableStockVariant[];
};

function createItemAuditSnapshot(item: AuditableStockItem): Record<string, unknown> {
    return {
        name: item.name,
        description: item.description,
        sku: item.sku,
        unit: item.unit,
        quantity: item.quantity,
        minStock: item.minStock,
        imageUrl: item.imageUrl,
        categoryId: item.categoryId,
        isActive: item.isActive,
    };
}

function createVariantAuditSnapshot(
    variant: AuditableStockVariant,
): Record<string, unknown> {
    const attributes = (variant.attributeValues ?? [])
        .map(({ attributeValue }) => ({
            name: attributeValue.attribute.name,
            value: attributeValue.value,
        }))
        .sort((left, right) => {
            const nameOrder = left.name.localeCompare(right.name, "th");
            return nameOrder !== 0
                ? nameOrder
                : left.value.localeCompare(right.value, "th");
        });

    return {
        sku: variant.sku,
        unit: variant.unit,
        quantity: variant.quantity,
        minStock: variant.minStock,
        imageUrl: variant.imageUrl,
        isActive: variant.isActive,
        attributes,
    };
}

async function auditChangedVariants(
    tx: StockTxClient,
    beforeVariants: AuditableStockVariant[],
    afterVariants: AuditableStockVariant[],
    actor: StockCommandActor,
    itemId: number,
    transactionIdsByVariantId: Map<number, number[]>,
): Promise<void> {
    const beforeById = new Map(beforeVariants.map((variant) => [variant.id, variant]));
    const afterById = new Map(afterVariants.map((variant) => [variant.id, variant]));
    const variantIds = Array.from(
        new Set([...beforeById.keys(), ...afterById.keys()]),
    ).sort((left, right) => left - right);

    for (const variantId of variantIds) {
        const before = beforeById.get(variantId);
        const after = afterById.get(variantId);
        const beforeSnapshot = before ? createVariantAuditSnapshot(before) : undefined;
        const afterSnapshot = after ? createVariantAuditSnapshot(after) : undefined;
        if (JSON.stringify(beforeSnapshot) === JSON.stringify(afterSnapshot)) continue;

        await createStockVariantAudit(
            tx,
            "STOCK_ITEM_UPDATE",
            variantId,
            actor,
            {
                ...(beforeSnapshot && { before: beforeSnapshot }),
                ...(afterSnapshot && { after: afterSnapshot }),
                metadata: {
                    itemId,
                    variantId,
                    transactionIds: transactionIdsByVariantId.get(variantId) ?? [],
                },
            },
        );
    }
}

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
): Promise<AppliedStockAdjustment> {
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
    const transaction = await tx.stockTransaction.create({
        data: {
            itemId: item.id,
            variantId: variant.id,
            type: input.type as StockTxType,
            quantity: input.quantity,
            note: null,
            performedBy: userId,
        },
        select: { id: true },
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
        transactionId: transaction.id,
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
            {
                after: createItemAuditSnapshot(createdItem),
                metadata: {
                    itemId: item.id,
                    variantIds: createdItem.variants.map((variant) => variant.id),
                },
            },
        );
        for (const variant of createdItem.variants) {
            await createStockVariantAudit(
                tx,
                "STOCK_ITEM_CREATE",
                variant.id,
                actor,
                {
                    after: createVariantAuditSnapshot(variant),
                    metadata: { itemId: item.id, variantId: variant.id },
                },
            );
        }
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
        const beforeItem = await tx.stockItem.findUniqueOrThrow({
            where: { id },
            include: buildItemInclude(),
        });
        const cleanupCandidates = new Set<string>();
        const retainedUploadUrls = new Set<string>();
        const transactionIdsByVariantId = new Map<number, number[]>();
        const item = await updateItemInTransaction(tx, id, data, actor.id, {
            cleanupCandidates,
            retainedUploadUrls,
            transactionIdsByVariantId,
        });
        const beforeVariants = beforeItem.variants ?? [];
        const afterVariants = item.variants ?? [];
        await createStockCommandAudit(tx, auditAction, id, actor, {
            before: createItemAuditSnapshot(beforeItem),
            after: createItemAuditSnapshot(item),
            metadata: {
                itemId: id,
                variantIds: afterVariants.map((variant) => variant.id),
                transactionIds: Array.from(transactionIdsByVariantId.values()).flat(),
            },
        });
        await auditChangedVariants(
            tx,
            beforeVariants,
            afterVariants,
            actor,
            id,
            transactionIdsByVariantId,
        );
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
            adjustment.transactionId,
            actor,
            {
                before: {
                    quantity: adjustment.previousQty,
                    minStock: adjustment.previousMinStock,
                    variantQuantity: variant.quantity,
                    variantMinStock: variant.minStock,
                },
                after: {
                    name: adjustment.itemName,
                    sku: adjustment.sku,
                    quantity: adjustment.newQty,
                    minStock: adjustment.newMinStock,
                    variantQuantity: variant.quantity + input.quantity,
                    variantMinStock: input.minStock,
                },
                metadata: {
                    itemId,
                    variantId: adjustment.variantId,
                    adjustmentType: input.type,
                    adjustmentQuantity: input.quantity,
                    transactionIds: [adjustment.transactionId],
                },
            },
        );
        await persistLowStockNotifications(adjustment.lowStockAlerts, tx);

        const { transactionId: _transactionId, ...result } = adjustment;
        return result;
    });
}
