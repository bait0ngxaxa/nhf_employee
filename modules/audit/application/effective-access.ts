import {
    composeLegacyAdminCompatibleAuthorizationAuthority,
    projectAuthorizationAdministrationEffectiveAccess,
    type AuthorizationActor,
    type AuthorizationAdministrationEffectiveAccessInspection,
    type AuthorizationAdministrationInspectionContext,
    type AuthorizationDecision,
} from "@/modules/authorization";

import { AUDIT_MIGRATED_CAPABILITIES } from "./authorization";

const DASHBOARD_CONTEXT: AuthorizationAdministrationInspectionContext = Object.freeze({
    key: "dashboard",
    label: "Dashboard",
    channel: "DASHBOARD",
});

const LIMITATIONS = Object.freeze([
    Object.freeze({
        code: "audit.server_resource",
        label: "Audit query, retention และ record visibility ยังเป็น server-owned rules",
    }),
]);

export function inspectAuditEffectiveAccess(
    actor: AuthorizationActor,
    decisions: ReadonlyMap<string, AuthorizationDecision>,
): readonly AuthorizationAdministrationEffectiveAccessInspection[] {
    const capability = AUDIT_MIGRATED_CAPABILITIES[0];
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(`Authorization resolver omitted Audit capability: ${capability}`);
    }
    const authority = composeLegacyAdminCompatibleAuthorizationAuthority(
        actor,
        capability,
        [],
        decision,
    );
    return Object.freeze([
        projectAuthorizationAdministrationEffectiveAccess(
            capability,
            DASHBOARD_CONTEXT,
            authority,
            LIMITATIONS,
        ),
    ]);
}
