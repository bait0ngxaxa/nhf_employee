// Employee API route contracts.
export {
    createEmployeeSchema,
    employeeFiltersSchema,
    updateEmployeeSchema,
} from "./schemas/employee";
export {
    hasEligibleCurrentEmployeeForUser,
    findCurrentEmployeeProjection,
    getCurrentWorkforceDepartmentSnapshotInTransaction,
    findLiffEmployeeByUserId,
    listEmployees,
    getEmployeeStats,
} from "./infrastructure/persistence/employee-queries";
export { createEmployee, deleteEmployee, updateEmployee } from "./application/mutations";
export {
    assertEmployeeCapability,
    assertEmployeeCapabilityScope,
    buildEmployeeAuthorizationActor,
    buildEmployeeAuthorizationContext,
    buildEmployeeAuthorizedCommandActor,
    EmployeeCapabilityDeniedError,
    EMPLOYEE_CAPABILITIES,
    getEmployeePresentationCapabilities,
    resolveEmployeeCapability,
} from "./application/authorization";
export { inspectEmployeeEffectiveAccess } from "./application/effective-access";
export type {
    EmployeeAuthorizedCommandActor,
    EmployeeAuthorizationActor,
    EmployeeAuthorizationContext,
    EmployeeCapabilityAuthorization,
    EmployeeCapability,
} from "./application/authorization";
export { resolveEmployeeCapabilityInTransaction } from "./application/authorization";
export {
    appendEmployeeCreateAudit,
    appendEmployeeDeleteAudit,
    appendEmployeeUpdateAudit,
} from "./application/audit";
export type {
    EmployeeAuditActor,
    EmployeeAuditCreateEmployee,
    EmployeeAuditDeleteInput,
    EmployeeAuditUpdateInput,
} from "./application/audit";
export { importEmployeesFromCsvRows } from "./application/import-employees";
export { createEmployeeExport } from "./infrastructure/export/employee-export";
export {
    EMPLOYEE_IMPORT_MAX_ROWS,
} from "./application/constants";
export type {
    EmployeeFilters,
    EmployeeOffboardingDependency,
    EmployeeOffboardingDependencyProvider,
    EmployeeAccountLifecycleProvider,
    EmployeeAccountLifecycleRecord,
    CurrentEmployeeProjection,
    CurrentWorkforceDepartmentSnapshot,
    EmployeePresentationCapabilities,
    LiffEmployeeIdentity,
} from "./application/types";

// Auth/workforce and signup contracts.
export { hasEligibleEmployeeLifecycle } from "./domain/lifecycle";
export {
    findSignupEmployee,
    lockAndRecheckSignupEmployee,
} from "./application/signup-employee";

// Cross-module Employee contracts.
export { applyEmployeeManagerChangesInTransaction } from "./application/hierarchy";
export {
    getEmployeeDisplayName,
    getEmployeeFullName,
} from "./domain/identity";
export type { EmployeeDisplayNameSource } from "./domain/identity";
