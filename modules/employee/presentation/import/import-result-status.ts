import type { ImportResult } from "./types";

export type ImportResultStatus = "complete" | "partial" | "failed" | "empty";

export const IMPORT_RESULT_MESSAGES: Readonly<Record<ImportResultStatus, string>> = {
    complete: "นำเข้าข้อมูลสำเร็จ",
    partial: "นำเข้าสำเร็จบางรายการ",
    failed: "นำเข้าข้อมูลไม่สำเร็จ",
    empty: "ไม่มีรายการที่นำเข้า",
};

export function getImportResultStatus(
    result: Pick<ImportResult, "success" | "errors">,
): ImportResultStatus {
    if (result.success.length === 0) {
        return result.errors.length === 0 ? "empty" : "failed";
    }

    return result.errors.length === 0 ? "complete" : "partial";
}
