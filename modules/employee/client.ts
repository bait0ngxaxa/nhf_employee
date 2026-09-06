"use client";

// Client-safe route-facing Employee presentation entry point.
export {
    EmployeeManagementSection,
} from "./presentation/dashboard/EmployeeManagementSection";
export {
    EmployeeManagementSectionSkeleton,
} from "./presentation/dashboard/EmployeeSkeletons";
export { AddEmployeeSection } from "./presentation/dashboard/AddEmployeeSection";
export {
    ImportEmployeeRouteContent,
} from "./presentation/import/ImportEmployeeRouteContent";

// Compatibility exports retained for the F1 validation facade until F3.
export {
    createEmployeeSchema,
    updateEmployeeSchema,
} from "./schemas/employee";
export type {
    CreateEmployeeInput,
    UpdateEmployeeInput,
} from "./schemas/employee";
