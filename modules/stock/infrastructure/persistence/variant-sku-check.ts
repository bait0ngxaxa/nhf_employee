import { Prisma } from "@prisma/client";
import { StockVariantSkuConflictError } from "../../domain/errors";
import type { StockTxClient } from "./item-update.types";

/** Query early; reject only at the original create step to preserve validation precedence. */
export async function loadVariantSkuConflicts(
    tx: StockTxClient,
    skus: string[],
    submittedVariantIds: ReadonlyArray<number | undefined> = [],
): Promise<Set<number>> {
    if (skus.length === 0) return new Set();
    // Match the SKU unique index's migration collation, including case/accent equivalence.
    const requested = Prisma.join(skus.map((sku, ordinal) => Prisma.sql`
        SELECT ${ordinal} AS ordinal,
            CONVERT(${sku} USING utf8mb4) COLLATE utf8mb4_unicode_ci AS sku
    `), " UNION ALL ");
    // Removals run after creates, so removed/inactive/other-item holders still count.
    // An earlier successful update may free its old SKU; SQL supplies collation-aware
    // matches and TypeScript accounts for submitted order without reordering writes.
    const conflicts = await tx.$queryRaw<Array<{
        ordinal: number | bigint;
        existingId: number | null;
        occurrence: number | bigint;
    }>>(Prisma.sql`
        WITH requested AS (${requested}), ranked AS (
            SELECT requested.ordinal, existing.id,
                ROW_NUMBER() OVER (PARTITION BY requested.sku ORDER BY requested.ordinal) AS occurrence
            FROM requested
            LEFT JOIN stock_item_variants AS existing ON existing.sku = requested.sku
        )
        SELECT ordinal, id AS existingId, occurrence FROM ranked WHERE id IS NOT NULL OR occurrence > 1
    `);
    const matchesByOrdinal = new Map<number, typeof conflicts>();
    const holderMatches = new Set<string>();
    for (const conflict of conflicts) {
        const ordinal = Number(conflict.ordinal);
        const matches = matchesByOrdinal.get(ordinal) ?? [];
        matches.push(conflict);
        matchesByOrdinal.set(ordinal, matches);
        if (typeof conflict.existingId === "number") {
            holderMatches.add(`${conflict.existingId}:${ordinal}`);
        }
    }

    const blockedOrdinals = new Set<number>();
    const priorUpdateById = new Map<number, number>();
    for (let ordinal = 0; ordinal < skus.length; ordinal += 1) {
        for (const match of matchesByOrdinal.get(ordinal) ?? []) {
            // An earlier planned identical SKU remains a conflict independently of holders.
            if (Number(match.occurrence) > 1 || typeof match.existingId !== "number") {
                blockedOrdinals.add(ordinal);
                continue;
            }
            const priorUpdate = priorUpdateById.get(match.existingId);
            if (priorUpdate === undefined || holderMatches.has(`${match.existingId}:${priorUpdate}`)) {
                blockedOrdinals.add(ordinal);
            }
        }
        const variantId = submittedVariantIds[ordinal];
        if (variantId !== undefined) priorUpdateById.set(variantId, ordinal);
    }
    return blockedOrdinals;
}

export function assertVariantSkuAvailable(conflicts: Set<number>, ordinal: number): void {
    if (conflicts.has(ordinal)) throw new StockVariantSkuConflictError();
}
