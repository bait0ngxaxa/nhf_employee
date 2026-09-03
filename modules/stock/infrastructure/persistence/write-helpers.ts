import { StockTxType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
    DEFAULT_STOCK_CATEGORY_NAME,
    STOCK_OPENING_BALANCE_NOTE,
} from "../../domain/constants";
import type { ItemVariantSeed } from "../../domain/types";

export async function ensureDefaultCategoryId(): Promise<number> {
    const category = await prisma.stockCategory.upsert({
        where: { name: DEFAULT_STOCK_CATEGORY_NAME },
        update: {},
        create: { name: DEFAULT_STOCK_CATEGORY_NAME },
        select: { id: true },
    });
    return category.id;
}

export async function createStockOpeningBalanceTransaction(
    tx: Prisma.TransactionClient,
    itemId: number,
    variantId: number,
    quantity: number,
    performedBy: number,
): Promise<number> {
    const transaction = await tx.stockTransaction.upsert({
        where: { openingBalanceKey: `stock-variant:${variantId}` },
        update: {},
        create: {
            itemId,
            variantId,
            type: StockTxType.OPENING_BALANCE,
            quantity,
            note: STOCK_OPENING_BALANCE_NOTE,
            performedBy,
            openingBalanceKey: `stock-variant:${variantId}`,
        },
        select: { id: true },
    });

    return transaction.id;
}

export async function createDefaultVariantForNewItem(
    tx: Prisma.TransactionClient,
    item: ItemVariantSeed,
    performedBy: number,
): Promise<{ id: number }> {
    const variant = await tx.stockItemVariant.create({
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

    await createStockOpeningBalanceTransaction(
        tx,
        item.id,
        variant.id,
        item.quantity,
        performedBy,
    );

    return variant;
}
