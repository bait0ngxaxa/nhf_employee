import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { createStockRequestReportWorkbook } from "./report-workbook";
import { createStockBalanceReportWorkbook } from "./balance-workbook";

describe("stock literal workbook text", () => {
    it.each(["=1+1", "+SUM(A1:A2)", "-1+2", "@SUM(A1:A2)", "https://example.com", "ภาษาไทย\nบรรทัดใหม่"])("preserves %s as strings", async (text) => {
        const item = { id: 1, name: text, unit: "ชิ้น", category: { name: text } };
        const requests = createStockRequestReportWorkbook([{
            id: 1, createdAt: new Date("2031-01-01T00:00:00Z"), issuedAt: new Date("2031-01-01T00:00:00Z"),
            projectCode: text, requester: { name: text, email: text, employee: null }, issuer: null,
            items: [{ quantity: 2, item, variant: null }],
        }]);
        const balance = createStockBalanceReportWorkbook([{
            ...item, description: text, quantity: 5, minStock: 1, reservedQuantity: 2, availableQuantity: 3, variants: [],
        }]);
        for (const workbook of [requests, balance]) {
            const loaded = new ExcelJS.Workbook();
            await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
            const sheet = loaded.worksheets[0];
            expect(sheet.getCell("A2").value).toBe(text);
            expect(sheet.getCell("A2").type).toBe(ExcelJS.ValueType.String);
            expect(sheet.getCell("B2").value).toBe(text);
            expect(sheet.getCell("B2").type).toBe(ExcelJS.ValueType.String);
        }
        const loaded = new ExcelJS.Workbook();
        await loaded.xlsx.load(await requests.xlsx.writeBuffer());
        expect(loaded.worksheets[1].getCell("D2").value).toBe(text);
        expect(loaded.worksheets[1].getCell("D2").type).toBe(ExcelJS.ValueType.String);
        expect(loaded.worksheets[1].getCell("B2").value).toEqual(new Date("2031-01-01T07:00:00Z"));
        expect(loaded.worksheets[1].getCell("B2").numFmt).toBe("dd/mm/yyyy hh:mm");
    });
});
