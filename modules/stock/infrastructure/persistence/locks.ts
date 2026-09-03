import { Prisma } from "@prisma/client";

import type { StockTxClient } from "./item-update.types";

function sortedUniqueIds(ids: readonly number[]): number[] {
    return [...new Set(ids)].sort((left, right) => left - right);
}

/**
 * Lock stock inventory in the module-wide order: parent items, then variants.
 * Every table is locked by ascending id so concurrent stock commands cannot
 * acquire the same inventory rows in opposite orders.
 */
export async function lockStockInventoryRows(
    tx: StockTxClient,
    itemIds: readonly number[],
): Promise<void> {
    const sortedItemIds = sortedUniqueIds(itemIds);
    if (sortedItemIds.length === 0) return;

    await tx.$queryRaw`
        SELECT id
        FROM stock_items
        WHERE id IN (${Prisma.join(sortedItemIds)})
        ORDER BY id
        FOR UPDATE
    `;

    await tx.$queryRaw`
        SELECT id
        FROM stock_item_variants
        WHERE \`stockItemId\` IN (${Prisma.join(sortedItemIds)})
        ORDER BY id
        FOR UPDATE
    `;
}
