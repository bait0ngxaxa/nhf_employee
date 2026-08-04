/**
 * Zod Validation Schemas
 * Centralized validation for API inputs
 */

// Employee validations
export { createEmployeeSchema, updateEmployeeSchema } from "./employee";
export type { CreateEmployeeInput, UpdateEmployeeInput } from "./employee";

// Ticket validations
export {
    TICKET_CATEGORIES,
    TICKET_PRIORITIES,
    TICKET_STATUSES,
    createTicketSchema,
    updateTicketSchema,
} from "./ticket";
export type { CreateTicketInput, UpdateTicketInput } from "./ticket";

// NHF Routine validations
export {
    routineTaskCreateSchema,
    routineTaskUpdateSchema,
    routineOccurrenceFiltersSchema,
    routineTaskFiltersSchema,
    routineOccurrenceStatusSchema,
    routineReasonSchema,
    routineDueDateSchema,
    routineOccurrenceAssigneesSchema,
} from "./routine";
export type {
    RoutineTaskCreateInput,
    RoutineTaskUpdateInput,
    RoutineOccurrenceFilters,
    RoutineTaskFilters,
    RoutineOccurrenceStatusInput,
    RoutineReasonInput,
    RoutineDueDateInput,
    RoutineOccurrenceAssigneesInput,
} from "./routine";

export {
    routineImportBatchIdSchema,
    routineImportApplySchema,
    routineImportPreviewOptionsSchema,
    routineImportRowUpdateSchema,
    routineImportRowsQuerySchema,
} from "./routine-import";
export type { RoutineImportRowUpdateInput } from "./routine-import";
