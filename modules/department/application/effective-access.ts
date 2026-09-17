import {
    composeAuthorizationAuthority,
    projectAuthorizationAdministrationEffectiveAccess,
    type AuthorizationActor,
    type AuthorizationAdministrationEffectiveAccessInspection,
    type AuthorizationAdministrationInspectionContext,
    type AuthorizationDecision,
} from "@/modules/authorization";

import {
    defaultDepartmentScopes,
    DEPARTMENT_CAPABILITIES,
    type DepartmentCapability,
} from "./authorization";

const DASHBOARD_CONTEXT: AuthorizationAdministrationInspectionContext = Object.freeze({
    key: "dashboard",
    label: "Dashboard",
    channel: "DASHBOARD",
});

const LIMITATIONS = Object.freeze([
    Object.freeze({
        code: "department.resource_scope",
        label: "ยังต้องผ่าน resource predicate ของข้อมูล Department",
    }),
]);

function getDecision(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: DepartmentCapability,
): AuthorizationDecision {
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(`Authorization resolver omitted Department capability: ${capability}`);
    }
    return decision;
}

export function inspectDepartmentEffectiveAccess(
    actor: AuthorizationActor,
    decisions: ReadonlyMap<string, AuthorizationDecision>,
): readonly AuthorizationAdministrationEffectiveAccessInspection[] {
    return Object.freeze(DEPARTMENT_CAPABILITIES.map((capability) => {
        const authority = composeAuthorizationAuthority(
            actor,
            capability,
            defaultDepartmentScopes(capability),
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
