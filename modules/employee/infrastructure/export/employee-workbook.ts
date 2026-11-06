import ExcelJS from "exceljs";

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
    sheet.autoFilter = "A1:L1";
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.eachRow((row, rowNumber) => {
        row.font = { name: "Arial", size: 11 };
        row.alignment = { vertical: "middle", wrapText: true };
        if (rowNumber > 1) {
            row.eachCell((cell, column) => {
                cell.numFmt = column === 1 ? "0" : "@";
            });
        }
    });
    const header = sheet.getRow(1);
    header.height = 30;
    header.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    header.eachCell((cell) => {
        cell.border = { right: { style: "thin", color: { argb: "FF64748B" } } };
    });
    return workbook;
}
