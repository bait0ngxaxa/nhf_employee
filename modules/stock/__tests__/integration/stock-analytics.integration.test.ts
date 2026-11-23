import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { type PrismaClient, StockRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getStockAnalytics } from "../../application/queries/analytics";
import ExcelJS from "exceljs";
import { createStockRequestReportXlsxResponse } from "../../infrastructure/reports/report-export";
import { createStockBalanceReportXlsxResponse } from "../../infrastructure/reports/balance-export";
import { createStockFixture } from "./stock-fixtures";

const alertRead = vi.hoisted(() => ({ before: undefined as (() => Promise<void>) | undefined }));

vi.mock("@/lib/db/prisma", async (importOriginal) => {
    const { prisma } = await importOriginal<{ prisma: PrismaClient }>();
    return {
        prisma: prisma.$extends({
            query: {
                stockItemVariant: {
                    async findMany({ args, query }) {
                        const id = args.where?.id;
                        if (alertRead.before && typeof id === "object" && id.in && args.select?.attributeValues) {
                            const commit = alertRead.before;
                            alertRead.before = undefined;
                            await commit();
                        }
                        return query(args);
                    },
                },
            },
        }),
    };
});

describe("Stock analytics MySQL aggregation", () => {
    const fixtureIssuerIds: number[] = [];
    let fixture: Awaited<ReturnType<typeof createStockFixture>>;
    let secondVariantId: number;
    beforeAll(async () => {
        const url = new URL(process.env.DATABASE_URL ?? "invalid:");
        if (url.protocol !== "mysql:" || !/(?:_test|_integration)$/.test(url.pathname)) throw new Error("Dedicated test database required");
        fixture = await createStockFixture(prisma, { suffix: `analytics-${Date.now()}` });
        fixtureIssuerIds.push(fixture.issuer.id);
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
    afterAll(async () => {
        try {
            // Recipient integration tests query configured grants across the shared database.
            await prisma.userCapabilityGrant.deleteMany({ where: { userId: { in: fixtureIssuerIds } } });
        } finally {
            await prisma.$disconnect();
        }
    });

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

    it("reads alert labels, reservations, stock health and issued counts from one snapshot during a writer commit", async () => {
        const state = await createStockFixture(prisma, { suffix: "analytics-snapshot", quantity: 5, minStock: 2 });
        fixtureIssuerIds.push(state.issuer.id);
        const input = { year: 2024, projectCode: state.request.projectCode };
        const label = await prisma.stockAttribute.create({ data: { name: "สี" } });
        const value = await prisma.stockAttributeValue.create({ data: { attributeId: label.id, value: "เขียว" } });
        const size = await prisma.stockAttribute.create({ data: { name: "ขนาด", values: { create: { value: "ใหญ่" } } }, include: { values: true } });
        await prisma.stockVariantAttributeValue.createMany({ data: [value, ...size.values].map(({ id }) => ({
            variantId: state.variant.id, attributeValueId: id,
        })) });
        const variant = await prisma.stockItemVariant.create({ data: {
            stockItemId: state.item.id, sku: state.variant.sku + "-inactive", unit: "กล่อง", quantity: 1, isActive: false,
        } });
        const toDeactivate = await prisma.stockItemVariant.create({ data: {
            stockItemId: state.item.id, sku: state.variant.sku + "-active", unit: "กล่อง", quantity: 1,
        } });
        const toCancel = await prisma.stockRequest.create({ data: {
            requestedBy: state.requester.id, idempotencyKey: "cancel-during-analytics", requestHash: "0".repeat(64),
            projectCode: state.request.projectCode, status: StockRequestStatus.PENDING_ISSUE,
            items: { create: { itemId: state.item.id, variantId: state.variant.id, quantity: 1 } },
        } });
        const original = await getStockAnalytics(input);
        expect(original.lowStock).toContainEqual(expect.objectContaining({
            id: state.variant.id, attributes: "ขนาด: ใหญ่, สี: เขียว", quantity: 5, minimum: 2, reserved: 4, available: 1, status: "low",
        }));
        expect(original.kpis.issuedRequests).toBe(0);
        const commit = vi.fn(async () => {
            await prisma.$transaction(async (tx) => {
                await tx.stockItem.update({ where: { id: state.item.id }, data: { name: "วัสดุหลังแก้ไข", quantity: 2, minStock: 5 } });
                await tx.stockAttributeValue.update({ where: { id: value.id }, data: { value: "น้ำเงิน" } });
                await tx.stockItemVariant.update({ where: { id: state.variant.id }, data: { quantity: 2, minStock: 5 } });
                await tx.stockItemVariant.update({ where: { id: variant.id }, data: { isActive: true, quantity: 0 } });
                await tx.stockItemVariant.update({ where: { id: toDeactivate.id }, data: { isActive: false } });
                await tx.stockRequest.update({ where: { id: state.request.id }, data: {
                    status: StockRequestStatus.ISSUED, issuedAt: new Date("2024-02-09T00:00:00Z"),
                } });
                await tx.stockRequest.update({ where: { id: toCancel.id }, data: { status: StockRequestStatus.CANCELLED } });
                await tx.stockRequest.create({ data: {
                    requestedBy: state.requester.id, idempotencyKey: "reserve-during-analytics", requestHash: "0".repeat(64),
                    projectCode: state.request.projectCode,
                    items: { create: { itemId: state.item.id, variantId: state.variant.id, quantity: 3 } },
                } });
            });
        });
        alertRead.before = commit;
        try {
            const during = await getStockAnalytics(input);
            expect(commit).toHaveBeenCalledTimes(1);
            expect(during).toStrictEqual({ ...original, freshness: { ...original.freshness, generatedAt: during.freshness.generatedAt } });
        } finally {
            alertRead.before = undefined;
        }
        const after = await getStockAnalytics(input);
        expect(after.kpis.issuedRequests).toBe(1);
        expect(after.kpis.pendingRequests).toBe(original.kpis.pendingRequests - 1);
        expect(after.stockHealth).toEqual({
            healthy: original.stockHealth.healthy - 1, low: original.stockHealth.low - 1, out: original.stockHealth.out + 2,
        });
        expect(after.lowStock).toContainEqual(expect.objectContaining({
            id: state.variant.id, name: "วัสดุหลังแก้ไข", attributes: "ขนาด: ใหญ่, สี: น้ำเงิน", quantity: 2, minimum: 5,
            reserved: 3, available: 0, status: "out",
        }));
        expect(after.lowStock).toContainEqual(expect.objectContaining({ id: variant.id, status: "out" }));
    });

    it("ranks late out-of-stock variants before earlier low alerts across batches", async () => {
        const input = { year: 2024, projectCode: "no-such-project" };
        const before = await getStockAnalytics(input);
        const rows = Array.from({ length: 550 }, (_, index) => ({
            stockItemId: fixture.item.id,
            sku: `${fixture.item.sku}-analytics-rank-${index}`,
            unit: "ชิ้น",
            quantity: index < 25 ? 1 : index >= 525 ? 0 : 5,
            minStock: 1,
        }));
        await prisma.stockItemVariant.createMany({ data: rows });
        const out = await prisma.stockItemVariant.findMany({
            where: { stockItemId: fixture.item.id, sku: { startsWith: fixture.item.sku + "-analytics-rank-" }, quantity: 0 },
            select: { id: true }, orderBy: { id: "asc" },
        });
        const current = await getStockAnalytics(input);
        expect(current.stockHealth).toEqual({
            healthy: before.stockHealth.healthy + 500, low: before.stockHealth.low + 25, out: before.stockHealth.out + 25,
        });
        const expected = [...before.lowStock.filter(({ status }) => status === "out"), ...out].slice(0, 20);
        expect(current.lowStock.map(({ id }) => id)).toEqual(expected.map(({ id }) => id));
        expect(current.lowStock.filter(({ id }) => out.some((variant) => variant.id === id)))
            .toEqual(expect.arrayContaining([expect.objectContaining({ attributes: "" })]));
    });

    it("rejects a pending request item with no variant even when history is filtered out", async () => {
        const invalid = await prisma.stockRequest.create({ data: {
            requestedBy: fixture.requester.id, idempotencyKey: "missing-variant", requestHash: "0".repeat(64),
            projectCode: fixture.request.projectCode,
            items: { create: { itemId: fixture.item.id, variantId: null, quantity: 1 } },
        } });
        try {
            await expect(getStockAnalytics({ year: 2024, projectCode: "no-such-project" }))
                .rejects.toThrow("พบคำขอรอจ่ายที่ไม่มี variant snapshot");
        } finally {
            await prisma.stockRequestItem.deleteMany({ where: { requestId: invalid.id } });
            await prisma.stockRequest.delete({ where: { id: invalid.id } });
        }
    });
});
