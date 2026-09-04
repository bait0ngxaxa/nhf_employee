import { routineTaskCreateSchema, type RoutineTaskCreateInput } from "../../schemas/routine";

import type { RoutineImportRow } from "./types";

function taskInputForRow(
    row: RoutineImportRow,
    unitId: number,
    categoryId: number,
): RoutineTaskCreateInput {
    const parsed = routineTaskCreateSchema.safeParse({
        unitId,
        categoryId,
        title: row.title,
        description: null,
        scheduleType: row.normalizedSchedule?.scheduleType ?? "MANUAL",
        scheduleConfig: row.normalizedSchedule?.scheduleConfig ?? {},
        scheduleText: row.scheduleText,
        contractStartDate: row.contractStartDate,
        contractEndDate: row.contractEndDate,
        contractText: row.contractText,
        extraDetails: row.extraDetails,
        businessDayPolicy: row.normalizedSchedule?.businessDayPolicy ?? "NONE",
        isActive: true,
        assignees: row.mappedAssignees ?? row.mappedEmployeeIds.map((employeeId, index) => ({
            employeeId,
            role: index === 0 ? "OWNER" as const : "CO_OWNER" as const,
        })),
        reminderRules: row.reminderRules ?? [],
        sourceFileName: row.sourceFileName,
        sourceSheet: row.sourceSheet,
        sourceRow: row.sourceRow,
    });
    if (!parsed.success) {
        throw new Error("ข้อมูล row ไม่ผ่าน validation ของ RoutineTask");
    }
    return parsed.data;
}

export function buildRoutineImportTaskInput(
    row: RoutineImportRow,
    unitId: number,
    categoryId: number,
): RoutineTaskCreateInput {
    return taskInputForRow(row, unitId, categoryId);
}
