import { describe, expect, it } from "vitest";

import { parseRoutineImportRow } from "@/lib/services/routine-import";

function makeLegacyRow(proposedActivation: string): Record<string, unknown> {
    return {
        sourceFileName: "routine.xlsx",
        sourceSheet: "มสช.",
        sourceRow: 6,
        sourceFingerprint: "a".repeat(64),
        sourceCells: [{ address: "A6", value: null, formula: null, type: "s" }],
        categorySourceText: null,
        ownerSourceText: "ยังไม่พบผู้รับผิดชอบ",
        unitCode: "มสช.",
        unitName: "มสช.",
        categoryName: "ระบบคอมพิวเตอร์",
        title: "ตรวจสอบระบบ",
        ownerNames: ["ยังไม่พบผู้รับผิดชอบ"],
        mappedEmployeeIds: [],
        mappedEmployeeNames: [],
        mappedAssignees: [],
        reminderRules: [],
        scheduleText: null,
        contractText: null,
        extraDetails: null,
        normalizedSchedule: null,
        contractStartDate: null,
        contractEndDate: null,
        requiresReview: true,
        reviewReasons: ["MISSING_OWNER"],
        proposedActivation,
    };
}

describe("routine import row compatibility", () => {
    it.each(["INACTIVE", "HISTORY_ONLY"])(
        "normalizes legacy proposed activation %s to the current active policy",
        (proposedActivation) => {
            expect(parseRoutineImportRow(makeLegacyRow(proposedActivation)).proposedActivation).toBe("ACTIVE");
        },
    );
});
