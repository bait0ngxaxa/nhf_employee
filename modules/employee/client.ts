"use client";

// Temporary F1 client-safe schema seam for the existing Employee forms.
// Presentation ownership remains in legacy paths until Phase F2.
export {
    createEmployeeSchema,
    updateEmployeeSchema,
} from "./schemas/employee";
export type {
    CreateEmployeeInput,
    UpdateEmployeeInput,
} from "./schemas/employee";
