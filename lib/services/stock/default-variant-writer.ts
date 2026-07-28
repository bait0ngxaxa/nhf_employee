import type { Prisma } from "@prisma/client";

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
