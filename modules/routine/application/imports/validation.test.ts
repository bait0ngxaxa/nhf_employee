import { describe, expect, it } from "vitest";

import { parseRoutineImportRow } from "./index";

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

    it.each([
        ["ADMINS", "ALL_READERS"],
        ["ASSIGNEES_AND_ADMINS", "ASSIGNEES_AND_ALL_READERS"],
    ] as const)("normalizes persisted legacy reminder scope %s", (legacy, canonical) => {
        const row = makeLegacyRow("ACTIVE");
        row.reminderRules = [{
            daysBefore: 1,
            sendHour: 9,
            channel: "IN_APP",
            recipientScope: legacy,
            isActive: true,
        }];

        expect(parseRoutineImportRow(row).reminderRules).toEqual([{
            daysBefore: 1,
            sendHour: 9,
            channel: "IN_APP",
            recipientScope: canonical,
            isActive: true,
        }]);
    });
});
