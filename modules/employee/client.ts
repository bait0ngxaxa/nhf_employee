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

export type { EmployeePresentationCapabilities } from "./application/types";

// Pure identity formatter used by Employee-adjacent browser presentation.
export { getEmployeeDisplayName } from "./domain/identity";
