import { z } from "zod";

import {
    ROUTINE_BUSINESS_DAY_POLICIES,
    ROUTINE_SCHEDULE_TYPES,
} from "@/lib/routine/schedule";

import {
    routineAssigneeSchema,
    routineReminderRuleSchema,
    validateRoutineScheduleConfig,
} from "./routine";

export const routineImportBatchIdSchema = z.string().regex(/^\d+$/, "รหัสไม่ถูกต้อง");

export const routineImportRowsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    status: z.enum([
        "VALID",
        "REQUIRES_REVIEW",
        "EXCLUDED",
        "ALREADY_IMPORTED",
        "CONFLICT",
        "APPLIED",
        "FAILED",
    ]).optional(),
    selected: z.enum(["0", "1"]).transform((value) => value === "1").optional(),
    issue: z.enum(["UNRESOLVED_OWNER"]).optional(),
    search: z.string().trim().max(100).optional(),
});

export const routineImportPreviewOptionsSchema = z.object({
    asOfDate: z.iso.date().optional(),
});

export const routineImportApplySchema = z.object({
    confirm: z.literal(true, { error: "ต้องยืนยันการนำเข้าก่อนดำเนินการ" }),
});

export const routineImportRowUpdateSchema = z.object({
    version: z.coerce.number().int().positive("เวอร์ชันไม่ถูกต้อง"),
    categoryName: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(255),
    mappedAssignees: z.array(routineAssigneeSchema).max(100),
    scheduleText: z.string().trim().max(500).nullable(),
    scheduleType: z.enum(ROUTINE_SCHEDULE_TYPES),
    scheduleConfig: z.record(z.string(), z.json()),
    businessDayPolicy: z.enum(ROUTINE_BUSINESS_DAY_POLICIES),
    contractStartDate: z.iso.date().nullable(),
    contractEndDate: z.iso.date().nullable(),
    contractText: z.string().trim().max(500).nullable(),
    extraDetails: z.string().trim().max(5000).nullable(),
    selected: z.boolean(),
    reminderRules: z.array(routineReminderRuleSchema).max(20),
}).superRefine((data, ctx) => {
    if (
        data.contractStartDate
        && data.contractEndDate
        && data.contractStartDate > data.contractEndDate
    ) {
        ctx.addIssue({
            code: "custom",
            path: ["contractEndDate"],
            message: "วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มสัญญา",
        });
    }

    validateRoutineScheduleConfig(data.scheduleType, data.scheduleConfig, ctx);
});

export type RoutineImportRowUpdateInput = z.infer<typeof routineImportRowUpdateSchema>;
