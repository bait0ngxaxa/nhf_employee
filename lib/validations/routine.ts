import { z } from "zod";

import {
    ROUTINE_BUSINESS_DAY_POLICIES,
    ROUTINE_MAX_REMINDER_DAYS_BEFORE,
    ROUTINE_SCHEDULE_TYPES,
    ROUTINE_SCHEDULE_LIMITS,
    daysInMonth,
    type YearlyDateScheduleConfig,
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

function boundedIntegerSchema(
    min: number,
    max: number,
    message: string,
) {
    return z.preprocess(
        emptyToUndefined,
        z.coerce.number({ error: message })
            .int(message)
            .min(min, message)
            .max(max, message),
    );
}

const monthlyDayScheduleConfigSchema = z.strictObject({
    day: boundedIntegerSchema(
        ROUTINE_SCHEDULE_LIMITS.day.min,
        ROUTINE_SCHEDULE_LIMITS.day.max,
        "กรุณาระบุวันที่ตั้งแต่ 1 ถึง 31",
    ),
    monthOffset: z.preprocess(emptyToUndefined, z.coerce.number().int().min(-120).max(120)).default(0),
});

const monthEndScheduleConfigSchema = z.strictObject({});

const intervalMonthsScheduleConfigSchema = z.strictObject({
    intervalMonths: boundedIntegerSchema(
        ROUTINE_SCHEDULE_LIMITS.intervalMonths.min,
        ROUTINE_SCHEDULE_LIMITS.intervalMonths.max,
        "กรุณาระบุรอบเดือนตั้งแต่ 1 ถึง 120",
    ),
    anchorDate: dateSchema,
});

const yearlyDateScheduleConfigSchema = z.strictObject({
    month: boundedIntegerSchema(
        ROUTINE_SCHEDULE_LIMITS.month.min,
        ROUTINE_SCHEDULE_LIMITS.month.max,
        "กรุณาระบุเดือนตั้งแต่ 1 ถึง 12",
    ),
    day: boundedIntegerSchema(
        ROUTINE_SCHEDULE_LIMITS.day.min,
        ROUTINE_SCHEDULE_LIMITS.day.max,
        "กรุณาระบุวันที่ตั้งแต่ 1 ถึง 31",
    ),
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
    daysBefore: z.preprocess(
        emptyToUndefined,
        z.coerce.number().int().min(0).max(ROUTINE_MAX_REMINDER_DAYS_BEFORE),
    ),
    sendHour: z.preprocess(
        emptyToUndefined,
        z.coerce.number().int().min(0).max(23),
    ),
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

export function validateRoutineScheduleConfig(
    scheduleType: RoutineScheduleType,
    value: unknown,
    ctx: z.RefinementCtx,
): void {
    try {
        const config = parseRoutineScheduleConfig(scheduleType, value);
        if (
            scheduleType === "YEARLY_DATE"
            && (config as YearlyDateScheduleConfig).day
                > daysInMonth(2024, (config as YearlyDateScheduleConfig).month)
        ) {
            ctx.addIssue({
                code: "custom",
                path: ["scheduleConfig", "day"],
                message: "เดือนและวันที่กำหนดไม่สัมพันธ์กัน",
            });
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            error.issues.forEach((issue) => {
                ctx.addIssue({
                    code: "custom",
                    path: ["scheduleConfig", ...issue.path],
                    message: issue.message,
                });
            });
            return;
        }
        const path = scheduleType === "ONE_TIME"
            ? ["scheduleConfig", "date"]
            : ["scheduleConfig"];
        ctx.addIssue({
            code: "custom",
            path,
            message: "กำหนดค่าตารางงานประจำไม่ถูกต้อง",
        });
    }
}

function validateRoutineTaskScheduleAndContract(
    data: {
        scheduleType?: RoutineScheduleType;
        scheduleConfig?: unknown;
        contractStartDate?: string | null;
        contractEndDate?: string | null;
    },
    ctx: z.RefinementCtx,
): void {
    if (data.scheduleType !== undefined) {
        validateRoutineScheduleConfig(data.scheduleType, data.scheduleConfig, ctx);
    }
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
}

const routineTaskCreateFields = {
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
} as const;

const routineTaskUpdateFields = {
    version: z.coerce.number().int().positive("เวอร์ชันไม่ถูกต้อง"),
    unitId: routineTaskCreateFields.unitId.optional(),
    categoryId: routineTaskCreateFields.categoryId.optional(),
    title: routineTaskCreateFields.title.optional(),
    description: routineTaskCreateFields.description,
    scheduleType: routineTaskCreateFields.scheduleType.optional(),
    scheduleConfig: routineTaskCreateFields.scheduleConfig,
    scheduleText: routineTaskCreateFields.scheduleText,
    contractStartDate: routineTaskCreateFields.contractStartDate,
    contractEndDate: routineTaskCreateFields.contractEndDate,
    contractText: routineTaskCreateFields.contractText,
    extraDetails: routineTaskCreateFields.extraDetails,
    businessDayPolicy: routineBusinessDayPolicySchema.optional(),
    isActive: z.boolean().optional(),
    assignees: routineTaskCreateFields.assignees.optional(),
    sourceFileName: routineTaskCreateFields.sourceFileName,
    sourceSheet: routineTaskCreateFields.sourceSheet,
    sourceRow: routineTaskCreateFields.sourceRow,
    reminderRules: routineTaskCreateFields.reminderRules,
} as const;

export const routineTaskCreateSchema = z
    .object(routineTaskCreateFields)
    .superRefine((data, ctx) => {
        validateAssigneeList(data.assignees, ctx);
        validateRoutineTaskScheduleAndContract(data, ctx);
    });

export const routineTaskUpdateSchema = z
    .object(routineTaskUpdateFields)
    .superRefine((data, ctx) => {
        if (data.assignees) validateAssigneeList(data.assignees, ctx);
        validateRoutineTaskScheduleAndContract(data, ctx);
    });

export const routineTaskSelfServiceCreateSchema = z
    .strictObject({
        unitId: routineTaskCreateFields.unitId,
        categoryId: routineTaskCreateFields.categoryId,
        title: routineTaskCreateFields.title,
        description: routineTaskCreateFields.description,
        scheduleType: routineTaskCreateFields.scheduleType,
        scheduleConfig: routineTaskCreateFields.scheduleConfig,
        scheduleText: routineTaskCreateFields.scheduleText,
        contractStartDate: routineTaskCreateFields.contractStartDate,
        contractEndDate: routineTaskCreateFields.contractEndDate,
        contractText: routineTaskCreateFields.contractText,
        extraDetails: routineTaskCreateFields.extraDetails,
        businessDayPolicy: routineTaskCreateFields.businessDayPolicy,
        isActive: routineTaskCreateFields.isActive,
        reminderRules: routineTaskCreateFields.reminderRules,
    })
    .superRefine(validateRoutineTaskScheduleAndContract);

export const routineTaskSelfServiceUpdateSchema = z
    .strictObject({
        version: routineTaskUpdateFields.version,
        unitId: routineTaskUpdateFields.unitId,
        categoryId: routineTaskUpdateFields.categoryId,
        title: routineTaskUpdateFields.title,
        description: routineTaskUpdateFields.description,
        scheduleType: routineTaskUpdateFields.scheduleType,
        scheduleConfig: routineTaskUpdateFields.scheduleConfig,
        scheduleText: routineTaskUpdateFields.scheduleText,
        contractStartDate: routineTaskUpdateFields.contractStartDate,
        contractEndDate: routineTaskUpdateFields.contractEndDate,
        contractText: routineTaskUpdateFields.contractText,
        extraDetails: routineTaskUpdateFields.extraDetails,
        businessDayPolicy: routineTaskUpdateFields.businessDayPolicy,
        isActive: routineTaskUpdateFields.isActive,
        reminderRules: routineTaskUpdateFields.reminderRules,
    })
    .superRefine(validateRoutineTaskScheduleAndContract);

export const routineOccurrenceFiltersSchema = z.object({
    occurrenceId: z.coerce.number().int().positive().optional(),
    taskId: z.coerce.number().int().positive().optional(),
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

export const routineSummaryQuerySchema = z.object({
    scope: z.enum(["mine", "all"]).default("mine"),
});

export const ROUTINE_TASK_STATUS_FILTERS = ["active", "inactive"] as const;
export type RoutineTaskStatusFilter = (typeof ROUTINE_TASK_STATUS_FILTERS)[number];

export const routineTaskFiltersSchema = z.object({
    activeOnly: z
        .enum(["0", "1"])
        .optional()
        .transform((value) => value === "1" ? true : undefined),
    status: z.enum(ROUTINE_TASK_STATUS_FILTERS).optional(),
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
    expectedReminderVersion: z.coerce.number().int().positive(),
    dueDate: dateSchema,
    note: optionalText(1000),
});

export const routineOccurrenceAssigneesSchema = z
    .object({
        expectedReminderVersion: z.coerce.number().int().positive(),
        assignees: z
            .array(routineAssigneeSchema)
            .min(1, "กรุณาระบุผู้รับผิดชอบ")
            .max(100, "ผู้รับผิดชอบมีได้ไม่เกิน 100 คน"),
    })
    .superRefine((data, ctx) => validateAssigneeList(data.assignees, ctx));

export const routineOccurrenceOverrideSchema = z
    .object({
        expectedReminderVersion: z.coerce.number().int().positive(),
        dueDate: dateSchema,
        note: optionalText(1000),
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

export const routineReminderEmailOutboxPayloadSchema = z.object({
    to: z.string().email().max(320).refine((value) => !/[\r\n]/.test(value)),
    recipientName: z.string().trim().min(1).max(255),
    taskTitle: z.string().min(1).max(255),
    unitName: z.string().min(1).max(255),
    categoryName: z.string().min(1).max(255),
    dueDate: dateSchema,
    daysBefore: z.number().int().nonnegative(),
    actionUrl: z.string().min(1).max(2048),
    occurrenceId: z.number().int().positive(),
    ruleId: z.number().int().positive(),
    userId: z.number().int().positive(),
    reminderVersion: z.number().int().positive(),
});

const lineRetryKeySchema = z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "LINE retry key must be a UUID",
);

export const routineReminderLineOutboxPayloadSchema = z.object({
    occurrenceId: z.number().int().positive(),
    taskId: z.number().int().positive(),
    ruleId: z.number().int().positive(),
    userId: z.number().int().positive(),
    reminderVersion: z.number().int().positive(),
    taskTitle: z.string().min(1).max(255),
    unitName: z.string().min(1).max(255),
    categoryName: z.string().min(1).max(255),
    dueDate: dateSchema,
    daysBefore: z.number().int().nonnegative(),
    scheduledFor: z.iso.datetime(),
    isAssignee: z.boolean(),
    retryKey: lineRetryKeySchema,
});

export const routineContractExpiryOutboxPayloadSchema = z.object({
    taskId: z.number().int().positive(),
    contractEndDate: dateSchema,
    notificationDate: dateSchema,
    scheduledFor: z.iso.datetime(),
    createdAt: z.iso.datetime(),
});

export const routineContractExpiryEmailOutboxPayloadSchema = z.object({
    taskId: z.number().int().positive(),
    userId: z.number().int().positive(),
    contractEndDate: dateSchema,
});

export const routineContractExpiryLineOutboxPayloadSchema =
    routineContractExpiryEmailOutboxPayloadSchema.extend({
        retryKey: lineRetryKeySchema,
    });

export type RoutineTaskCreateInput = z.infer<typeof routineTaskCreateSchema>;
export type RoutineTaskUpdateInput = z.infer<typeof routineTaskUpdateSchema>;
export type RoutineTaskSelfServiceCreateInput = z.infer<
    typeof routineTaskSelfServiceCreateSchema
>;
export type RoutineTaskSelfServiceUpdateInput = z.infer<
    typeof routineTaskSelfServiceUpdateSchema
>;
export type RoutineOccurrenceFilters = z.infer<
    typeof routineOccurrenceFiltersSchema
>;
export type RoutineSummaryScope = z.infer<typeof routineSummaryQuerySchema>["scope"];
export type RoutineTaskFilters = z.infer<typeof routineTaskFiltersSchema>;
export type RoutineDueDateInput = z.infer<typeof routineDueDateSchema>;
export type RoutineOccurrenceAssigneesInput = z.infer<
    typeof routineOccurrenceAssigneesSchema
>;
export type RoutineOccurrenceOverrideInput = z.infer<
    typeof routineOccurrenceOverrideSchema
>;
export type RoutineReminderRuleInput = z.infer<typeof routineReminderRuleSchema>;
export type RoutineReminderOutboxPayload = z.infer<
    typeof routineReminderOutboxPayloadSchema
>;
export type RoutineReminderEmailOutboxPayload = z.infer<
    typeof routineReminderEmailOutboxPayloadSchema
>;
export type RoutineReminderLineOutboxPayload = z.infer<
    typeof routineReminderLineOutboxPayloadSchema
>;
export type RoutineContractExpiryOutboxPayload = z.infer<
    typeof routineContractExpiryOutboxPayloadSchema
>;
export type RoutineContractExpiryEmailOutboxPayload = z.infer<
    typeof routineContractExpiryEmailOutboxPayloadSchema
>;
export type RoutineContractExpiryLineOutboxPayload = z.infer<
    typeof routineContractExpiryLineOutboxPayloadSchema
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
