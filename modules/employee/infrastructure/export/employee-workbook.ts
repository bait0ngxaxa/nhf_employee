import ExcelJS from "exceljs";
import { styleWorksheet } from "@/lib/server/xlsx-style";

export type EmployeeExportRow = [
    number, string, string, string, string, string,
    string, string, string, string, string, string,
];

export function createEmployeeExportWorkbook(
    rows: readonly EmployeeExportRow[],
): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "NHF Employee";
    const sheet = workbook.addWorksheet("รายชื่อพนักงาน");
    sheet.columns = [
        { header: "ลำดับ", width: 10 },
        { header: "ชื่อ", width: 24 },
        { header: "นามสกุล", width: 24 },
        { header: "ชื่อเล่น", width: 16 },
        { header: "ตำแหน่ง", width: 30 },
        { header: "สังกัด", width: 28 },
        { header: "แผนก", width: 28 },
        { header: "อีเมล", width: 36 },
        { header: "เบอร์โทร", width: 20 },
        { header: "สถานะ", width: 18 },
        { header: "วันที่เริ่มงาน", width: 20 },
        { header: "อายุงาน", width: 28 },
    ];
    // Plain string values remain literal text, including formula-like input.
    sheet.addRows([...rows]);
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            row.eachCell((cell, column) => {
                cell.numFmt = column === 1 ? "0" : "@";
            });
        }
    });
    styleWorksheet(sheet);
    return workbook;
}
