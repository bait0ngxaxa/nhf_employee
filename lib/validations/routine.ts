import { z } from "zod";

import {
    ROUTINE_BUSINESS_DAY_POLICIES,
    ROUTINE_SCHEDULE_TYPES,
    type RoutineBusinessDayPolicy,
    type RoutineScheduleConfig,
    type RoutineScheduleDefinition,
    type RoutineScheduleType,
} from "@/lib/routine/schedule";
import {
    ROUTINE_TIMING_STATUSES,
} from "@/lib/routine/timing";

const emptyToUndefined = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
};

const emptyToNull = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
};

const optionalText = (max: number) =>
    z.preprocess(
        emptyToNull,
        z.string().trim().max(max).nullable().optional(),
    );

const dateSchema = z.iso.date({ error: "รูปแบบวันที่ไม่ถูกต้อง" });

const monthlyDayScheduleConfigSchema = z.strictObject({
    day: z.coerce.number().int().min(1).max(31),
    monthOffset: z.coerce.number().int().min(-120).max(120).default(0),
});

const monthEndScheduleConfigSchema = z.strictObject({});

const intervalMonthsScheduleConfigSchema = z.strictObject({
    intervalMonths: z.coerce.number().int().min(1).max(120),
    anchorDate: dateSchema,
});

const yearlyDateScheduleConfigSchema = z.strictObject({
    month: z.coerce.number().int().min(1).max(12),
    day: z.coerce.number().int().min(1).max(31),
});

const oneTimeScheduleConfigSchema = z.strictObject({
    date: dateSchema,
});

const manualScheduleConfigSchema = z.strictObject({});

export const routineScheduleConfigSchema = z.union([
    monthlyDayScheduleConfigSchema,
    monthEndScheduleConfigSchema,
    intervalMonthsScheduleConfigSchema,
    yearlyDateScheduleConfigSchema,
    oneTimeScheduleConfigSchema,
    manualScheduleConfigSchema,
]);

export const routineAssigneeSchema = z.object({
    employeeId: z.coerce.number().int().positive("รหัสพนักงานไม่ถูกต้อง"),
    role: z.enum(["OWNER", "CO_OWNER"], {
        message: "บทบาทผู้รับผิดชอบไม่ถูกต้อง",
    }),
});

export const routineReminderRuleSchema = z.object({
    daysBefore: z.coerce.number().int().min(0).max(365),
    sendHour: z.coerce.number().int().min(0).max(23),
    channel: z.literal("IN_APP"),
    recipientScope: z.enum([
        "ASSIGNEES",
        "ADMINS",
        "ASSIGNEES_AND_ADMINS",
    ]),
    isActive: z.boolean().default(true),
});

const routineReminderRulesSchema = z
    .array(routineReminderRuleSchema)
    .max(20, "กฎการแจ้งเตือนมีได้ไม่เกิน 20 รายการ")
    .superRefine((rules, ctx) => {
        const keys = new Set<string>();
        rules.forEach((rule, index) => {
            const key = `${rule.daysBefore}:${rule.channel}:${rule.recipientScope}`;
            if (keys.has(key)) {
                ctx.addIssue({
                    code: "custom",
                    path: [index],
                    message: "กฎการแจ้งเตือนซ้ำกันไม่ได้",
                });
            }
            keys.add(key);
        });
    });

function validateAssigneeList(
    assignees: Array<{ employeeId: number; role: "OWNER" | "CO_OWNER" }>,
    ctx: z.RefinementCtx,
): void {
    const employeeIds = new Set<number>();
    let ownerCount = 0;

    assignees.forEach((assignee, index) => {
        if (employeeIds.has(assignee.employeeId)) {
            ctx.addIssue({
                code: "custom",
                path: ["assignees", index, "employeeId"],
                message: "ผู้รับผิดชอบซ้ำกันไม่ได้",
            });
        }
        employeeIds.add(assignee.employeeId);
        if (assignee.role === "OWNER") ownerCount += 1;
    });

    if (ownerCount !== 1) {
        ctx.addIssue({
            code: "custom",
            path: ["assignees"],
            message: "ต้องมีผู้รับผิดชอบหลัก 1 คน",
        });
    }
}

export const routineScheduleTypeSchema = z.enum(ROUTINE_SCHEDULE_TYPES);
export const routineBusinessDayPolicySchema = z.enum(
    ROUTINE_BUSINESS_DAY_POLICIES,
);

export const routineTaskCreateSchema = z
    .object({
        unitId: z.coerce.number().int().positive("กรุณาเลือกหน่วยงาน"),
        categoryId: z.coerce.number().int().positive("กรุณาเลือกหมวดหมู่"),
        title: z
            .string({ message: "กรุณาระบุชื่องาน" })
            .trim()
            .min(1, "กรุณาระบุชื่องาน")
            .max(255, "ชื่องานต้องไม่เกิน 255 ตัวอักษร"),
        description: optionalText(5000),
        scheduleType: routineScheduleTypeSchema,
        scheduleConfig: z.record(z.string(), z.json()).nullable().optional(),
        scheduleText: optionalText(500),
        contractStartDate: dateSchema.nullish(),
        contractEndDate: dateSchema.nullish(),
        contractText: optionalText(500),
        extraDetails: optionalText(5000),
        businessDayPolicy: routineBusinessDayPolicySchema.default("NONE"),
        isActive: z.boolean().default(true),
        assignees: z
            .array(routineAssigneeSchema)
            .min(1, "กรุณาระบุผู้รับผิดชอบ")
            .max(100, "ผู้รับผิดชอบมีได้ไม่เกิน 100 คน"),
        sourceFileName: optionalText(255),
        sourceSheet: optionalText(255),
        sourceRow: z.coerce.number().int().positive().nullable().optional(),
        reminderRules: routineReminderRulesSchema.optional(),
    })
    .superRefine((data, ctx) => {
        validateAssigneeList(data.assignees, ctx);
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
    });

export const routineTaskUpdateSchema = z
    .object({
        version: z.coerce.number().int().positive("เวอร์ชันไม่ถูกต้อง"),
        unitId: z.coerce.number().int().positive().optional(),
        categoryId: z.coerce.number().int().positive().optional(),
        title: z.string().trim().min(1).max(255).optional(),
        description: optionalText(5000),
        scheduleType: routineScheduleTypeSchema.optional(),
        scheduleConfig: z.record(z.string(), z.json()).nullable().optional(),
        scheduleText: optionalText(500),
        contractStartDate: dateSchema.nullish(),
        contractEndDate: dateSchema.nullish(),
        contractText: optionalText(500),
        extraDetails: optionalText(5000),
        businessDayPolicy: routineBusinessDayPolicySchema.optional(),
        isActive: z.boolean().optional(),
        assignees: z
            .array(routineAssigneeSchema)
            .min(1, "กรุณาระบุผู้รับผิดชอบ")
            .max(100, "ผู้รับผิดชอบมีได้ไม่เกิน 100 คน")
            .optional(),
        sourceFileName: optionalText(255),
        sourceSheet: optionalText(255),
        sourceRow: z.coerce.number().int().positive().nullable().optional(),
        reminderRules: routineReminderRulesSchema.optional(),
    })
    .superRefine((data, ctx) => {
        if (data.assignees) validateAssigneeList(data.assignees, ctx);
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
    });

export const routineOccurrenceFiltersSchema = z.object({
    occurrenceId: z.coerce.number().int().positive().optional(),
    timingStatus: z.enum(ROUTINE_TIMING_STATUSES).optional(),
    unitId: z.coerce.number().int().positive().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    assigneeId: z.coerce.number().int().positive().optional(),
    dueFrom: dateSchema.optional(),
    dueTo: dateSchema.optional(),
    search: z.preprocess(
        emptyToUndefined,
        z.string().trim().max(100).optional(),
    ),
    scope: z.enum(["mine", "all"]).default("mine"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
}).superRefine((data, ctx) => {
    if (data.dueFrom && data.dueTo && data.dueFrom > data.dueTo) {
        ctx.addIssue({
            code: "custom",
            path: ["dueTo"],
            message: "ช่วงวันกำหนดไม่ถูกต้อง",
        });
    }
});

export const routineTaskFiltersSchema = z.object({
    activeOnly: z
        .enum(["0", "1"])
        .optional()
        .transform((value) => value === "1" ? true : undefined),
    unitId: z.coerce.number().int().positive().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    search: z.preprocess(
        emptyToUndefined,
        z.string().trim().max(100).optional(),
    ),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const routineIdParamSchema = z.string().regex(/^\d+$/, "รหัสไม่ถูกต้อง");

export const routineDueDateSchema = z.object({
    dueDate: dateSchema,
    note: optionalText(1000),
});

export const routineOccurrenceAssigneesSchema = z
    .object({
        assignees: z
            .array(routineAssigneeSchema)
            .min(1, "กรุณาระบุผู้รับผิดชอบ")
            .max(100, "ผู้รับผิดชอบมีได้ไม่เกิน 100 คน"),
    })
    .superRefine((data, ctx) => validateAssigneeList(data.assignees, ctx));

export const routineReminderOutboxPayloadSchema = z.object({
    occurrenceId: z.number().int().positive(),
    taskId: z.number().int().positive(),
    ruleId: z.number().int().positive(),
    reminderVersion: z.number().int().positive(),
    dueDate: dateSchema,
    scheduledFor: z.iso.datetime().optional(),
    createdAt: z.string().min(1),
});

export type RoutineTaskCreateInput = z.infer<typeof routineTaskCreateSchema>;
export type RoutineTaskUpdateInput = z.infer<typeof routineTaskUpdateSchema>;
export type RoutineOccurrenceFilters = z.infer<
    typeof routineOccurrenceFiltersSchema
>;
export type RoutineTaskFilters = z.infer<typeof routineTaskFiltersSchema>;
export type RoutineDueDateInput = z.infer<typeof routineDueDateSchema>;
export type RoutineOccurrenceAssigneesInput = z.infer<
    typeof routineOccurrenceAssigneesSchema
>;
export type RoutineReminderRuleInput = z.infer<typeof routineReminderRuleSchema>;
export type RoutineReminderOutboxPayload = z.infer<
    typeof routineReminderOutboxPayloadSchema
>;

export function parseRoutineScheduleConfig(
    scheduleType: RoutineScheduleType,
    value: unknown,
): RoutineScheduleConfig {
    const config = value ?? {};
    switch (scheduleType) {
        case "MONTHLY_DAY":
            return monthlyDayScheduleConfigSchema.parse(config);
        case "MONTH_END":
            return monthEndScheduleConfigSchema.parse(config);
        case "INTERVAL_MONTHS":
            return intervalMonthsScheduleConfigSchema.parse(config);
        case "YEARLY_DATE":
            return yearlyDateScheduleConfigSchema.parse(config);
        case "ONE_TIME":
            return oneTimeScheduleConfigSchema.parse(config);
        case "MANUAL":
            return manualScheduleConfigSchema.parse(config);
    }
}

export function buildRoutineScheduleDefinition(
    scheduleType: RoutineScheduleType,
    value: unknown,
): RoutineScheduleDefinition {
    return {
        scheduleType,
        config: parseRoutineScheduleConfig(scheduleType, value),
    } as RoutineScheduleDefinition;
}

export type RoutineBusinessDayPolicyValue = RoutineBusinessDayPolicy;
