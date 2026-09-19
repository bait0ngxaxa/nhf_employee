import type {
    AuthorizationActor,
    AuthorizationScope,
    CapabilityDefinition,
    CapabilityRegistry,
} from "../contracts";
import { CAPABILITY_REGISTRY } from "../registry";
import { AuthorizationConfigurationError } from "./errors";
import { normalizeAuthorizationScopes } from "./evaluator";
import type {
    AuthorizationDecision,
    EffectiveAuthorizationGrant,
} from "./types";

/**
 * The domain-facing result of additive default-policy composition.
 *
 * `configuredDecision` and `configuredGrants` describe only authority
 * supplied by the central resolver. Default-policy authority is represented
 * by `defaultScopes` and never by a manufactured grant.
 */
export interface ComposedAuthorizationAuthority {
    readonly capability: string;
    readonly allowed: boolean;
    readonly scopes: readonly AuthorizationScope[];
    readonly defaultScopes: readonly AuthorizationScope[];
    readonly configuredDecision: AuthorizationDecision;
    readonly configuredGrants: readonly EffectiveAuthorizationGrant[];
}

/**
 * Combines a domain-provided default authority with a valid resolver result.
 *
 * The resolver remains responsible for authentication-adjacent capability
 * registration, channel validation, configured grant loading, and
 * configuration validation. This function is intentionally pure: it does not
 * load persistence or inspect domain/resource context.
 */
export function composeAuthorizationAuthority(
    _actor: AuthorizationActor,
    capability: string,
    defaultScopes: readonly AuthorizationScope[],
    configuredDecision: AuthorizationDecision,
    registry: CapabilityRegistry = CAPABILITY_REGISTRY,
): ComposedAuthorizationAuthority {
    assertMatchingCapability(capability, configuredDecision);

    const definition = registry.get(capability);
    if (
        definition === undefined
        || configuredDecision.reason === "UNKNOWN_CAPABILITY"
        || configuredDecision.reason === "CHANNEL_NOT_SUPPORTED"
        || (
            !configuredDecision.allowed
            && configuredDecision.reason !== "NO_APPLICABLE_GRANT"
        )
    ) {
        return createDeniedAuthority(capability, configuredDecision);
    }

    const configuredGrants = freezeConfiguredGrants(
        configuredDecision.grants,
    );

    const validatedDefaultScopes = validateDefaultScopes(
        defaultScopes,
        capability,
        definition,
    );
    const normalizedDefaultScopes = normalizeAuthorizationScopes(
        validatedDefaultScopes,
    );
    const configuredScopes = configuredDecision.allowed
        ? normalizeAuthorizationScopes(configuredDecision.scopes)
        : Object.freeze([] as AuthorizationScope[]);
    const scopes = normalizeAuthorizationScopes([
        ...normalizedDefaultScopes,
        ...configuredScopes,
    ]);

    return Object.freeze({
        capability,
        allowed: scopes.length > 0,
        scopes,
        defaultScopes: normalizedDefaultScopes,
        configuredDecision,
        configuredGrants,
    });
}

function assertMatchingCapability(
    capability: string,
    configuredDecision: AuthorizationDecision,
): void {
    if (configuredDecision.capability === capability) return;

    throw new AuthorizationConfigurationError(
        "CAPABILITY_MISMATCH",
        `Configured authorization capability does not match the requested capability: ${capability}`,
        {
            capabilityKey: capability,
            configuredCapabilityKey: configuredDecision.capability,
        },
    );
}

function validateDefaultScopes(
    defaultScopes: readonly AuthorizationScope[],
    capability: string,
    definition: CapabilityDefinition,
): readonly AuthorizationScope[] {
    for (const scope of defaultScopes) {
        if (!definition.scopes.includes(scope)) {
            throw new AuthorizationConfigurationError(
                "UNSUPPORTED_DEFAULT_SCOPE",
                `Default authorization scope is not supported for ${capability}: ${scope}`,
                { capabilityKey: capability, scope },
            );
        }

        if (scope === "TEAM") {
            throw new AuthorizationConfigurationError(
                "DEFAULT_TEAM_SCOPE_REQUIRES_ORIGIN",
                `Default authorization cannot provide origin-bound TEAM scope: ${capability}`,
                { capabilityKey: capability, scope },
            );
        }
    }

    return defaultScopes;
}

function createDeniedAuthority(
    capability: string,
    configuredDecision: AuthorizationDecision,
): ComposedAuthorizationAuthority {
    return Object.freeze({
        capability,
        allowed: false,
        scopes: Object.freeze([] as AuthorizationScope[]),
        defaultScopes: Object.freeze([] as AuthorizationScope[]),
        configuredDecision,
        configuredGrants: freezeConfiguredGrants(configuredDecision.grants),
    });
}

function freezeConfiguredGrants(
    grants: readonly EffectiveAuthorizationGrant[],
): readonly EffectiveAuthorizationGrant[] {
    return Object.freeze([...grants]);
}
