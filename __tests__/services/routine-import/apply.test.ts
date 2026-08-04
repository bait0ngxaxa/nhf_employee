import { describe, expect, it } from "vitest";

import {
    buildRoutineImportTaskInput,
    computeRoutineImportRowFingerprint,
} from "@/lib/services/routine-import";
import type { RoutineImportRow } from "@/lib/services/routine-import";

function makeRow(overrides: Partial<RoutineImportRow> = {}): RoutineImportRow {
    const sourceCells = [{
        address: "C4",
        value: "ค่าไฟฟ้า" as const,
        formula: null,
        type: "s",
    }];
    return {
        sourceFileName: "fixture.xls",
        sourceSheet: "มสช.",
        sourceRow: 4,
        sourceFingerprint: computeRoutineImportRowFingerprint(
            "fixture.xls",
            "มสช.",
            4,
            sourceCells,
            {
                categoryName: "สาธารณูปโภค",
                title: "ค่าไฟฟ้า",
                ownerNames: ["กัลยาณี"],
                scheduleText: "วันที่ 10 ของเดือน",
                contractText: null,
                extraDetails: null,
            },
        ),
        sourceCells,
        categorySourceText: "สาธารณูปโภค",
        ownerSourceText: "กัลยาณี",
        unitCode: "มสช.",
        unitName: "มสช.",
        categoryName: "สาธารณูปโภค",
        title: "ค่าไฟฟ้า",
        ownerNames: ["กัลยาณี"],
        mappedEmployeeIds: [10],
        mappedEmployeeNames: ["กัลยาณี ศรีตะพันธ์"],
        mappedAssignees: [{ employeeId: 10, role: "OWNER" }],
        scheduleText: "วันที่ 10 ของเดือน",
        contractText: null,
        extraDetails: null,
        normalizedSchedule: {
            scheduleType: "MONTHLY_DAY",
            scheduleConfig: { day: 10, monthOffset: 0 },
            businessDayPolicy: "NONE",
        },
        contractStartDate: null,
        contractEndDate: null,
        requiresReview: false,
        reviewReasons: [],
        proposedActivation: "ACTIVE",
        ...overrides,
    };
}

describe("routine import task input", () => {
    it("creates active RoutineTasks with the mapped owner", () => {
        const input = buildRoutineImportTaskInput(makeRow(), 1, 2);

        expect(input.isActive).toBe(true);
        expect(input.assignees).toEqual([{ employeeId: 10, role: "OWNER" }]);
        expect(input.scheduleType).toBe("MONTHLY_DAY");
        expect(input.reminderRules).toEqual([]);
    });

    it("keeps an imported manual schedule safe for later admin editing", () => {
        const input = buildRoutineImportTaskInput(
            makeRow({
                normalizedSchedule: {
                    scheduleType: "MANUAL",
                    scheduleConfig: {},
                    businessDayPolicy: "NONE",
                },
                scheduleText: "เมื่อแจ้งหนี้ครบทุกเบอร์",
            }),
            1,
            2,
        );

        expect(input.isActive).toBe(true);
        expect(input.scheduleType).toBe("MANUAL");
        expect(input.scheduleText).toBe("เมื่อแจ้งหนี้ครบทุกเบอร์");
    });
});
