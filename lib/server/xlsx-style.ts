import type ExcelJS from "exceljs";

interface WorksheetStyleOptions {
    freezeColumns?: number;
    autoFilter?: boolean;
    wrapText?: boolean;
}

/** Server workbook presentation only; values and domain formats remain with each builder. */
export function styleWorksheet(
    sheet: ExcelJS.Worksheet,
    { freezeColumns = 0, autoFilter = true, wrapText = true }: WorksheetStyleOptions = {},
): void {
    sheet.views = [{ state: "frozen", xSplit: freezeColumns, ySplit: 1 }];
    sheet.autoFilter = autoFilter ? {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columnCount },
    } : undefined;
    sheet.eachRow((row) => {
        row.font = { ...row.font, name: "Arial", size: 11 };
        row.alignment = { ...row.alignment, vertical: "middle", wrapText };
    });
    const header = sheet.getRow(1);
    header.height = 30;
    header.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    header.alignment = { vertical: "middle", horizontal: "center", wrapText };
    header.eachCell((cell) => {
        const border: ExcelJS.Border = { style: "thin", color: { argb: "FF64748B" } };
        cell.border = { top: border, bottom: border, left: border, right: border };
    });
}
