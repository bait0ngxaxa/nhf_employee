import {
    CAPABILITY_REGISTRY,
    createDeferredAuthorizationAdministrationInspection,
    type AuthorizationDecision,
    type AuthorizationAdministrationEffectiveAccessInspection,
    type AuthorizationAdministrationEffectiveAccessProvider,
    type AuthorizationAdministrationEffectiveAccessProviderInput,
} from "@/modules/authorization";
import { inspectAuditEffectiveAccess } from "@/modules/audit";
import { inspectDepartmentEffectiveAccess } from "@/modules/department";
import { inspectEmployeeEffectiveAccess } from "@/modules/employee";
import { inspectLeaveEffectiveAccess } from "@/modules/leave";
import { inspectNotificationEffectiveAccess } from "@/modules/notification";
import { inspectRoutineEffectiveAccess } from "@/modules/routine";
import { inspectStockEffectiveAccess } from "@/modules/stock";

const EMAIL_CONTEXT = Object.freeze({
    key: "dashboard",
    label: "Dashboard",
    channel: "DASHBOARD" as const,
});

const DEFERRED_EMAIL_LIMITATION = Object.freeze([
    Object.freeze({
        code: "email.deferred_migration",
        label: "Email Request ยังอยู่ในสถานะ DEFERRED และยังไม่ถูก migrate เป็น effective policy",
    }),
]);

const EMAIL_CAPABILITIES = [
    "email.request.read",
    "email.request.create",
] as const;

function getLiffCapabilityKeys(): readonly string[] {
    return Object.freeze(
        CAPABILITY_REGISTRY.definitions
            .filter((definition) => definition.channels.includes("LIFF_SELF_SERVICE"))
            .map((definition) => definition.key),
    );
}

async function resolveLiffDecisions(
    input: AuthorizationAdministrationEffectiveAccessProviderInput,
): Promise<ReadonlyMap<string, AuthorizationDecision>> {
    const capabilityKeys = getLiffCapabilityKeys();
    if (capabilityKeys.length === 0) return new Map();

    const liffActor = Object.freeze({
        ...input.actor,
        channel: "LIFF_SELF_SERVICE" as const,
    });
    return input.resolver.resolveMany(liffActor, capabilityKeys);
}

function inspectDeferredEmail(): readonly AuthorizationAdministrationEffectiveAccessInspection[] {
    return Object.freeze(EMAIL_CAPABILITIES.map((capability) =>
        createDeferredAuthorizationAdministrationInspection(
            capability,
            EMAIL_CONTEXT,
            DEFERRED_EMAIL_LIMITATION,
        ),
    ));
}

export const authorizationAdministrationEffectiveAccessProvider: AuthorizationAdministrationEffectiveAccessProvider = {
    async inspect(
        input: AuthorizationAdministrationEffectiveAccessProviderInput,
    ): Promise<readonly AuthorizationAdministrationEffectiveAccessInspection[]> {
        const dashboardActor = Object.freeze({
            ...input.actor,
            channel: "DASHBOARD" as const,
        });
        const liffActor = Object.freeze({
            ...input.actor,
            channel: "LIFF_SELF_SERVICE" as const,
        });
        const liffDecisions = await resolveLiffDecisions(input);

        return Object.freeze([
            ...inspectDepartmentEffectiveAccess(
                dashboardActor,
                input.dashboardDecisions,
            ),
            ...inspectNotificationEffectiveAccess(
                dashboardActor,
                input.dashboardDecisions,
            ),
            ...inspectEmployeeEffectiveAccess(
                dashboardActor,
                input.dashboardDecisions,
            ),
            ...inspectRoutineEffectiveAccess(
                dashboardActor,
                input.dashboardDecisions,
            ),
            ...inspectRoutineEffectiveAccess(liffActor, liffDecisions),
            ...inspectStockEffectiveAccess(
                dashboardActor,
                input.dashboardDecisions,
            ),
            ...inspectStockEffectiveAccess(liffActor, liffDecisions),
            ...inspectLeaveEffectiveAccess(
                dashboardActor,
                input.dashboardDecisions,
            ),
            ...inspectLeaveEffectiveAccess(liffActor, liffDecisions),
            ...inspectAuditEffectiveAccess(
                dashboardActor,
                input.dashboardDecisions,
            ),
            ...inspectDeferredEmail(),
        ]);
    },
};
