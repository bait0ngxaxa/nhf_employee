import { Prisma } from "@prisma/client";
import type { getStockAnalytics } from "@/modules/stock";

type StockHealth = keyof Awaited<ReturnType<typeof getStockAnalytics>>["stockHealth"];

interface InventoryRow {
    id: number;
    stockItemId: number;
    sku: string;
    unit: string;
    quantity: number;
    minStock: number;
}

export async function readOrderedVariants(tx: Prisma.TransactionClient, cursor: number): Promise<InventoryRow[]> {
    return tx.$queryRaw<InventoryRow[]>`
        SELECT v.id, v.stockItemId, v.sku, v.unit, v.quantity, v.minStock
        FROM stock_item_variants v STRAIGHT_JOIN stock_items i ON i.id = v.stockItemId AND i.isActive = TRUE
        WHERE v.id > ${cursor} AND v.isActive = TRUE
        ORDER BY v.id LIMIT 500`;
}

/** Lower bound for a SQL-only snapshot: counts alone, without the alerts and materials. */
export const healthQuery = Prisma.sql`
        WITH reservations AS (
            SELECT ri.variantId, SUM(ri.quantity) AS reserved
            FROM stock_requests r JOIN stock_request_items ri ON ri.requestId = r.id
            WHERE r.status = 'PENDING' AND ri.variantId IS NOT NULL
            GROUP BY ri.variantId
        ), inventory AS (
            SELECT GREATEST(0, v.quantity - COALESCE(r.reserved, 0)) AS available, v.minStock
            FROM stock_item_variants v JOIN stock_items i ON i.id = v.stockItemId
            LEFT JOIN reservations r ON r.variantId = v.id
            WHERE v.isActive = TRUE AND i.isActive = TRUE
        )
        SELECT COALESCE(SUM(available > 0 AND (minStock <= 0 OR available > minStock)), 0) AS healthy,
               COALESCE(SUM(available > 0 AND minStock > 0 AND available <= minStock), 0) AS low,
               COALESCE(SUM(available <= 0), 0) AS \`out\`
        FROM inventory`;

export async function readHealthInSql(tx: Prisma.TransactionClient): Promise<Record<StockHealth, number>> {
    const [row] = await tx.$queryRaw<Record<StockHealth, Prisma.Decimal>[]>(healthQuery);
    return { healthy: Number(row.healthy), low: Number(row.low), out: Number(row.out) };
}
