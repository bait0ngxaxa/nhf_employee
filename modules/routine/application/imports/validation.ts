import { z } from "zod";

import { ROUTINE_SCHEDULE_TYPES, ROUTINE_BUSINESS_DAY_POLICIES } from "../../domain/schedule";

import type { RoutineImportRow } from "./types";

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
const proposedActivationSchema = z.preprocess(
    (value: unknown) => value === "INACTIVE" || value === "HISTORY_ONLY" ? "ACTIVE" : value,
    z.literal("ACTIVE"),
);
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
    title: z.string().max(255),
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
    proposedActivation: proposedActivationSchema,
});
export function parseRoutineImportRow(value: unknown): RoutineImportRow {
    const result = importRowSchema.safeParse(value);
    if (!result.success) {
        throw new Error("ข้อมูล staging row ไม่ผ่านการตรวจสอบรูปแบบ");
    }
    return result.data;
}
