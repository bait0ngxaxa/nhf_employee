import type {
    CalendarDate,
    RoutineBusinessDayPolicy,
    RoutineScheduleType,
} from "@/lib/routine/schedule";

import type { RoutineReminderRuleInput } from "@/lib/validations/routine";

export type RoutineImportActivation = "ACTIVE" | "INACTIVE" | "HISTORY_ONLY";

export type RoutineImportCellValue = string | number | boolean | null;
export type RoutineImportJsonValue =
    | string
    | number
    | boolean
    | null
    | RoutineImportJsonValue[]
    | { [key: string]: RoutineImportJsonValue };
export type RoutineImportJsonObject = { [key: string]: RoutineImportJsonValue };

export interface RoutineImportSourceCell {
    address: string;
    value: RoutineImportCellValue;
    formula: string | null;
    type: string | null;
}

export interface RoutineImportFingerprintContext {
    categoryName: string;
    title: string;
    ownerNames: readonly string[];
    scheduleText: string | null;
    contractText: string | null;
    extraDetails: string | null;
}

export interface RoutineImportNormalizedSchedule {
    scheduleType: RoutineScheduleType;
    scheduleConfig: RoutineImportJsonObject;
    businessDayPolicy: RoutineBusinessDayPolicy;
}

export interface RoutineImportRow {
    sourceFileName: string;
    sourceSheet: string;
    sourceRow: number;
    sourceFingerprint: string;
    sourceCells: RoutineImportSourceCell[];
    categorySourceText: string | null;
    ownerSourceText: string | null;
    unitCode: string;
    unitName: string;
    categoryName: string;
    title: string;
    ownerNames: string[];
    mappedEmployeeIds: number[];
    mappedEmployeeNames: string[];
    mappedAssignees?: Array<{
        employeeId: number;
        role: "OWNER" | "CO_OWNER";
    }>;
    reminderRules?: RoutineReminderRuleInput[];
    scheduleText: string | null;
    contractText: string | null;
    extraDetails: string | null;
    normalizedSchedule: RoutineImportNormalizedSchedule | null;
    contractStartDate: CalendarDate | null;
    contractEndDate: CalendarDate | null;
    requiresReview: boolean;
    reviewReasons: string[];
    proposedActivation: RoutineImportActivation;
}

export interface RoutineImportMergedRegion {
    startAddress: string;
    endAddress: string;
}

export interface RoutineImportSheetInspection {
    sheetName: string;
    range: string | null;
    headerColumns: {
        owner: string | null;
        title: string | null;
        schedule: string | null;
        contract: string | null;
        details: string | null;
    };
    headerRows: number[];
    mergedRegions: RoutineImportMergedRegion[];
    blankRows: number[];
    repeatedHeaderRows: number[];
    categoryRows: number[];
    dataRows: number[];
    formulaCells: string[];
    numericDateCells: string[];
    stringDateCells: string[];
}

export interface RoutineImportWorkbookInspection {
    fileName: string;
    sheetCount: number;
    sheets: RoutineImportSheetInspection[];
}

export interface RoutineImportSummary {
    totalRows: number;
    validRows: number;
    requiresReview: number;
    unresolvedOwners: number;
    ambiguousSchedules: number;
    expiredContracts: number;
    missingCategory: number;
    missingUnit: number;
    duplicateSourceRows: number;
    proposedActive: number;
    proposedInactive: number;
    proposedHistoryOnly: number;
}

export interface RoutineImportManifest {
    manifestVersion: 1;
    sourceFileName: string;
    sourceSha256: string;
    generatedAt: string;
    asOfDate: CalendarDate;
    inspection: RoutineImportWorkbookInspection;
    rows: RoutineImportRow[];
    summary: RoutineImportSummary;
}

export interface RoutineImportOwnerMapping {
    [sourceOwnerName: string]: number;
}

export interface RoutineImportReferenceData {
    units: Array<{
        id: number;
        code: string;
        name: string;
        isActive: boolean;
    }>;
    categories: Array<{
        id: number;
        name: string;
        sortOrder: number;
        isActive: boolean;
    }>;
    employees: Array<{
        id: number;
        firstName: string;
        lastName: string;
        nickname: string | null;
        status: string;
        deletedAt: string | null;
    }>;
}

export interface RoutineImportApplyResult {
    inserted: number;
    skipped: number;
    conflicts: number;
    failed: number;
    historyOnly: number;
    inactive: number;
    errors: Array<{
        sourceSheet: string;
        sourceRow: number;
        title: string;
        reason: string;
    }>;
}
