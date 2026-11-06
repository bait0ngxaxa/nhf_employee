import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { styleWorksheet } from "@/lib/server/xlsx-style";

describe("worksheet style", () => {
    it("preserves widths, values and domain formats and supports options", async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Test");
        sheet.columns = [{ header: "Text", width: 28 }, { header: "Number", width: 12 }];
        sheet.addRow(["=1+1", 0.5]);
        sheet.getCell("B2").numFmt = "0.#";
        styleWorksheet(sheet, { freezeColumns: 1, wrapText: false, autoFilter: false });
        const loaded = new ExcelJS.Workbook();
        await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
        const result = loaded.worksheets[0];
        expect(result.autoFilter).toBeUndefined();
        expect(result.views[0]).toMatchObject({ state: "frozen", xSplit: 1, ySplit: 1 });
        expect(result.getColumn(1).width).toBe(28);
        expect(result.getCell("A2").value).toBe("=1+1");
        expect(result.getCell("B2").value).toBe(0.5);
        expect(result.getCell("B2").numFmt).toBe("0.#");
        expect(result.getCell("A1").alignment.wrapText).toBeFalsy();
        for (const edge of ["top", "bottom", "left", "right"] as const) {
            expect(result.getCell("A1").border[edge]).toMatchObject({ style: "thin", color: { argb: "FF64748B" } });
        }
    });
});
