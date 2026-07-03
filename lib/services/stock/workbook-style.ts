import type ExcelJS from "exceljs";

const HEADER_FILL = "FF1F2937";
const TOTAL_FILL = "FFE0F2FE";
const NUMBER_FORMAT = "0";
const DATE_TIME_FORMAT = "dd/mm/yyyy hh:mm";

export function finishStockWorksheet(
    sheet: ExcelJS.Worksheet,
    freezeColumnCount: number,
    dateTimeKeys: ReadonlySet<string> = new Set(),
): void {
    sheet.views = [{ state: "frozen", xSplit: freezeColumnCount, ySplit: 1 }];
    sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columnCount },
    };
    sheet.eachRow((row) => {
        row.font = { name: "Arial" };
    });
    styleHeaderRow(sheet.getRow(1));
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

function styleHeaderRow(row: ExcelJS.Row): void {
    row.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: HEADER_FILL },
    };
    row.alignment = { vertical: "middle", horizontal: "center" };
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
