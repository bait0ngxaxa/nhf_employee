import { z } from "zod";

import { ROUTINE_TIMING_STATUSES } from "@/lib/routine/timing";
import {
    routineTaskSelfServiceCreateSchema,
    routineTaskSelfServiceUpdateSchema,
    type RoutineTaskSelfServiceCreateInput,
    type RoutineTaskSelfServiceUpdateInput,
} from "@/lib/validations/routine";

export const liffRoutineTaskQuerySchema = z.object({
    taskId: z.coerce.number().int().positive().optional(),
    occurrenceId: z.coerce.number().int().positive().optional(),
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
