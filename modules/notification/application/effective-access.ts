import {
    composeLegacyAdminCompatibleAuthorizationAuthority,
    projectAuthorizationAdministrationEffectiveAccess,
    type AuthorizationActor,
    type AuthorizationAdministrationEffectiveAccessInspection,
    type AuthorizationAdministrationInspectionContext,
    type AuthorizationDecision,
} from "@/modules/authorization";

import {
    defaultNotificationScopes,
    NOTIFICATION_CAPABILITIES,
    type NotificationCapability,
} from "./authorization";

const DASHBOARD_CONTEXT: AuthorizationAdministrationInspectionContext = Object.freeze({
    key: "dashboard",
    label: "Dashboard",
    channel: "DASHBOARD",
});

const LIMITATIONS = Object.freeze([
    Object.freeze({
        code: "notification.actor_owned",
        label: "OWN ยังคงจำกัดอยู่กับ notification ของ User ที่เป็นเจ้าของ",
    }),
]);

function getDecision(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: NotificationCapability,
): AuthorizationDecision {
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(`Authorization resolver omitted Notification capability: ${capability}`);
    }
    return decision;
}

export function inspectNotificationEffectiveAccess(
    actor: AuthorizationActor,
    decisions: ReadonlyMap<string, AuthorizationDecision>,
): readonly AuthorizationAdministrationEffectiveAccessInspection[] {
    return Object.freeze(NOTIFICATION_CAPABILITIES.map((capability) => {
        const authority = composeLegacyAdminCompatibleAuthorizationAuthority(
            actor,
            capability,
            defaultNotificationScopes(capability),
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
