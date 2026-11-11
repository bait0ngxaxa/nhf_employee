import { Prisma } from "@prisma/client";
import { StockVariantSkuConflictError } from "../../domain/errors";
import type { StockTxClient } from "./item-update.types";

/** Query early; reject only at the original create step to preserve validation precedence. */
export async function loadVariantSkuConflicts(
    tx: StockTxClient,
    skus: string[],
): Promise<Set<number>> {
    if (skus.length === 0) return new Set();
    // Match the SKU unique index's migration collation, including case/accent equivalence.
    const requested = Prisma.join(skus.map((sku, ordinal) => Prisma.sql`
        SELECT ${ordinal} AS ordinal,
            CONVERT(${sku} USING utf8mb4) COLLATE utf8mb4_unicode_ci AS sku
    `), " UNION ALL ");
    // Own/removed/renamed and inactive variants remain reserved. Remove+add and
    // swaps are intentionally unsupported; no writes or validation are reordered.
    const conflicts = await tx.$queryRaw<Array<{ ordinal: number | bigint }>>(Prisma.sql`
        WITH requested AS (${requested}), ranked AS (
            SELECT requested.ordinal, existing.id,
                ROW_NUMBER() OVER (PARTITION BY requested.sku ORDER BY requested.ordinal) AS occurrence
            FROM requested
            LEFT JOIN stock_item_variants AS existing ON existing.sku = requested.sku
        )
        SELECT ordinal FROM ranked WHERE id IS NOT NULL OR occurrence > 1
    `);
    return new Set(conflicts.map(({ ordinal }) => Number(ordinal)));
}

export function assertVariantSkuAvailable(conflicts: Set<number>, ordinal: number): void {
    if (conflicts.has(ordinal)) throw new StockVariantSkuConflictError();
}
