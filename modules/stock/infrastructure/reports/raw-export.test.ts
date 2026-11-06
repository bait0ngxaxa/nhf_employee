import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStockRawDataWorkbook, StockRawExportLimitError } from "./raw-export";
import { getStockBalanceReportMeta } from "./balance-export";

const tx = vi.hoisted(() => ({
    stockRequestItem: { findMany: vi.fn(), findFirst: vi.fn(), groupBy: vi.fn() },
    stockItemVariant: { findMany: vi.fn(), count: vi.fn() },
    stockItem: { count: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { ...tx, $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) } }));

describe("raw export row protections", () => {
    beforeEach(() => { vi.clearAllMocks(); tx.stockRequestItem.findFirst.mockResolvedValue(null); });
    it.each(["raw-issued", "raw-inventory"] as const)("bounds %s by expanded output rows", async (mode) => {
        tx.stockRequestItem.findMany.mockResolvedValue(Array.from({ length: 5001 }, () => ({})));
        tx.stockItemVariant.findMany.mockResolvedValue(Array.from({ length: 5001 }, () => ({})));
        await expect(createStockRawDataWorkbook({ year: 2026 }, mode)).rejects.toBeInstanceOf(StockRawExportLimitError);
        const loader = mode === "raw-issued" ? tx.stockRequestItem.findMany : tx.stockItemVariant.findMany;
        expect(loader).toHaveBeenCalledWith(expect.objectContaining({ take: 5001 }));
    });
    it("counts expanded active variants plus legacy fallback rows for balance metadata", async () => {
        tx.stockItemVariant.count.mockResolvedValue(5000);
        tx.stockItem.count.mockResolvedValue(2);
        expect(await getStockBalanceReportMeta()).toEqual({ count: 5002, maxRows: 5000 });
        expect(tx.stockItem.count).toHaveBeenCalledWith({ where: { isActive: true, variants: { none: { isActive: true } } } });
    });
    it("preserves formula-like Thai source text as literal raw workbook cells", async () => {
        tx.stockRequestItem.findMany.mockResolvedValue([{ id: 1, itemId: 2, variantId: null, quantity: 3,
            item: { name: "=วัสดุ", sku: "SKU", unit: "ชิ้น", category: { name: "หมวด" } }, variant: null,
            request: { id: 4, issuedAt: new Date("2026-01-01T00:00:00Z"), projectCode: "+โครงการ", requester: { name: "ผู้ขอ", employee: null }, issuer: null },
        }]);
        const workbook = await createStockRawDataWorkbook({}, "raw-issued");
        expect(workbook.worksheets[0].getCell("H2").value).toBe("=วัสดุ");
        expect(workbook.worksheets[0].getCell("C2").value).toBe("+โครงการ");
        expect(workbook.worksheets[0].getCell("A2").numFmt).toBe("dd/mm/yyyy hh:mm");
    });
});
