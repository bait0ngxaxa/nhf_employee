import type ExcelJS from "exceljs";

const XLSX_CONTENT_TYPE =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ASCII_FALLBACK_FILENAME = "export.xlsx";

export async function createXlsxDownloadResponse(
    filename: string,
    workbook: ExcelJS.Workbook,
): Promise<Response> {
    const encodedFilename = encodeURIComponent(filename);
    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
        headers: {
            "Content-Type": XLSX_CONTENT_TYPE,
            "Content-Disposition": `attachment; filename="${ASCII_FALLBACK_FILENAME}"; filename*=UTF-8''${encodedFilename}`,
            "Cache-Control": "no-store",
        },
    });
}
