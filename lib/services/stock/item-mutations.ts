import { type StockTxType } from "@prisma/client";
import {
    defineAuditDetails,
    type StockItemAuditSnapshot,
    type StockVariantAuditSnapshot,
} from "@/lib/audit-log/contracts";
import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import {
    createStockCommandAudit,
    createStockVariantAudit,
} from "./command-audit";
import {
    buildVariantLabel,
    persistLowStockNotifications,
} from "./notifications";
import type {
    AdjustStockInput,
    CreateCategoryInput,
    UpdateItemInput,
} from "@/lib/validations/stock";
import {
    buildItemInclude,
    cleanupUnusedUploadUrls,
    createVariantAttributes,
    generateSku,
} from "./shared";
import {
    createDefaultVariantForNewItem,
    createStockOpeningBalanceTransaction,
    ensureDefaultCategoryId,
} from "./write-helpers";
import { updateItemInTransaction } from "./item-update.shared";
import type { StockTxClient } from "./item-update.types";
import type {
    AdjustStockResult,
    CreateStockItemInput,
    LowStockAlertCandidate,
    StockCommandActor,
} from "./types";
import { lockStockInventoryRows } from "./locks";
import { setStockItemDefaultVariantIfUnset } from "./default-variant-writer";
import {
    summarizeVariantInventory,
    withVariantInventorySummary,
} from "./inventory-quantity-read";

type VariantLowStockAlertCandidate = Extract<
    LowStockAlertCandidate,
    { variantId: number }
>;

function buildVariantLowStockAlert(
    item: Pick<AdjustmentItem, "id" | "name">,
    variant: AdjustmentVariant,
    nextQuantity: number,
    nextMinStock: number,
): VariantLowStockAlertCandidate[] {
    const wasLowStock = variant.quantity <= variant.minStock;
    const isLowStock = nextQuantity <= nextMinStock;
    if (wasLowStock || !isLowStock) {
        return [];
    }

    return [
        {
            itemId: item.id,
            variantId: variant.id,
            itemName: item.name,
            variantSku: variant.sku,
            variantLabel:
                buildVariantLabel(variant.attributeValues) ?? variant.sku,
            quantity: nextQuantity,
            minStock: nextMinStock,
            unit: variant.unit,
        },
    ];
}

type AdjustmentItem = {
    id: number;
    name: string;
    sku: string;
    unit: string;
    imageUrl: string | null;
    isActive: boolean;
};

type AdjustmentVariant = {
    id: number;
    sku: string;
    unit: string;
    quantity: number;
    minStock: number;
    attributeValues: Array<{
        attributeValue: {
            value: string;
            attribute: { name: string };
        };
    }>;
};

type AppliedStockAdjustment = AdjustStockResult & {
    transactionId: number;
    notificationAlerts: VariantLowStockAlertCandidate[];
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
    category?: { name: string };
    variants: AuditableStockVariant[];
};

function createItemAuditSnapshot(item: AuditableStockItem): StockItemAuditSnapshot {
    const inventory = summarizeVariantInventory(item.variants ?? []);

    return {
        name: item.name,
        description: item.description,
        sku: item.sku,
        unit: item.unit,
        ...inventory,
        imageUrl: item.imageUrl,
        categoryId: item.categoryId,
        ...(item.category?.name ? { categoryName: item.category.name } : {}),
        isActive: item.isActive,
    };
}

function createVariantAuditSnapshot(
    variant: AuditableStockVariant,
): StockVariantAuditSnapshot {
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
    item: Pick<AuditableStockItem, "id" | "name" | "sku">,
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
            defineAuditDetails("STOCK_ITEM_UPDATE", {
                ...(beforeSnapshot && { before: beforeSnapshot }),
                ...(afterSnapshot && { after: afterSnapshot }),
                metadata: {
                    itemId: item.id,
                    itemName: item.name,
                    itemSku: item.sku,
                    variantLabel: formatAttributeAuditLabel(
                        afterSnapshot?.attributes ?? beforeSnapshot?.attributes ?? [],
                    ),
                    variantId,
                    transactionIds: transactionIdsByVariantId.get(variantId) ?? [],
                },
            }),
        );
    }
}

function formatAttributeAuditLabel(
    attributes: StockVariantAuditSnapshot["attributes"],
): string | undefined {
    const label = attributes.map(({ value }) => value).join(" / ");
    return label || undefined;
}

async function findAdjustmentVariant(
    tx: StockTxClient,
    item: AdjustmentItem,
    variantId: number | undefined,
): Promise<AdjustmentVariant> {
    if (variantId !== undefined) {
        const variant = await tx.stockItemVariant.findFirst({
            where: { id: variantId, stockItemId: item.id, isActive: true },
            select: {
                id: true,
                sku: true,
                unit: true,
                quantity: true,
                minStock: true,
                attributeValues: {
                    select: {
                        attributeValue: {
                            select: {
                                value: true,
                                attribute: { select: { name: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!variant) {
            throw new Error("ไม่พบรายการย่อยของวัสดุ");
        }
        return variant;
    }

    const activeVariants = await tx.stockItemVariant.findMany({
        where: { stockItemId: item.id, isActive: true },
        select: {
            id: true,
            sku: true,
            unit: true,
            quantity: true,
            minStock: true,
            attributeValues: {
                select: {
                    attributeValue: {
                        select: {
                            value: true,
                            attribute: { select: { name: true } },
                        },
                    },
                },
            },
        },
        orderBy: { id: "asc" },
    });
    if (activeVariants.length > 1) {
        throw new Error("กรุณาเลือกรายการย่อยของวัสดุ");
    }
    if (activeVariants.length === 1) {
        return activeVariants[0];
    }

    throw new Error("ไม่พบรายการย่อยของวัสดุ กรุณาซ่อมข้อมูลรายการย่อยก่อนใช้งาน");
}

async function applyStockAdjustment(
    tx: StockTxClient,
    item: AdjustmentItem,
    variant: AdjustmentVariant,
    input: AdjustStockInput,
    userId: number,
): Promise<AppliedStockAdjustment> {
    const inventoryBefore = await tx.stockItemVariant.aggregate({
        where: { stockItemId: item.id, isActive: true },
        _sum: { quantity: true, minStock: true },
    });
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

    const previousQty = inventoryBefore._sum.quantity ?? 0;
    const previousMinStock = inventoryBefore._sum.minStock ?? 0;
    const newQty = previousQty + input.quantity;
    const newMinStock =
        previousMinStock - variant.minStock + input.minStock;
    const variantQuantity = variant.quantity + input.quantity;
    const notificationAlerts = buildVariantLowStockAlert(
        item,
        variant,
        variantQuantity,
        input.minStock,
    );
    return {
        itemId: item.id,
        variantId: variant.id,
        itemName: item.name,
        sku: item.sku,
        previousQty,
        newQty,
        previousMinStock,
        newMinStock,
        lowStockAlerts: notificationAlerts.map((alert) => ({
            itemId: alert.itemId,
            name: item.name,
            sku: item.sku,
            quantity: alert.quantity,
            minStock: alert.minStock,
            unit: alert.unit,
        })),
        notificationAlerts,
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
                categoryId,
            },
            select: {
                id: true,
                sku: true,
                unit: true,
                imageUrl: true,
                isActive: true,
            },
        });

        const createdVariantIds: number[] = [];

        // Initial quantities are opening balances and are recorded in the stock ledger.
        if (variants.length === 0) {
            const variant = await createDefaultVariantForNewItem(
                tx,
                {
                    ...item,
                    quantity: totalQuantity,
                    minStock: totalMinStock,
                },
                actor.id,
            );
            createdVariantIds.push(variant.id);
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
                createdVariantIds.push(variantRecord.id);

                await createStockOpeningBalanceTransaction(
                    tx,
                    item.id,
                    variantRecord.id,
                    variant.quantity,
                    actor.id,
                );

                await createVariantAttributes(
                    tx,
                    variantRecord.id,
                    variant.attributes,
                );
            }
        }
        const defaultVariantId = Math.min(...createdVariantIds);
        await setStockItemDefaultVariantIfUnset(
            tx,
            item.id,
            defaultVariantId,
        );

        const createdItem = withVariantInventorySummary(
            await tx.stockItem.findUniqueOrThrow({
                where: { id: item.id },
                include: buildItemInclude(),
            }),
        );
        await createStockCommandAudit(
            tx,
            "STOCK_ITEM_CREATE",
            item.id,
            actor,
            defineAuditDetails("STOCK_ITEM_CREATE", {
                after: createItemAuditSnapshot(createdItem),
                metadata: {
                    itemId: item.id,
                    variantIds: createdItem.variants.map((variant) => variant.id),
                },
            }),
        );
        for (const variant of createdItem.variants) {
            await createStockVariantAudit(
                tx,
                "STOCK_ITEM_CREATE",
                variant.id,
                actor,
                defineAuditDetails("STOCK_ITEM_CREATE", {
                    after: createVariantAuditSnapshot(variant),
                    metadata: {
                        itemId: item.id,
                        itemName: createdItem.name,
                        itemSku: createdItem.sku,
                        variantId: variant.id,
                        variantLabel: formatAttributeAuditLabel(
                            createVariantAuditSnapshot(variant).attributes,
                        ),
                    },
                }),
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
        await createStockCommandAudit(
            tx,
            auditAction,
            id,
            actor,
            defineAuditDetails(auditAction, {
                before: createItemAuditSnapshot(beforeItem),
                after: createItemAuditSnapshot(item),
                metadata: {
                    itemId: id,
                    variantIds: afterVariants.map((variant) => variant.id),
                    transactionIds: Array.from(
                        transactionIdsByVariantId.values(),
                    ).flat(),
                },
            }),
        );
        await auditChangedVariants(
            tx,
            beforeVariants,
            afterVariants,
            actor,
            item,
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
                imageUrl: true,
                isActive: true,
            },
        });

        if (!item) {
            throw new Error("ไม่พบวัสดุ");
        }
        if (!item.isActive) {
            throw new Error("ไม่สามารถปรับสต็อกของวัสดุที่ปิดใช้งานแล้ว");
        }

        const variant = await findAdjustmentVariant(
            tx,
            item,
            input.variantId,
        );
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
            defineAuditDetails("STOCK_ADJUST", {
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
                    itemName: item.name,
                    itemSku: item.sku,
                    variantId: adjustment.variantId,
                    variantLabel: buildVariantLabel(variant.attributeValues ?? [])
                        ?? variant.sku,
                    unit: variant.unit,
                    adjustmentType: input.type,
                    adjustmentQuantity: input.quantity,
                    transactionIds: [adjustment.transactionId],
                },
            }),
        );
        await persistLowStockNotifications(adjustment.notificationAlerts, tx);

        const {
            transactionId: _transactionId,
            notificationAlerts: _notificationAlerts,
            ...result
        } = adjustment;
        return result;
    });
}
