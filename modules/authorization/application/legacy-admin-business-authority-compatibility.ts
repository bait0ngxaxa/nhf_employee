import { isAdminRole } from "@/lib/ssot/permissions";

import type {
    AuthorizationActor,
    AuthorizationScope,
    CapabilityDefinition,
    CapabilityRegistry,
} from "../contracts";
import { CAPABILITY_REGISTRY } from "../registry";
import {
    composeAuthorizationAuthority,
    type ComposedAuthorizationAuthority,
} from "./composition";
import { AuthorizationConfigurationError } from "./errors";
import {
    evaluateConfiguredAuthorization,
    getAuthorizationEvaluationContext,
    normalizeAuthorizationScopes,
} from "./evaluator";
import type {
    AuthorizationDecision,
    AuthorizationResolutionData,
} from "./types";

/**
 * Temporary migration boundary for the pre-12H ADMIN business semantics.
 *
 * This is intentionally the only application seam that can manufacture the
 * legacy SYSTEM_ROLE / ADMIN business grant or preserve its no-persistence
 * resolver behavior. Phase 12H-G enforcement cutover must remove this seam
 * after domain defaults and configured grants have been rebaselined.
 */
export function evaluateLegacyAuthorization(
    actor: AuthorizationActor,
    capability: string,
    resolutionData?: AuthorizationResolutionData,
    registry: CapabilityRegistry = CAPABILITY_REGISTRY,
): AuthorizationDecision {
    const context = getAuthorizationEvaluationContext(
        actor,
        capability,
        registry,
    );
    if ("decision" in context) {
        return context.decision;
    }

    if (!isAdminRole(actor.systemRole)) {
        return evaluateConfiguredAuthorization(
            actor,
            capability,
            resolutionData,
            registry,
        );
    }

    return createLegacyAdminBusinessAuthority(context.definition);
}

/**
 * The legacy resolver intentionally does not load configured persistence for
 * ADMIN. The role-neutral resolver path must not use this predicate.
 */
export function shouldLoadLegacyAuthorizationPersistence(
    actor: AuthorizationActor,
): boolean {
    return !isAdminRole(actor.systemRole);
}

/**
 * Keep current production adapters on their pre-12H ADMIN projection while
 * the shared composition primitive remains permanently role-neutral.
 *
 * The wrapper only applies to a resolver decision that explicitly contains
 * the temporary SYSTEM_ROLE grant. It delegates the actual union, validation,
 * normalization, provenance, and fail-closed behavior to the role-neutral
 * composition primitive.
 */
export function composeLegacyAdminCompatibleAuthorizationAuthority(
    actor: AuthorizationActor,
    capability: string,
    defaultScopes: readonly AuthorizationScope[],
    configuredDecision: AuthorizationDecision,
    registry: CapabilityRegistry = CAPABILITY_REGISTRY,
): ComposedAuthorizationAuthority {
    const hasLegacyAdminGrant = configuredDecision.grants.some(
        (grant) => grant.source.type === "SYSTEM_ROLE",
    );
    const compatibilityDefaultScopes = hasLegacyAdminGrant
        ? []
        : defaultScopes;

    return composeAuthorizationAuthority(
        actor,
        capability,
        compatibilityDefaultScopes,
        configuredDecision,
        registry,
    );
}

function createLegacyAdminBusinessAuthority(
    definition: CapabilityDefinition,
): AuthorizationDecision {
    const scopes = getLegacyAdminScopes(definition);
    const grants = scopes.map((scope) =>
        Object.freeze({
            capability: definition.key,
            scope,
            source: Object.freeze({
                type: "SYSTEM_ROLE" as const,
                role: "ADMIN" as const,
            }),
        }),
    );

    return Object.freeze({
        capability: definition.key,
        allowed: true,
        scopes: normalizeAuthorizationScopes(scopes),
        grants: Object.freeze(grants),
    });
}

function getLegacyAdminScopes(
    definition: CapabilityDefinition,
): readonly AuthorizationScope[] {
    if (definition.scopes.includes("ALL")) {
        return ["ALL"];
    }

    const nonTeamScopes = definition.scopes.filter((scope) => scope !== "TEAM");
    const normalizedScopes = normalizeAuthorizationScopes(nonTeamScopes);
    if (normalizedScopes.length === 0) {
        throw new AuthorizationConfigurationError(
            "UNSUPPORTED_ADMIN_TEAM_SCOPE",
            `ADMIN cannot resolve a capability with only an origin-bound TEAM scope: ${definition.key}`,
            { capabilityKey: definition.key },
        );
    }

    return normalizedScopes;
}
