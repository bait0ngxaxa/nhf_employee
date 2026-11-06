import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { StockRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getStockAnalytics } from "../../application/queries/analytics";
import ExcelJS from "exceljs";
import { createStockRequestReportXlsxResponse } from "../../infrastructure/reports/report-export";
import { createStockBalanceReportXlsxResponse } from "../../infrastructure/reports/balance-export";
import { createStockFixture } from "./stock-fixtures";

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
    it("reconciles the original annual and balance Excel contracts with analytics", async () => {
        const analytics = await getStockAnalytics({ year: 2024, projectCode: fixture.request.projectCode });
        const annualResponse = await createStockRequestReportXlsxResponse(2024);
        const annual = new ExcelJS.Workbook();
        await annual.xlsx.load(await annualResponse.arrayBuffer());
        expect(annual.worksheets.map((sheet) => sheet.name)).toEqual(["สรุปการใช้วัสดุ", "รายละเอียดที่ใช้คำนวณ"]);
        const requestRows: ExcelJS.Row[] = [];
        annual.worksheets[1].eachRow((row, index) => { if (index > 1 && row.getCell(4).value === fixture.request.projectCode) requestRows.push(row); });
        expect(requestRows).toHaveLength(analytics.kpis.issuedRequests);
        expect(requestRows.reduce((total, row) => total + Number(row.getCell(9).value), 0)).toBe(analytics.kpis.issuedLines);
        const summary: { unit: string; quantity: number }[] = [];
        annual.worksheets[0].eachRow((row, index) => { if (index > 1 && row.getCell(2).value === fixture.item.name) summary.push({ unit: String(row.getCell(4).value), quantity: Number(row.getCell(6).value) }); });
        expect(summary).toEqual(expect.arrayContaining(analytics.topMaterials[0].quantities));
        const balanceResponse = await createStockBalanceReportXlsxResponse();
        const balance = new ExcelJS.Workbook();
        await balance.xlsx.load(await balanceResponse.arrayBuffer());
        expect(balance.worksheets.map((sheet) => sheet.name)).toEqual(["ยอดคงเหลือจริง"]);
        const variantRows: ExcelJS.Row[] = [];
        balance.worksheets[0].eachRow((row, index) => { if (index > 1 && row.getCell(2).value === fixture.item.name) variantRows.push(row); });
        expect(variantRows).toHaveLength(2);
        const pieces = variantRows.find((row) => row.getCell(4).value === "ชิ้น");
        expect([5, 6, 7, 8].map((col) => pieces?.getCell(col).value)).toEqual([10, 3, 7, 2]);
        expect(analytics.topMaterials[0].available).toContainEqual({ unit: "ชิ้น", quantity: Number(pieces?.getCell(7).value) });
    });
    it("keeps canonical identities, category line shares and all-unit frequency under quantity ranking", async () => {
        const category = await prisma.stockCategory.create({ data: { name: `Analytics alternate ${fixture.item.id}` } });
        const item = await prisma.stockItem.create({ data: { name: fixture.item.name, sku: `${fixture.item.sku}-duplicate-name`, unit: "กล่อง", categoryId: category.id, isActive: false } });
        const variant = await prisma.stockItemVariant.create({ data: { stockItemId: item.id, sku: `${item.sku}-v`, unit: "กล่อง", isActive: false } });
        const project = `${fixture.request.projectCode}-TIE`;
        for (const [key, lines] of [["a", [
            { itemId: fixture.item.id, variantId: fixture.variant.id, quantity: 1 },
            { itemId: fixture.item.id, variantId: secondVariantId, quantity: 2 },
            { itemId: item.id, variantId: variant.id, quantity: 2 },
        ]], ["b", [{ itemId: fixture.item.id, variantId: fixture.variant.id, quantity: 1 }]]] as const) {
            await prisma.stockRequest.create({ data: { requestedBy: fixture.requester.id, idempotencyKey: `tie-${key}`, requestHash: "0".repeat(64), projectCode: project, status: StockRequestStatus.ISSUED, issuedAt: new Date("2024-02-10T00:00:00Z"), items: { create: [...lines] } } });
        }
        const result = await getStockAnalytics({ year: 2024, projectCode: project, metric: "quantity", unit: "กล่อง" });
        expect(result.topMaterials.map((m) => m.id)).toEqual([fixture.item.id, item.id]);
        expect(result.topMaterials[0]).toMatchObject({ requestCount: 2, lineCount: 3 });
        expect(result.topMaterials[1].health).toEqual({ healthy: 0, low: 0, out: 0 });
        expect(result.categories.map((c) => c.percentage)).toEqual([75, 25]);
        const filtered = await getStockAnalytics({ year: 2024, projectCode: project, categoryId: category.id });
        expect(filtered.kpis.issuedRequests).toBe(1);
        expect(filtered.kpis.issuedLines).toBe(1);
        expect(filtered.stockHealth).toEqual(result.stockHealth);
    });
});
