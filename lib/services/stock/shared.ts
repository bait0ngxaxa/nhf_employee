import { StockRequestStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
    deleteLocalUploadByUrl,
    isManagedUploadUrl,
} from "@/lib/uploads/local";
import type {
    CreateItemInput,
    CreateRequestInput,
} from "@/lib/validations/stock";
import type { PendingRequestItemRecord } from "./types";

export function generateSku(): string {
    const time = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `SKU-${time}-${rand}`;
}

/** Resolve existing active defaults for commands without creating variants. */
export async function loadActiveDefaultVariantsByItemIds(
    tx: Prisma.TransactionClient,
    itemIds: number[],
): Promise<Map<number, { id: number }>> {
    const uniqueItemIds = Array.from(new Set(itemIds));
    if (uniqueItemIds.length === 0) {
        return new Map();
    }

    const variants = await tx.stockItemVariant.findMany({
        where: { stockItemId: { in: uniqueItemIds }, isActive: true },
        select: {
            id: true,
            stockItemId: true,
        },
        orderBy: { id: "asc" },
    });

    const defaultVariants = new Map<number, { id: number }>();
    for (const variant of variants) {
        if (!defaultVariants.has(variant.stockItemId)) {
            defaultVariants.set(variant.stockItemId, { id: variant.id });
        }
    }

    return defaultVariants;
}

export class StockInvariantViolationError extends Error {
    constructor() {
        super("ข้อมูลวัสดุไม่สอดคล้อง: ไม่พบรายการย่อยของวัสดุ");
        this.name = "StockInvariantViolationError";
    }
}

export async function assertPersistedVariantsForRead(
    items: ReadonlyArray<{
        id: number;
        sku: string;
        variants: ReadonlyArray<unknown>;
    }>,
): Promise<void> {
    const itemsWithoutActiveVariants = items.filter(
        (item) => item.variants.length === 0,
    );
    if (itemsWithoutActiveVariants.length === 0) {
        return;
    }

    const persistedVariants = await prisma.stockItemVariant.findMany({
        where: {
            stockItemId: {
                in: itemsWithoutActiveVariants.map((item) => item.id),
            },
        },
        select: { stockItemId: true },
    });
    const itemIdsWithPersistedVariants = new Set(
        persistedVariants.map((variant) => variant.stockItemId),
    );
    const itemsWithoutPersistedVariants = itemsWithoutActiveVariants.filter(
        (item) => !itemIdsWithPersistedVariants.has(item.id),
    );

    if (itemsWithoutPersistedVariants.length === 0) {
        return;
    }

    for (const item of itemsWithoutPersistedVariants) {
        console.error("Stock invariant violation: item has no variant", {
            itemId: item.id,
            sku: item.sku,
        });
    }

    throw new StockInvariantViolationError();
}

// This include is a presentation view. An empty active list does not mean that
// the parent has no persisted variants; callers that need that distinction must
// query variants without the isActive filter.
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

export async function variantHasReferences(
    tx: Prisma.TransactionClient,
    variantId: number,
): Promise<boolean> {
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

export async function assertNoPendingStockRequestsForItem(
    tx: Prisma.TransactionClient,
    itemId: number,
): Promise<void> {
    const pendingRequestItem = await tx.stockRequestItem.findFirst({
        where: {
            itemId,
            request: { status: StockRequestStatus.PENDING_ISSUE },
        },
        select: { id: true },
    });

    if (pendingRequestItem) {
        throw new Error("ไม่สามารถปิดใช้งานวัสดุที่มีคำขอรอจ่ายอยู่");
    }
}

export async function assertNoPendingStockRequestsForVariants(
    tx: Prisma.TransactionClient,
    variantIds: readonly number[],
): Promise<void> {
    const uniqueVariantIds = Array.from(new Set(variantIds));
    if (uniqueVariantIds.length === 0) return;

    const pendingRequestItem = await tx.stockRequestItem.findFirst({
        where: {
            variantId: { in: uniqueVariantIds },
            request: { status: StockRequestStatus.PENDING_ISSUE },
        },
        select: { id: true },
    });

    if (pendingRequestItem) {
        throw new Error("ไม่สามารถปิดใช้งานรายการย่อยที่มีคำขอรอจ่ายอยู่");
    }
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
    } as const;
}

export function normalizeRequestItems(
    data: CreateRequestInput,
    itemIdByVariantId: Map<number, number>,
    defaultVariantsByItemId: Map<number, { id: number }>,
): Array<{ itemId: number; variantId: number; quantity: number }> {
    return data.items.map((item) => {
        const itemId = item.variantId
            ? itemIdByVariantId.get(item.variantId)
            : item.itemId;
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
