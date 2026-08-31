import { z } from "zod";

import { ROUTINE_TIMING_STATUSES } from "@/lib/routine/timing";
import {
    routineIdParamSchema,
    routineTaskSelfServiceCreateSchema,
    routineTaskSelfServiceUpdateSchema,
    type RoutineTaskSelfServiceCreateInput,
    type RoutineTaskSelfServiceUpdateInput,
} from "@/lib/validations/routine";

const liffRoutineIdSchema = routineIdParamSchema.transform(Number);

export const liffRoutineTaskQuerySchema = z.object({
    taskId: liffRoutineIdSchema.optional(),
    occurrenceId: liffRoutineIdSchema.optional(),
    timingStatus: z.enum(ROUTINE_TIMING_STATUSES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type LiffRoutineTaskQuery = z.infer<
    typeof liffRoutineTaskQuerySchema
>;

export const liffRoutineTaskCreateSchema = routineTaskSelfServiceCreateSchema;
export const liffRoutineTaskUpdateSchema = routineTaskSelfServiceUpdateSchema;

export type LiffRoutineTaskCreateInput = RoutineTaskSelfServiceCreateInput;
export type LiffRoutineTaskUpdateInput = RoutineTaskSelfServiceUpdateInput;
