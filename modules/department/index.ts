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
    assertDepartmentCapability,
    assertDepartmentCapabilityScope,
    buildDepartmentAuthorizationActor,
    buildDepartmentAuthorizationContext,
    DepartmentCapabilityDeniedError,
    DEPARTMENT_CAPABILITIES,
    getDepartmentPresentationCapabilities,
    resolveDepartmentCapability,
} from "./application/authorization";
export { inspectDepartmentEffectiveAccess } from "./application/effective-access";
export type {
    DepartmentAuthorizationActor,
    DepartmentAuthorizationContext,
    DepartmentCapabilityAuthorization,
    DepartmentCapability,
} from "./application/authorization";
export type { DepartmentPresentationCapabilities } from "./application/types";
