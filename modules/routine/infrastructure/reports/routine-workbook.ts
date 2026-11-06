import ExcelJS from "exceljs";
import { styleWorksheet } from "@/lib/server/xlsx-style";

import {
    formatRoutineScheduleSummary,
    formatRoutineUnitLabel,
    ROUTINE_SCHEDULE_LABELS,
    ROUTINE_TIMING_STATUS_LABELS,
} from "../../domain/labels";
import type { SerializedRoutineTaskExportItem } from "../../application/queries";

const ROUTINE_SHEET_NAME = "รายการงานประจำ";
const EMPTY_VALUE = "ไม่ได้ระบุ";

export function createRoutineTaskExportWorkbook(
    tasks: readonly SerializedRoutineTaskExportItem[],
): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "NHF Employee";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(ROUTINE_SHEET_NAME);
    sheet.columns = getRoutineColumns();
    sheet.addRows(tasks.map(toRoutineWorksheetRow));
    styleWorksheet(sheet, { freezeColumns: 2 });

    return workbook;
}

function toRoutineWorksheetRow(
    task: SerializedRoutineTaskExportItem,
): Record<string, string | number> {
    const occurrence = task.relevantOccurrence;
    return {
        taskCode: task.id,
        title: task.title,
        description: textOrEmpty(task.description),
        unit: formatRoutineUnitLabel(task.unit),
        category: task.category.name,
        scheduleType: ROUTINE_SCHEDULE_LABELS[task.scheduleType]
            ?? task.scheduleType,
        scheduleDetails: formatScheduleDetails(task),
        periodKey: occurrence?.periodKey ?? EMPTY_VALUE,
        dueDate: occurrence?.dueDate ?? EMPTY_VALUE,
        timingStatus: occurrence
            ? ROUTINE_TIMING_STATUS_LABELS[occurrence.timingStatus]
            : "ยังไม่มีรอบกำหนด",
        owner: formatAssignees(task, "OWNER"),
        coOwners: formatAssignees(task, "CO_OWNER"),
        contractStartDate: task.contractStartDate ?? EMPTY_VALUE,
        contractEndDate: task.contractEndDate ?? EMPTY_VALUE,
        contractText: textOrEmpty(task.contractText),
        extraDetails: textOrEmpty(task.extraDetails),
        activeStatus: task.isActive ? "ใช้งานอยู่" : "ปิดใช้งาน",
    };
}

function formatScheduleDetails(task: SerializedRoutineTaskExportItem): string {
    const summary = formatRoutineScheduleSummary(task);
    const explicitText = task.scheduleText?.trim();
    if (!explicitText || explicitText === summary) return summary;
    return `${summary} · ${explicitText}`;
}

function formatAssignees(
    task: SerializedRoutineTaskExportItem,
    role: "OWNER" | "CO_OWNER",
): string {
    const names = task.assignees
        .filter((assignee) => assignee.role === role)
        .map((assignee) => assignee.employee.displayName?.trim()
            || `รหัสพนักงาน ${assignee.employeeId}`);
    return names.length > 0 ? names.join(", ") : EMPTY_VALUE;
}

function textOrEmpty(value: string | null): string {
    return value?.trim() || EMPTY_VALUE;
}

function getRoutineColumns(): Partial<ExcelJS.Column>[] {
    return [
        { header: "รหัสงาน", key: "taskCode", width: 12 },
        { header: "ชื่องาน", key: "title", width: 32 },
        { header: "รายละเอียด", key: "description", width: 36 },
        { header: "หน่วยงาน", key: "unit", width: 24 },
        { header: "หมวดหมู่", key: "category", width: 24 },
        { header: "รูปแบบกำหนดการ", key: "scheduleType", width: 22 },
        { header: "รายละเอียดกำหนดการ", key: "scheduleDetails", width: 42 },
        { header: "รอบงานที่เกี่ยวข้อง", key: "periodKey", width: 20 },
        { header: "วันที่กำหนด", key: "dueDate", width: 16 },
        { header: "สถานะเวลา", key: "timingStatus", width: 18 },
        { header: "ผู้รับผิดชอบหลัก", key: "owner", width: 28 },
        { header: "ผู้รับผิดชอบร่วม", key: "coOwners", width: 28 },
        { header: "วันเริ่มสัญญา", key: "contractStartDate", width: 16 },
        { header: "วันสิ้นสุดสัญญา", key: "contractEndDate", width: 16 },
        { header: "รายละเอียดสัญญา", key: "contractText", width: 32 },
        { header: "รายละเอียดเพิ่มเติม", key: "extraDetails", width: 36 },
        { header: "สถานะการใช้งาน", key: "activeStatus", width: 18 },
    ];
}
