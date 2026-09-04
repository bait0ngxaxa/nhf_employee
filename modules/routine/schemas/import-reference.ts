import { z } from "zod";

const routineImportUnitReferenceSchema = z.object({
    id: z.number().int().nonnegative(),
    code: z.string(),
    name: z.string(),
    isActive: z.boolean(),
}).strict();

const routineImportCategoryReferenceSchema = z.object({
    id: z.number().int().positive(),
    name: z.string(),
    sortOrder: z.number().int(),
    isActive: z.boolean(),
}).strict();

export const routineImportEmployeeReferenceSchema = z.object({
    id: z.number().int().positive(),
    firstName: z.string(),
    lastName: z.string(),
    nickname: z.string().nullable(),
    departmentId: z.number().int().positive(),
    status: z.string().min(1),
    deletedAt: z.iso.datetime().nullable(),
    notificationReady: z.boolean().optional(),
}).strict();

export const routineImportReferenceDataSchema = z.object({
    units: z.array(routineImportUnitReferenceSchema),
    categories: z.array(routineImportCategoryReferenceSchema),
    employees: z.array(routineImportEmployeeReferenceSchema),
}).strict();

export type RoutineImportEmployeeReference = z.infer<
    typeof routineImportEmployeeReferenceSchema
>;
export type RoutineImportReferenceData = z.infer<
    typeof routineImportReferenceDataSchema
>;
