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
