import type { Prisma } from "@prisma/client";
import { LEGACY_DEFAULT_VARIANT_ORDER_BY } from "./legacy-default-variant";

export class InvalidStockDefaultVariantError extends Error {
    constructor() {
        super(
            "ไม่สามารถกำหนดรายการย่อยเริ่มต้นที่ไม่ได้เปิดใช้งานหรืออยู่คนละวัสดุ",
        );
        this.name = "InvalidStockDefaultVariantError";
    }
}

export async function setStockItemDefaultVariantIfUnset(
    tx: Prisma.TransactionClient,
    itemId: number,
    variantId: number,
): Promise<boolean> {
    const updated = await tx.stockItem.updateMany({
        where: {
            id: itemId,
            defaultVariantId: null,
            variants: {
                some: {
                    id: variantId,
                    isActive: true,
                },
            },
        },
        data: { defaultVariantId: variantId },
    });
    if (updated.count === 1) {
        return true;
    }

    const item = await tx.stockItem.findUnique({
        where: { id: itemId },
        select: { defaultVariantId: true },
    });
    if (item?.defaultVariantId !== null && item?.defaultVariantId !== undefined) {
        return false;
    }

    throw new InvalidStockDefaultVariantError();
}

export async function reconcileStockItemDefaultVariant(
    tx: Prisma.TransactionClient,
    itemId: number,
): Promise<number | null> {
    const item = await tx.stockItem.findUnique({
        where: { id: itemId },
        select: {
            defaultVariantId: true,
            defaultVariant: {
                select: {
                    stockItemId: true,
                    isActive: true,
                },
            },
        },
    });
    if (!item) {
        throw new InvalidStockDefaultVariantError();
    }
    if (
        item.defaultVariantId !== null
        && item.defaultVariant?.stockItemId === itemId
        && item.defaultVariant.isActive
    ) {
        return item.defaultVariantId;
    }

    const replacement = await tx.stockItemVariant.findFirst({
        where: { stockItemId: itemId, isActive: true },
        orderBy: LEGACY_DEFAULT_VARIANT_ORDER_BY,
        select: { id: true },
    });
    if (!replacement) {
        await tx.stockItem.update({
            where: { id: itemId },
            data: { defaultVariantId: null },
        });
        return null;
    }

    const updated = await tx.stockItem.updateMany({
        where: {
            id: itemId,
            variants: {
                some: {
                    id: replacement.id,
                    isActive: true,
                },
            },
        },
        data: { defaultVariantId: replacement.id },
    });
    if (updated.count !== 1) {
        throw new InvalidStockDefaultVariantError();
    }

    return replacement.id;
}
