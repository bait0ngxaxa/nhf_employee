export const ROUTINE_IMPORT_SHEETS = {
    active: ["มสช."] as const,
    reserved: ["ม.สคส.", "มสส.", "มส.ผส."] as const,
} as const;

export const ROUTINE_IMPORT_SOURCE_SYSTEM = "NHF_ROUTINE_WORKBOOK" as const;
export const ROUTINE_IMPORT_TARGET_SHEET = ROUTINE_IMPORT_SHEETS.active[0];
export const ROUTINE_IMPORT_TARGET_UNIT_CODE = "มสช." as const;
export const ROUTINE_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ROUTINE_IMPORT_MAX_ROWS = 500;
export const ROUTINE_IMPORT_MAX_COLUMNS = 100;
export const ROUTINE_IMPORT_MAX_XLSX_ENTRIES = 2_000;
export const ROUTINE_IMPORT_MAX_XLSX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
export const ROUTINE_IMPORT_BATCH_TTL_DAYS = 7;

export function buildRoutineImportSourceKey(
    sheetName: string,
    sourceRow: number,
): string {
    return `${ROUTINE_IMPORT_SOURCE_SYSTEM}:${sheetName}:${sourceRow}`;
}

export function getRoutineImportSheetScope(sheetNames: readonly string[]): {
    targetSheet: typeof ROUTINE_IMPORT_TARGET_SHEET;
    ignoredSheetNames: string[];
} {
    if (!sheetNames.includes(ROUTINE_IMPORT_TARGET_SHEET)) {
        throw new Error("ไม่พบชีต มสช. ในไฟล์ Excel");
    }

    return {
        targetSheet: ROUTINE_IMPORT_TARGET_SHEET,
        ignoredSheetNames: sheetNames.filter(
            (sheetName) => sheetName !== ROUTINE_IMPORT_TARGET_SHEET,
        ),
    };
}
