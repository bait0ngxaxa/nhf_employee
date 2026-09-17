import type { AuthorizationScope } from "../contracts";
import type { RegisteredCapabilityKey } from "../registry";
import type { ComposedAuthorizationAuthority } from "./composition";
import type {
    AuthorizationAdministrationEffectiveAccessInspection,
    AuthorizationAdministrationEffectiveAccessLimitation,
    AuthorizationAdministrationInspectionContext,
} from "./administration-types";

function freezeArray<T>(values: readonly T[]): readonly T[] {
    return Object.freeze([...values]);
}

function freezeContext(
    context: AuthorizationAdministrationInspectionContext,
): AuthorizationAdministrationInspectionContext {
    return Object.freeze({
        key: context.key,
        label: context.label,
        channel: context.channel,
    });
}

function freezeLimitations(
    limitations: readonly AuthorizationAdministrationEffectiveAccessLimitation[],
): readonly AuthorizationAdministrationEffectiveAccessLimitation[] {
    return freezeArray(
        limitations.map((limitation) => Object.freeze({
            code: limitation.code,
            label: limitation.label,
        })),
    );
}

/**
 * Projects a domain-composed authority without reimplementing composition.
 * `effectiveScopes` is optional for domains such as Routine whose channel
 * policy clamps the composed scopes after the additive union.
 */
export function projectAuthorizationAdministrationEffectiveAccess(
    capability: RegisteredCapabilityKey,
    context: AuthorizationAdministrationInspectionContext,
    authority: ComposedAuthorizationAuthority,
    limitations: readonly AuthorizationAdministrationEffectiveAccessLimitation[] = [],
    effectiveScopes: readonly AuthorizationScope[] = authority.scopes,
): AuthorizationAdministrationEffectiveAccessInspection {
    const normalizedEffectiveScopes = freezeArray(effectiveScopes);
    const state = normalizedEffectiveScopes.length > 0
        ? "AVAILABLE"
        : authority.configuredDecision.reason === "CHANNEL_NOT_SUPPORTED"
            ? "UNSUPPORTED"
            : "UNAVAILABLE";

    return Object.freeze({
        capability,
        context: freezeContext(context),
        defaultScopes: freezeArray(authority.defaultScopes),
        configuredDecision: authority.configuredDecision,
        composedScopes: freezeArray(authority.scopes),
        effectiveScopes: normalizedEffectiveScopes,
        state,
        limitations: freezeLimitations(limitations),
    });
}

export function createUnsupportedAuthorizationAdministrationInspection(
    capability: RegisteredCapabilityKey,
    context: AuthorizationAdministrationInspectionContext,
    limitations: readonly AuthorizationAdministrationEffectiveAccessLimitation[] = [],
): AuthorizationAdministrationEffectiveAccessInspection {
    return Object.freeze({
        capability,
        context: freezeContext(context),
        defaultScopes: Object.freeze([] as AuthorizationScope[]),
        configuredDecision: null,
        composedScopes: Object.freeze([] as AuthorizationScope[]),
        effectiveScopes: Object.freeze([] as AuthorizationScope[]),
        state: "UNSUPPORTED" as const,
        limitations: freezeLimitations(limitations),
    });
}

export function createDeferredAuthorizationAdministrationInspection(
    capability: RegisteredCapabilityKey,
    context: AuthorizationAdministrationInspectionContext,
    limitations: readonly AuthorizationAdministrationEffectiveAccessLimitation[] = [],
): AuthorizationAdministrationEffectiveAccessInspection {
    return Object.freeze({
        capability,
        context: freezeContext(context),
        defaultScopes: Object.freeze([] as AuthorizationScope[]),
        configuredDecision: null,
        composedScopes: Object.freeze([] as AuthorizationScope[]),
        effectiveScopes: Object.freeze([] as AuthorizationScope[]),
        state: "DEFERRED" as const,
        limitations: freezeLimitations(limitations),
    });
}
