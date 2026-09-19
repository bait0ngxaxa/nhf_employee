import {
    composeLegacyAdminCompatibleAuthorizationAuthority,
    projectAuthorizationAdministrationEffectiveAccess,
    type AuthorizationActor,
    type AuthorizationAdministrationEffectiveAccessInspection,
    type AuthorizationAdministrationInspectionContext,
    type AuthorizationDecision,
} from "@/modules/authorization";

import {
    defaultEmployeeScopes,
    EMPLOYEE_CAPABILITIES,
    type EmployeeCapability,
} from "./authorization";

const DASHBOARD_CONTEXT: AuthorizationAdministrationInspectionContext = Object.freeze({
    key: "dashboard",
    label: "Dashboard",
    channel: "DASHBOARD",
});

const LIMITATIONS = Object.freeze([
    Object.freeze({
        code: "employee.lifecycle_and_resource",
        label: "ยังต้องผ่าน Employee lifecycle และ resource predicate ของ operation",
    }),
]);

function getDecision(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: EmployeeCapability,
): AuthorizationDecision {
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(`Authorization resolver omitted Employee capability: ${capability}`);
    }
    return decision;
}

export function inspectEmployeeEffectiveAccess(
    actor: AuthorizationActor,
    decisions: ReadonlyMap<string, AuthorizationDecision>,
): readonly AuthorizationAdministrationEffectiveAccessInspection[] {
    return Object.freeze(EMPLOYEE_CAPABILITIES.map((capability) => {
        const authority = composeLegacyAdminCompatibleAuthorizationAuthority(
            actor,
            capability,
            defaultEmployeeScopes(capability),
            getDecision(decisions, capability),
        );
        return projectAuthorizationAdministrationEffectiveAccess(
            capability,
            DASHBOARD_CONTEXT,
            authority,
            LIMITATIONS,
        );
    }));
}
