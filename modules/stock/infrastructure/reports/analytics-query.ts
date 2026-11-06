import { Prisma, StockRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { stockReportingPeriod, type StockAnalyticsQuery } from "../../schemas/analytics";
import { classifyStockHealth, type AnalyticsMaterial, type AnalyticsVariant, type StockAnalyticsResponse } from "../../domain/analytics";
import { StockInvariantViolationError } from "../../domain/errors";
import { getAvailableQuantity } from "../persistence/shared";

type Count = number | bigint | Prisma.Decimal;
const number = (value: Count): number => Number(value);
const joins = Prisma.sql`FROM stock_request_items ri
    JOIN stock_requests r ON r.id = ri.requestId
    JOIN stock_items i ON i.id = ri.itemId
    JOIN stock_categories c ON c.id = i.categoryId
    LEFT JOIN stock_item_variants v ON v.id = ri.variantId`;

/** Prisma enum/date mappings are physical APPROVED / reviewedAt in MySQL. */
function issuedWhere(query: StockAnalyticsQuery): Prisma.Sql {
    const { start, end } = stockReportingPeriod(query);
    return Prisma.sql`r.status = 'APPROVED' AND r.reviewedAt >= ${start} AND r.reviewedAt < ${end}
        ${query.categoryId === undefined ? Prisma.empty : Prisma.sql`AND i.categoryId = ${query.categoryId}`}
        ${query.projectCode === undefined ? Prisma.empty : Prisma.sql`AND r.projectCode = ${query.projectCode}`}`;
}

export async function readStockAnalytics(query: StockAnalyticsQuery): Promise<StockAnalyticsResponse> {
    return prisma.$transaction(async (tx) => {
        const where = issuedWhere(query);
        const totals = await tx.$queryRaw<{ requests: Count; lineCount: Count }[]>(Prisma.sql`
            SELECT COUNT(DISTINCT r.id) AS requests, COUNT(ri.id) AS lineCount ${joins} WHERE ${where}`);
        // Binary unit comparison prevents collation from combining differently persisted units.
        const unitFilter = query.metric === "quantity" ? Prisma.sql`AND BINARY COALESCE(v.unit, i.unit) = BINARY ${query.unit}` : Prisma.empty;
        const ranking = query.metric === "quantity" ? Prisma.sql`SUM(ri.quantity)` : Prisma.sql`COUNT(DISTINCT r.id)`;
        const top = await tx.$queryRaw<{ id: number; name: string; sku: string; category: string; requests: Count; lineCount: Count }[]>(Prisma.sql`
            SELECT i.id, i.name, i.sku, c.name AS category, COUNT(DISTINCT r.id) AS requests, COUNT(ri.id) AS lineCount
            ${joins} WHERE ${where} ${unitFilter}
            GROUP BY i.id, i.name, i.sku, c.name ORDER BY ${ranking} DESC, i.id ASC LIMIT 10`);
        const ids = top.map((row) => row.id);
        // Unit filters choose the ranking, not the material's all-unit request frequency.
        const counts = query.metric === "quantity" && ids.length
            ? await tx.$queryRaw<{ id: number; requests: Count; lineCount: Count }[]>(Prisma.sql`
                SELECT i.id, COUNT(DISTINCT r.id) AS requests, COUNT(ri.id) AS lineCount ${joins}
                WHERE ${where} AND i.id IN (${Prisma.join(ids)}) GROUP BY i.id`)
            : top;
        const countsById = new Map(counts.map((row) => [row.id, row]));
        const quantities = ids.length ? await tx.$queryRaw<{ id: number; unit: string; quantity: Count }[]>(Prisma.sql`
            SELECT i.id, COALESCE(v.unit, i.unit) AS unit, SUM(ri.quantity) AS quantity ${joins}
            WHERE ${where} AND i.id IN (${Prisma.join(ids)})
            GROUP BY i.id, BINARY COALESCE(v.unit, i.unit), COALESCE(v.unit, i.unit)
            ORDER BY i.id, BINARY COALESCE(v.unit, i.unit)`) : [];
        const materials: AnalyticsMaterial[] = top.map((row) => ({
            id: row.id, name: row.name, sku: row.sku, category: row.category,
            requestCount: number(countsById.get(row.id)?.requests ?? 0), lineCount: number(countsById.get(row.id)?.lineCount ?? 0),
            quantities: quantities.filter((q) => q.id === row.id).map((q) => ({ unit: q.unit, quantity: number(q.quantity) })),
            available: [], health: { healthy: 0, low: 0, out: 0 },
        }));
        const distribution = await tx.$queryRaw<{ id: number; name: string; lineCount: Count }[]>(Prisma.sql`
            SELECT c.id, c.name, COUNT(ri.id) AS lineCount ${joins} WHERE ${where}
            GROUP BY c.id, c.name ORDER BY COUNT(ri.id) DESC, c.id ASC`);
        const units = await tx.$queryRaw<{ unit: string }[]>(Prisma.sql`
            SELECT COALESCE(v.unit, i.unit) AS unit ${joins} WHERE ${where}
            GROUP BY BINARY COALESCE(v.unit, i.unit), COALESCE(v.unit, i.unit) ORDER BY unit`);
        const unitOptions = units.map((row) => String(row.unit));
        const snapshot = await readInventorySnapshot(tx, materials);
        const pendingRequests = await tx.stockRequest.count({ where: { status: StockRequestStatus.PENDING_ISSUE } });
        const categories = await tx.stockCategory.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
        const detail = query.itemId === undefined ? null : await readDetail(tx, query, where);
        const { start, end } = stockReportingPeriod(query);
        const issuedLines = number(totals[0]?.lineCount ?? 0);
        return {
            filters: { year: query.year, fromMonth: query.fromMonth, toMonth: query.toMonth, categoryId: query.categoryId, projectCode: query.projectCode, metric: query.metric, unit: query.unit },
            period: { start: start.toISOString(), end: end.toISOString(), timezone: "Asia/Bangkok" },
            kpis: { issuedRequests: number(totals[0]?.requests ?? 0), issuedLines, pendingRequests, attentionVariants: snapshot.health.low + snapshot.health.out },
            topMaterials: materials,
            categories: distribution.map((row) => ({ id: row.id, name: row.name, lines: number(row.lineCount), percentage: issuedLines ? number(row.lineCount) / issuedLines * 100 : 0 })),
            stockHealth: snapshot.health, lowStock: snapshot.alerts, lowStockTotal: snapshot.health.low + snapshot.health.out,
            options: { categories, units: unitOptions }, detail,
            freshness: { generatedAt: new Date().toISOString(), snapshotScope: "current-all-active-variants" },
        };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
}

/** Scan bounded batches; reservations are aggregated by the database, never historical rows in memory. */
async function readInventorySnapshot(tx: Prisma.TransactionClient, materials: AnalyticsMaterial[]): Promise<{ health: StockAnalyticsResponse["stockHealth"]; alerts: AnalyticsVariant[] }> {
    const invalid = await tx.stockRequestItem.findFirst({ where: { variantId: null, request: { status: StockRequestStatus.PENDING_ISSUE } }, select: { id: true } });
    if (invalid) throw new StockInvariantViolationError("พบคำขอรอจ่ายที่ไม่มี variant snapshot");
    const health = { healthy: 0, low: 0, out: 0 };
    const alerts: AnalyticsVariant[] = [];
    const materialById = new Map(materials.map((m) => [m.id, m]));
    let cursor = 0;
    for (;;) {
        const variants = await tx.stockItemVariant.findMany({
            where: { id: { gt: cursor }, isActive: true, stockItem: { isActive: true } },
            take: 500, orderBy: { id: "asc" },
            select: { id: true, stockItemId: true, sku: true, unit: true, quantity: true, minStock: true,
                stockItem: { select: { name: true } },
                attributeValues: { select: { attributeValue: { select: { value: true, attribute: { select: { name: true } } } } } } },
        });
        if (!variants.length) break;
        const reservations = await tx.stockRequestItem.groupBy({ by: ["variantId"], where: { variantId: { in: variants.map((v) => v.id) }, request: { status: StockRequestStatus.PENDING_ISSUE } }, _sum: { quantity: true } });
        const reserved = new Map(reservations.map((r) => [r.variantId, r._sum.quantity ?? 0]));
        for (const v of variants) {
            const available = getAvailableQuantity(v.quantity, reserved.get(v.id) ?? 0);
            const status = classifyStockHealth(available, v.minStock);
            health[status]++;
            const material = materialById.get(v.stockItemId);
            if (material) {
                material.health[status]++;
                const existing = material.available.find((q) => q.unit === v.unit);
                if (existing) existing.quantity += available;
                else material.available.push({ unit: v.unit, quantity: available });
            }
            if (status !== "healthy") {
                alerts.push({ id: v.id, itemId: v.stockItemId, name: v.stockItem.name, sku: v.sku,
                    attributes: v.attributeValues.map((a) => `${a.attributeValue.attribute.name}: ${a.attributeValue.value}`).sort().join(", "),
                    unit: v.unit, quantity: v.quantity, reserved: reserved.get(v.id) ?? 0, available, minimum: v.minStock, status });
                alerts.sort((a, b) => Number(b.status === "out") - Number(a.status === "out") || a.id - b.id);
                if (alerts.length > 20) alerts.pop();
            }
        }
        cursor = variants[variants.length - 1].id;
    }
    return { health, alerts };
}

async function readDetail(tx: Prisma.TransactionClient, query: StockAnalyticsQuery, where: Prisma.Sql): Promise<NonNullable<StockAnalyticsResponse["detail"]>> {
    const rows = await tx.$queryRaw<{ variantId: number | null; sku: string; unit: string; requests: Count; quantity: Count }[]>(Prisma.sql`
        SELECT ri.variantId, COALESCE(v.sku, i.sku) AS sku, COALESCE(v.unit, i.unit) AS unit,
            COUNT(DISTINCT r.id) AS requests, SUM(ri.quantity) AS quantity ${joins}
        WHERE ${where} AND i.id = ${query.itemId}
        GROUP BY ri.variantId, COALESCE(v.sku, i.sku), BINARY COALESCE(v.unit, i.unit), COALESCE(v.unit, i.unit)
        ORDER BY COUNT(DISTINCT r.id) DESC, ri.variantId ASC LIMIT 51 OFFSET ${(query.page - 1) * 50}`);
    const variants = await tx.stockItemVariant.findMany({ where: { id: { in: rows.flatMap((r) => r.variantId === null ? [] : [r.variantId]) } }, select: { id: true, attributeValues: { select: { attributeValue: { select: { value: true, attribute: { select: { name: true } } } } } } } });
    const labels = new Map(variants.map((v) => [v.id, v.attributeValues.map((a) => `${a.attributeValue.attribute.name}: ${a.attributeValue.value}`).sort().join(", ")]));
    return { rows: rows.slice(0, 50).map((r) => ({ ...r, attributes: r.variantId === null ? "รายการเดิมไม่มี variant" : labels.get(r.variantId) ?? "", requests: number(r.requests), quantity: number(r.quantity) })), page: query.page, hasMore: rows.length > 50 };
}
