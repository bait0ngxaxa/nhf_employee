import { z } from "zod";

import { ROUTINE_SCHEDULE_TYPES, ROUTINE_BUSINESS_DAY_POLICIES } from "@/lib/routine/schedule";

import type {
    RoutineImportManifest,
    RoutineImportOwnerMapping,
} from "./types";
import { computeRoutineImportRowFingerprint } from "./workbook";

const jsonObjectSchema = z.record(z.string(), z.json());
const sourceCellSchema = z.object({
    address: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    formula: z.string().nullable(),
    type: z.string().nullable(),
});
const normalizedScheduleSchema = z.object({
    scheduleType: z.enum(ROUTINE_SCHEDULE_TYPES),
    scheduleConfig: jsonObjectSchema,
    businessDayPolicy: z.enum(ROUTINE_BUSINESS_DAY_POLICIES),
});
const importRowSchema = z.object({
    sourceFileName: z.string().min(1).max(255),
    sourceSheet: z.string().min(1).max(255),
    sourceRow: z.number().int().positive(),
    sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    sourceCells: z.array(sourceCellSchema),
    categorySourceText: z.string().nullable(),
    ownerSourceText: z.string().nullable(),
    unitCode: z.string(),
    unitName: z.string(),
    categoryName: z.string(),
    title: z.string().min(1).max(255),
    ownerNames: z.array(z.string()),
    mappedEmployeeIds: z.array(z.number().int().positive()),
    mappedEmployeeNames: z.array(z.string()),
    mappedAssignees: z.array(z.object({
        employeeId: z.number().int().positive(),
        role: z.enum(["OWNER", "CO_OWNER"]),
    })).optional(),
    reminderRules: z.array(z.object({
        daysBefore: z.number().int().min(0).max(365),
        sendHour: z.number().int().min(0).max(23),
        channel: z.literal("IN_APP"),
        recipientScope: z.enum(["ASSIGNEES", "ADMINS", "ASSIGNEES_AND_ADMINS"]),
        isActive: z.boolean(),
    })).max(20).optional(),
    scheduleText: z.string().nullable(),
    contractText: z.string().nullable(),
    extraDetails: z.string().nullable(),
    normalizedSchedule: normalizedScheduleSchema.nullable(),
    contractStartDate: z.iso.date().nullable(),
    contractEndDate: z.iso.date().nullable(),
    requiresReview: z.boolean(),
    reviewReasons: z.array(z.string()),
    proposedActivation: z.enum(["ACTIVE", "INACTIVE", "HISTORY_ONLY"]),
});
const sheetInspectionSchema = z.object({
    sheetName: z.string(),
    range: z.string().nullable(),
    headerColumns: z.object({
        owner: z.string().nullable(),
        title: z.string().nullable(),
        schedule: z.string().nullable(),
        contract: z.string().nullable(),
        details: z.string().nullable(),
    }),
    headerRows: z.array(z.number().int().positive()),
    mergedRegions: z.array(z.object({
        startAddress: z.string(),
        endAddress: z.string(),
    })),
    blankRows: z.array(z.number().int().positive()),
    repeatedHeaderRows: z.array(z.number().int().positive()),
    categoryRows: z.array(z.number().int().positive()),
    dataRows: z.array(z.number().int().positive()),
    formulaCells: z.array(z.string()),
    numericDateCells: z.array(z.string()),
    stringDateCells: z.array(z.string()),
});
const manifestSchema = z.object({
    manifestVersion: z.literal(1),
    sourceFileName: z.string().min(1).max(255),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    generatedAt: z.string().datetime(),
    asOfDate: z.iso.date(),
    inspection: z.object({
        fileName: z.string().min(1),
        sheetCount: z.number().int().nonnegative(),
        sheets: z.array(sheetInspectionSchema),
    }),
    rows: z.array(importRowSchema),
    summary: z.object({
        totalRows: z.number().int().nonnegative(),
        validRows: z.number().int().nonnegative(),
        requiresReview: z.number().int().nonnegative(),
        unresolvedOwners: z.number().int().nonnegative(),
        ambiguousSchedules: z.number().int().nonnegative(),
        expiredContracts: z.number().int().nonnegative(),
        missingCategory: z.number().int().nonnegative(),
        missingUnit: z.number().int().nonnegative(),
        duplicateSourceRows: z.number().int().nonnegative(),
        proposedActive: z.number().int().nonnegative(),
        proposedInactive: z.number().int().nonnegative(),
        proposedHistoryOnly: z.number().int().nonnegative(),
    }),
});

export function parseRoutineImportManifest(
    value: unknown,
): RoutineImportManifest {
    const result = manifestSchema.safeParse(value);
    if (!result.success) {
        throw new Error("ไฟล์ manifest ไม่ผ่านการตรวจสอบรูปแบบ");
    }
    return result.data;
}

export function parseRoutineImportRow(value: unknown): RoutineImportManifest["rows"][number] {
    const result = importRowSchema.safeParse(value);
    if (!result.success) {
        throw new Error("ข้อมูล staging row ไม่ผ่านการตรวจสอบรูปแบบ");
    }
    return result.data;
}

export function parseRoutineOwnerMapping(
    value: unknown,
): RoutineImportOwnerMapping {
    const result = z.record(
        z.string().min(1),
        z.number().int().positive(),
    ).safeParse(value);
    if (!result.success) {
        throw new Error("ไฟล์ owner mapping ไม่ผ่านการตรวจสอบรูปแบบ");
    }
    return result.data;
}

export function assertRoutineImportManifestApplySafe(
    manifest: RoutineImportManifest,
): void {
    const identities = new Set<string>();
    for (const row of manifest.rows) {
        const identity = `${row.sourceFileName}:${row.sourceSheet}:${row.sourceRow}`;
        if (identities.has(identity)) {
            throw new Error("manifest มี source identity ซ้ำกัน");
        }
        identities.add(identity);

        if (
            computeRoutineImportRowFingerprint(
                row.sourceFileName,
                row.sourceSheet,
                row.sourceRow,
                row.sourceCells,
                {
                    categoryName: row.categoryName,
                    title: row.title,
                    ownerNames: row.ownerNames,
                    scheduleText: row.scheduleText,
                    contractText: row.contractText,
                    extraDetails: row.extraDetails,
                },
            ) !== row.sourceFingerprint
        ) {
            throw new Error("manifest มี source fingerprint ไม่ตรงกับข้อมูลต้นฉบับ");
        }

        if (
            row.proposedActivation === "ACTIVE"
            && (row.requiresReview
            || row.normalizedSchedule === null
            || row.mappedEmployeeIds.length !== row.ownerNames.length
                || row.reviewReasons.length > 0)
        ) {
            throw new Error("manifest ไม่อนุญาตให้ activate row ที่ยังต้องตรวจสอบ");
        }
    }
}
