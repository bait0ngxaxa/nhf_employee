import { type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
    deleteLocalUploadByUrl,
    isManagedUploadUrl,
} from "@/lib/uploads/local";
import { DEFAULT_STOCK_CATEGORY_NAME } from "./constants";
import type {
    CreateItemInput,
    CreateRequestInput,
} from "@/lib/validations/stock";
import type {
    ItemVariantSeed,
    PendingRequestItemRecord,
} from "./types";

export function generateSku(): string {
    const time = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `SKU-${time}-${rand}`;
}

export async function ensureDefaultCategoryId(): Promise<number> {
    const category = await prisma.stockCategory.upsert({
        where: { name: DEFAULT_STOCK_CATEGORY_NAME },
        update: {},
        create: { name: DEFAULT_STOCK_CATEGORY_NAME },
        select: { id: true },
    });
    return category.id;
}

export async function ensureDefaultVariant(
    tx: Prisma.TransactionClient,
    item: ItemVariantSeed,
): Promise<{ id: number }> {
    const existingVariant = await tx.stockItemVariant.findFirst({
        where: { stockItemId: item.id, isActive: true },
        orderBy: { id: "asc" },
        select: { id: true },
    });

    if (existingVariant) {
        return existingVariant;
    }

    return tx.stockItemVariant.create({
        data: {
            stockItemId: item.id,
            sku: item.sku,
            unit: item.unit,
            quantity: item.quantity,
            minStock: item.minStock,
            imageUrl: item.imageUrl,
            isActive: item.isActive,
        },
        select: { id: true },
    });
}

export async function ensureDefaultVariantsByItemIds(
    tx: Prisma.TransactionClient,
    itemIds: number[],
): Promise<Map<number, { id: number }>> {
    const uniqueItemIds = Array.from(new Set(itemIds));
    if (uniqueItemIds.length === 0) {
        return new Map();
    }

    const items = await tx.stockItem.findMany({
        where: { id: { in: uniqueItemIds } },
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

    const variants = new Map<number, { id: number }>();
    for (const item of items) {
        variants.set(item.id, await ensureDefaultVariant(tx, item));
    }

    return variants;
}

export async function ensureItemVariantsExist(itemIds: number[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await ensureDefaultVariantsByItemIds(tx, itemIds);
    });
}

export function buildItemInclude() {
    return {
        category: { select: { id: true, name: true } },
        variants: {
            where: { isActive: true },
            include: {
                attributeValues: {
                    include: {
                        attributeValue: {
                            include: { attribute: { select: { id: true, name: true } } },
                        },
                    },
                },
            },
            orderBy: { id: "asc" as const },
        },
    };
}

export function appendReservedQuantity(
    reservedMap: Map<number, number>,
    key: number,
    quantity: number,
): void {
    reservedMap.set(key, (reservedMap.get(key) ?? 0) + quantity);
}

export function buildReservedQuantityMaps(
    requestItems: PendingRequestItemRecord[],
    defaultVariantIdByItemId: Map<number, number>,
): {
    reservedByItemId: Map<number, number>;
    reservedByVariantId: Map<number, number>;
} {
    const reservedByItemId = new Map<number, number>();
    const reservedByVariantId = new Map<number, number>();

    for (const requestItem of requestItems) {
        appendReservedQuantity(
            reservedByItemId,
            requestItem.itemId,
            requestItem.quantity,
        );

        const variantId =
            requestItem.variantId ?? defaultVariantIdByItemId.get(requestItem.itemId);
        if (!variantId) {
            continue;
        }

        appendReservedQuantity(
            reservedByVariantId,
            variantId,
            requestItem.quantity,
        );
    }

    return { reservedByItemId, reservedByVariantId };
}

export function getAvailableQuantity(
    quantity: number,
    reservedQuantity: number,
): number {
    return Math.max(0, quantity - reservedQuantity);
}

export async function createVariantAttributes(
    tx: Prisma.TransactionClient,
    variantId: number,
    attributes: NonNullable<CreateItemInput["variants"]>[number]["attributes"],
): Promise<void> {
    for (const attribute of attributes) {
        const attributeRecord = await tx.stockAttribute.upsert({
            where: { name: attribute.name },
            update: {},
            create: { name: attribute.name },
            select: { id: true },
        });

        const attributeValue = await tx.stockAttributeValue.upsert({
            where: {
                attributeId_value: {
                    attributeId: attributeRecord.id,
                    value: attribute.value,
                },
            },
            update: {},
            create: {
                attributeId: attributeRecord.id,
                value: attribute.value,
            },
            select: { id: true },
        });

        await tx.stockVariantAttributeValue.create({
            data: {
                variantId,
                attributeValueId: attributeValue.id,
            },
        });
    }
}

export function summarizeVariantInventory(
    variants: Array<{ quantity: number; minStock: number; unit: string }>,
    fallbackUnit: string,
): { quantity: number; minStock: number; unit: string } {
    return {
        quantity: variants.reduce((sum, variant) => sum + variant.quantity, 0),
        minStock: variants.reduce((sum, variant) => sum + variant.minStock, 0),
        unit: variants[0]?.unit ?? fallbackUnit,
    };
}

export async function variantHasReferences(
    tx: Prisma.TransactionClient,
    variantId: number,
) {
    const [transaction, requestItem] = await Promise.all([
        tx.stockTransaction.findFirst({
            where: { variantId },
            select: { id: true },
        }),
        tx.stockRequestItem.findFirst({
            where: { variantId },
            select: { id: true },
        }),
    ]);

    return Boolean(transaction || requestItem);
}

export async function cleanupUnusedUploadUrls(
    candidateUrls: Iterable<string | null | undefined>,
    retainedUrls: Iterable<string | null | undefined>,
): Promise<void> {
    const retained = new Set(
        Array.from(retainedUrls).filter((url): url is string => isManagedUploadUrl(url)),
    );
    const candidates = Array.from(
        new Set(
            Array.from(candidateUrls).filter(
                (url): url is string => isManagedUploadUrl(url) && !retained.has(url),
            ),
        ),
    );

    await Promise.allSettled(candidates.map((url) => deleteLocalUploadByUrl(url)));
}

export function buildRequestInclude() {
    return {
        requester: { select: { id: true, name: true, email: true } },
        issuer: { select: { id: true, name: true } },
        canceller: { select: { id: true, name: true } },
        items: {
            include: {
                item: {
                    select: { id: true, name: true, sku: true, unit: true },
                },
                variant: {
                    select: {
                        id: true,
                        sku: true,
                        unit: true,
                        imageUrl: true,
                        attributeValues: {
                            include: {
                                attributeValue: {
                                    include: {
                                        attribute: { select: { id: true, name: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    };
}

export function normalizeRequestItems(
    data: CreateRequestInput,
    itemIdByVariantId: Map<number, number>,
    defaultVariantsByItemId: Map<number, { id: number }>,
): Array<{ itemId: number; variantId: number; quantity: number }> {
    return data.items.map((item) => {
        const itemId =
            item.itemId ??
            (item.variantId ? itemIdByVariantId.get(item.variantId) : undefined);
        const variantId =
            item.variantId ??
            (itemId ? defaultVariantsByItemId.get(itemId)?.id : undefined);

        if (!itemId || !variantId) {
            throw new Error("กรุณาเลือกรายการวัสดุ");
        }

        return {
            itemId,
            variantId,
            quantity: item.quantity,
        };
    });
}
