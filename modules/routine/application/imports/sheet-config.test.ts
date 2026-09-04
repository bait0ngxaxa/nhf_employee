import { describe, expect, it } from "vitest";

import {
    getRoutineImportSheetScope,
    ROUTINE_IMPORT_TARGET_SHEET,
} from "./sheet-config";

describe("routine import sheet allowlist", () => {
    it("selects มสช. by exact name and reports ignored sheets", () => {
        expect(getRoutineImportSheetScope([
            "ม.สคส.",
            ROUTINE_IMPORT_TARGET_SHEET,
            "มสส.",
        ])).toEqual({
            targetSheet: ROUTINE_IMPORT_TARGET_SHEET,
            ignoredSheetNames: ["ม.สคส.", "มสส."],
        });
    });

    it("rejects a similar but non-exact sheet name", () => {
        expect(() => getRoutineImportSheetScope(["มสช"])).toThrow(
            "ไม่พบชีต มสช. ในไฟล์ Excel",
        );
    });
});
