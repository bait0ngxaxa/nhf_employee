import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { StockRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getStockAnalytics } from "../../application/queries/analytics";
import { createStockFixture } from "./stock-fixtures";
import ExcelJS from "exceljs";
import { createStockRawDataWorkbook } from "../../infrastructure/reports/raw-export";

describe("Stock analytics MySQL aggregation", () => {
    let fixture: Awaited<ReturnType<typeof createStockFixture>>;
    let secondVariantId: number;
    beforeAll(async () => {
        const url = new URL(process.env.DATABASE_URL ?? "invalid:");
        if (url.protocol !== "mysql:" || !/(?:_test|_integration)$/.test(url.pathname)) throw new Error("Dedicated test database required");
        fixture = await createStockFixture(prisma, { suffix: `analytics-${Date.now()}` });
        const variant = await prisma.stockItemVariant.create({ data: { stockItemId: fixture.item.id, sku: `${fixture.item.sku}-2`, unit: "กล่อง", quantity: 0, minStock: 0 } });
        secondVariantId = variant.id;
        await prisma.stockRequest.create({ data: { requestedBy: fixture.requester.id, idempotencyKey: "analytics-issued", requestHash: "0".repeat(64), projectCode: fixture.request.projectCode, status: StockRequestStatus.ISSUED, issuedAt: new Date("2024-01-31T17:00:00Z"), items: { create: [
            { itemId: fixture.item.id, variantId: fixture.variant.id, quantity: 3 },
            { itemId: fixture.item.id, variantId: variant.id, quantity: 2 },
        ] } } });
        for (const [key, status, at] of [
            ["end", StockRequestStatus.ISSUED, "2024-02-29T17:00:00Z"],
            ["cancelled", StockRequestStatus.CANCELLED, "2024-02-10T00:00:00Z"],
            ["legacy", StockRequestStatus.REJECTED_LEGACY, "2024-02-10T00:00:00Z"],
        ] as const) {
            await prisma.stockRequest.create({ data: { requestedBy: fixture.requester.id, idempotencyKey: key, requestHash: "0".repeat(64), projectCode: fixture.request.projectCode, status, issuedAt: new Date(at), items: { create: { itemId: fixture.item.id, variantId: fixture.variant.id, quantity: 99 } } } });
        }
    });
    afterAll(async () => { await prisma.$disconnect(); });

    it("counts distinct material requests, lines, mixed units and exact Bangkok boundaries", async () => {
        const result = await getStockAnalytics({ year: 2024, fromMonth: 2, toMonth: 2, projectCode: fixture.request.projectCode, itemId: fixture.item.id });
        expect(result.kpis.issuedRequests).toBe(1);
        expect(result.kpis.issuedLines).toBe(2);
        expect(result.topMaterials[0].requestCount).toBe(1);
        expect(result.topMaterials[0].quantities).toEqual(expect.arrayContaining([{ unit: "ชิ้น", quantity: 3 }, { unit: "กล่อง", quantity: 2 }]));
        expect(result.categories[0]).toMatchObject({ lines: 2, percentage: 100 });
        expect(result.detail?.rows.find((r) => r.variantId === secondVariantId)?.quantity).toBe(2);
        expect(result.topMaterials[0].available).toContainEqual({ unit: "ชิ้น", quantity: 7 });
        expect(result.topMaterials[0].health.out).toBe(1);
    });
    it("ranks quantities in a selected unit and preserves global snapshots when filters are empty", async () => {
        const quantity = await getStockAnalytics({ year: 2024, fromMonth: 2, toMonth: 2, projectCode: fixture.request.projectCode, metric: "quantity", unit: "กล่อง" });
        expect(quantity.topMaterials[0].id).toBe(fixture.item.id);
        const empty = await getStockAnalytics({ year: 2024, projectCode: "no-such-project" });
        expect(empty.topMaterials).toEqual([]);
        expect(empty.kpis.issuedLines).toBe(0);
        expect(empty.kpis.pendingRequests).toBeGreaterThanOrEqual(1);
        expect(empty.stockHealth).toEqual(quantity.stockHealth);
    });
    it("reconciles raw issued lines and inventory reservations with analytics", async () => {
        const filters = { year: 2024, fromMonth: 2, toMonth: 2, projectCode: fixture.request.projectCode };
        const analytics = await getStockAnalytics(filters);
        const workbook = await createStockRawDataWorkbook(filters, "raw-issued");
        const loaded = new ExcelJS.Workbook();
        await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
        const sheet = loaded.worksheets[0];
        expect(sheet.actualRowCount - 1).toBe(analytics.kpis.issuedLines);
        expect(sheet.getCell("A2").value).toEqual(new Date("2024-02-01T00:00:00Z"));
        expect(sheet.getCell("G2").value).toBe(fixture.item.id);
        expect(sheet.getCell("M2").value).toBe(3);
        expect(sheet.getCell("N2").value).toBe("ชิ้น");
        const inventory = await createStockRawDataWorkbook({}, "raw-inventory");
        const inventorySheet = inventory.worksheets[0];
        const values: ExcelJS.Row[] = [];
        inventorySheet.eachRow((row, index) => { if (index > 1 && row.getCell(2).value === fixture.variant.id) values.push(row); });
        expect(values).toHaveLength(1);
        expect(values[0].getCell(10).value).toBe(3);
        expect(values[0].getCell(11).value).toBe(7);
        expect(inventorySheet.actualRowCount - 1).toBe(Object.values(analytics.stockHealth).reduce((sum, count) => sum + count, 0));
    });
});
