// Department server/application contracts.
export {
    listDepartments,
    listDepartmentReferences,
} from "./application/queries";
export type {
    DepartmentRecord,
    DepartmentReference,
} from "./application/queries";
export {
    assertDepartmentCapabilityForMigration,
    assertDepartmentCapabilityScope,
    buildDepartmentAuthorizationActor,
    buildDepartmentAuthorizationContext,
    DepartmentCapabilityDeniedError,
    DEPARTMENT_MIGRATED_CAPABILITIES,
    getDepartmentPresentationCapabilities,
    resolveDepartmentCapabilityForMigration,
} from "./application/authorization";
export type {
    DepartmentAuthorizationActor,
    DepartmentAuthorizationContext,
    DepartmentCapabilityAuthorization,
    DepartmentMigratedCapability,
} from "./application/authorization";
export type { DepartmentPresentationCapabilities } from "./application/types";
