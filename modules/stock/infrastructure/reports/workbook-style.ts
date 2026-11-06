import type ExcelJS from "exceljs";
import { styleWorksheet } from "@/lib/server/xlsx-style";

const TOTAL_FILL = "FFE0F2FE";
const NUMBER_FORMAT = "0";
const DATE_TIME_FORMAT = "dd/mm/yyyy hh:mm";

export function finishStockWorksheet(
    sheet: ExcelJS.Worksheet,
    freezeColumnCount: number,
    dateTimeKeys: ReadonlySet<string> = new Set(),
): void {
    styleWorksheet(sheet, { freezeColumns: freezeColumnCount });
    applyColumnFormats(sheet, dateTimeKeys);
}

export function styleTotalRow(sheet: ExcelJS.Worksheet): void {
    const row = sheet.getRow(sheet.rowCount);
    row.font = { name: "Arial", bold: true };
    row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: TOTAL_FILL },
    };
}

function applyColumnFormats(
    sheet: ExcelJS.Worksheet,
    dateTimeKeys: ReadonlySet<string>,
): void {
    sheet.columns.forEach((column) => {
        const key = String(column.key ?? "");
        if (dateTimeKeys.has(key)) {
            column.numFmt = DATE_TIME_FORMAT;
            return;
        }

        if (column.values?.some((value) => typeof value === "number")) {
            column.numFmt = NUMBER_FORMAT;
        }
    });
}
