import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import {
    buildRoutineImportManifest,
    computeRoutineImportRowFingerprint,
    readRoutineWorkbook,
} from "./index";
import { ROUTINE_IMPORT_TARGET_SHEET } from "./sheet-config";
import type { RoutineImportReferenceData } from "./index";

const referenceData: RoutineImportReferenceData = {
    units: [{ id: 1, code: "U1", name: "หน่วย U1", isActive: true }],
    categories: [{ id: 1, name: "สาธารณูปโภค", sortOrder: 0, isActive: true }],
    employees: [{
        id: 10,
        firstName: "กัลยาณี",
        lastName: "ศรีตะพันธ์",
        nickname: null,
        departmentId: 1,
        status: "ACTIVE",
        deletedAt: null,
    }],
};

function buildFixtureWorkbook(): Uint8Array {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
        ["รายการชำระเงิน", null, null, null, null],
        ["ที่", "ผู้รับผิดชอบ", "รายการ", "กำหนดชำระ", "กำหนดสัญญา"],
        [1, null, "สาธารณูปโภค", null, null],
        [null, "กัลยาณี", "ค่าไฟฟ้า", "วันที่ 10 ของเดือน", "1 ม.ค. 68 - 31 ธ.ค. 70"],
        [null, null, "ค่าโทรศัพท์", "วันที่ 16 หรือ 23 ของเดือน", null],
        [null, null, null, null, null],
        ["ที่", "ผู้รับผิดชอบ", "รายการ", "กำหนดชำระ", "กำหนดสัญญา"],
    ]);
    sheet["!merges"] = [{ s: { r: 3, c: 1 }, e: { r: 4, c: 1 } }];
    XLSX.utils.book_append_sheet(workbook, sheet, "U1");
    return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}

describe("routine workbook extraction", () => {
    it("handles merged owner cells, inherited blanks, repeated headers, and Thai text", () => {
        const manifest = buildRoutineImportManifest(
            readRoutineWorkbook(buildFixtureWorkbook()),
            "fixture.xls",
            "b".repeat(64),
            "2026-08-03",
            { กัลยาณี: 10 },
            referenceData,
            "2026-08-03T00:00:00.000Z",
        );

        expect(manifest.rows).toHaveLength(2);
        expect(manifest.rows[0]?.title).toBe("ค่าไฟฟ้า");
        expect(manifest.rows[1]?.title).toBe("ค่าโทรศัพท์");
        expect(manifest.rows[1]?.ownerNames).toEqual(["กัลยาณี"]);
        expect(manifest.rows[0]?.proposedActivation).toBe("ACTIVE");
        expect(manifest.rows[1]?.proposedActivation).toBe("ACTIVE");
        expect(manifest.inspection.sheets[0]?.mergedRegions).toHaveLength(1);
        expect(manifest.inspection.sheets[0]?.repeatedHeaderRows).toEqual([7]);
        expect(manifest.inspection.sheets[0]?.blankRows).toContain(6);
    });

    it("records formula cells and numeric date cells instead of silently applying them", () => {
        const workbook = readRoutineWorkbook(buildFixtureWorkbook());
        const sheet = workbook.Sheets.U1;
        if (!sheet) throw new Error("fixture sheet missing");
        sheet.D4 = { t: "s", v: "วันที่ 10 ของเดือน", f: "=C4" };
        sheet.E4 = { t: "n", v: 45000, z: "m/d/yy" };

        const manifest = buildRoutineImportManifest(
            workbook,
            "fixture.xls",
            "c".repeat(64),
            "2026-08-03",
            { กัลยาณี: 10 },
            referenceData,
        );
        expect(manifest.inspection.sheets[0]?.formulaCells).toContain("D4");
        expect(manifest.inspection.sheets[0]?.numericDateCells).toContain("E4");
        expect(manifest.rows[0]?.reviewReasons).toEqual([]);
        expect(manifest.rows[0]?.normalizedSchedule?.scheduleType).toBe("MONTHLY_DAY");
    });

    it("does not block an expired contract or an ambiguous old schedule", () => {
        const workbook = readRoutineWorkbook(buildFixtureWorkbook());
        const sheet = workbook.Sheets.U1;
        if (!sheet) throw new Error("fixture sheet missing");
        sheet.E4 = { t: "s", v: "1 ม.ค. 60 - 31 ธ.ค. 65" };

        const manifest = buildRoutineImportManifest(
            workbook,
            "fixture.xls",
            "f".repeat(64),
            "2026-08-03",
            { กัลยาณี: 10 },
            referenceData,
        );

        expect(manifest.rows[0]?.requiresReview).toBe(false);
        expect(manifest.rows[0]?.contractEndDate).toBe("2022-12-31");
        expect(manifest.rows[1]?.requiresReview).toBe(false);
        expect(manifest.rows[1]?.normalizedSchedule?.scheduleType).toBe("MANUAL");
    });

    it("changes the source fingerprint when inherited owner context changes", () => {
        const sourceCells = [{
            address: "C4",
            value: "ค่าไฟฟ้า" as const,
            formula: null,
            type: "s",
        }];
        const base = {
            categoryName: "สาธารณูปโภค",
            title: "ค่าไฟฟ้า",
            scheduleText: "วันที่ 10 ของเดือน",
            contractText: null,
            extraDetails: null,
        };
        expect(
            computeRoutineImportRowFingerprint("fixture.xls", "U1", 5, sourceCells, {
                ...base,
                ownerNames: ["กัลยาณี"],
            }),
        ).not.toBe(
            computeRoutineImportRowFingerprint("fixture.xls", "U1", 5, sourceCells, {
                ...base,
                ownerNames: ["พี่นวล"],
            }),
        );
    });

    it("extracts only the explicitly allowlisted sheet", () => {
        const workbook = readRoutineWorkbook(buildFixtureWorkbook());
        const sourceSheet = workbook.Sheets.U1;
        if (!sourceSheet) throw new Error("fixture sheet missing");
        workbook.Sheets[ROUTINE_IMPORT_TARGET_SHEET] = sourceSheet;
        workbook.Sheets["ม.สคส."] = sourceSheet;
        workbook.SheetNames = ["ม.สคส.", ROUTINE_IMPORT_TARGET_SHEET];

        const manifest = buildRoutineImportManifest(
            workbook,
            "fixture.xls",
            "e".repeat(64),
            "2026-08-03",
            { กัลยาณี: 10 },
            referenceData,
            "2026-08-03T00:00:00.000Z",
            { includeSheets: [ROUTINE_IMPORT_TARGET_SHEET] },
        );

        expect(manifest.inspection.sheets.map((sheet) => sheet.sheetName)).toEqual([
            ROUTINE_IMPORT_TARGET_SHEET,
        ]);
        expect(manifest.rows.every((row) => row.sourceSheet === ROUTINE_IMPORT_TARGET_SHEET)).toBe(true);
    });
});
