import { isAdminRole } from "@/lib/ssot/permissions";

import {
    AUTHORIZATION_SCOPES,
    type AuthorizationActor,
    type AuthorizationScope,
    type CapabilityDefinition,
    type CapabilityKey,
    type CapabilityRegistry,
} from "../contracts";
import { CAPABILITY_REGISTRY } from "../registry";
import { AuthorizationConfigurationError } from "./errors";
import type {
    AuthorizationDecision,
    AuthorizationDecisionReason,
    AuthorizationGrantSource,
    AuthorizationPersistedGrant,
    AuthorizationResolutionData,
    EffectiveAuthorizationGrant,
} from "./types";

const EMPTY_AUTHORIZATION_RESOLUTION_DATA: AuthorizationResolutionData = {
    userGrants: [],
    memberships: [],
    teamRoleGrants: [],
};

export type AuthorizationEvaluationContext =
    | {
        readonly definition: CapabilityDefinition;
        readonly isAdmin: boolean;
    }
    | {
        readonly decision: AuthorizationDecision;
    };

export function getAuthorizationEvaluationContext(
    actor: AuthorizationActor,
    capability: string,
    registry: CapabilityRegistry = CAPABILITY_REGISTRY,
): AuthorizationEvaluationContext {
    const definition = registry.get(capability);
    if (!definition) {
        return {
            decision: createDeniedDecision(capability, "UNKNOWN_CAPABILITY"),
        };
    }

    if (!definition.channels.some((channel) => channel === actor.channel)) {
        return {
            decision: createDeniedDecision(
                capability,
                "CHANNEL_NOT_SUPPORTED",
            ),
        };
    }

    return {
        definition,
        isAdmin: isAdminRole(actor.systemRole),
    };
}

export function normalizeAuthorizationScopes(
    scopes: readonly AuthorizationScope[],
): readonly AuthorizationScope[] {
    const uniqueScopes = new Set(scopes);
    if (uniqueScopes.has("ALL")) {
        return Object.freeze(["ALL"]);
    }

    return Object.freeze(
        AUTHORIZATION_SCOPES.filter((scope) => uniqueScopes.has(scope)),
    );
}

export function evaluateAuthorization(
    actor: AuthorizationActor,
    capability: string,
    resolutionData: AuthorizationResolutionData =
        EMPTY_AUTHORIZATION_RESOLUTION_DATA,
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

    if (context.isAdmin) {
        return evaluateAdminAuthorization(context.definition);
    }

    return evaluateUserAuthorization(
        actor,
        context.definition,
        resolutionData,
        registry,
    );
}

function evaluateAdminAuthorization(
    definition: CapabilityDefinition,
): AuthorizationDecision {
    const adminScopes = getAdminScopes(definition);
    const source: AuthorizationGrantSource = Object.freeze({
        type: "SYSTEM_ROLE",
        role: "ADMIN",
    });
    const grants = adminScopes.map((scope) =>
        createEffectiveGrant(definition.key, scope, source),
    );

    return createAllowedDecision(definition.key, grants);
}

function getAdminScopes(
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

function evaluateUserAuthorization(
    actor: AuthorizationActor,
    definition: CapabilityDefinition,
    resolutionData: AuthorizationResolutionData,
    registry: CapabilityRegistry,
): AuthorizationDecision {
    const grants: EffectiveAuthorizationGrant[] = [];

    for (const userGrant of resolutionData.userGrants) {
        if (userGrant.userId !== actor.userId) {
            continue;
        }

        const validatedGrant = validatePersistedGrant(
            userGrant,
            registry,
        );
        if (validatedGrant.scope === "TEAM") {
            throw new AuthorizationConfigurationError(
                "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN",
                `A direct User grant cannot provide TEAM origin: ${userGrant.capabilityKey}`,
                {
                    capabilityKey: userGrant.capabilityKey,
                    scope: validatedGrant.scope,
                },
            );
        }
        if (validatedGrant.capability !== definition.key) {
            continue;
        }

        grants.push(
            createEffectiveGrant(
                definition.key,
                validatedGrant.scope,
                Object.freeze({
                    type: "USER",
                    userId: actor.userId,
                }),
            ),
        );
    }

    for (const membership of resolutionData.memberships) {
        if (
            membership.userId !== actor.userId
            || !membership.isTeamActive
        ) {
            continue;
        }

        for (const teamGrant of membership.teamGrants) {
            if (teamGrant.teamId !== membership.teamId) {
                throw new AuthorizationConfigurationError(
                    "TEAM_GRANT_ORIGIN_MISMATCH",
                    `Team grant origin does not match its active membership: ${definition.key}`,
                    {
                        capabilityKey: definition.key,
                        scope: teamGrant.scope,
                        teamId: teamGrant.teamId,
                    },
                );
            }

            const validatedGrant = validatePersistedGrant(
                teamGrant,
                registry,
            );
            if (validatedGrant.capability !== definition.key) {
                continue;
            }
            grants.push(
                createEffectiveGrant(
                    definition.key,
                    validatedGrant.scope,
                    Object.freeze({
                        type: "TEAM",
                        teamId: membership.teamId,
                    }),
                    membership.teamId,
                ),
            );
        }

        const teamRole = membership.teamRole;
        if (
            membership.teamRoleId === null
            || teamRole === null
            || !teamRole.isActive
        ) {
            continue;
        }
        if (teamRole.id !== membership.teamRoleId) {
            throw new AuthorizationConfigurationError(
                "TEAM_ROLE_MEMBERSHIP_MISMATCH",
                "TeamRole metadata does not match the membership role identity",
                {
                    teamId: membership.teamId,
                    teamRoleId: membership.teamRoleId,
                },
            );
        }

        for (const roleGrant of resolutionData.teamRoleGrants) {
            if (roleGrant.teamRoleId !== teamRole.id) {
                continue;
            }
            if (roleGrant.teamId !== membership.teamId) {
                throw new AuthorizationConfigurationError(
                    "TEAM_ROLE_GRANT_ORIGIN_MISMATCH",
                    `TeamRole grant origin does not match its active membership: ${definition.key}`,
                    {
                        capabilityKey: definition.key,
                        scope: roleGrant.scope,
                        teamId: roleGrant.teamId,
                        teamRoleId: roleGrant.teamRoleId,
                    },
                );
            }

            const validatedGrant = validatePersistedGrant(
                roleGrant,
                registry,
            );
            if (validatedGrant.capability !== definition.key) {
                continue;
            }
            grants.push(
                createEffectiveGrant(
                    definition.key,
                    validatedGrant.scope,
                    Object.freeze({
                        type: "TEAM_ROLE",
                        teamId: membership.teamId,
                        teamRoleId: teamRole.id,
                    }),
                    membership.teamId,
                ),
            );
        }
    }

    grants.sort(compareEffectiveAuthorizationGrants);
    return createDecision(definition.key, grants);
}

function validatePersistedGrant(
    grant: AuthorizationPersistedGrant,
    registry: CapabilityRegistry,
): { readonly capability: CapabilityKey; readonly scope: AuthorizationScope } {
    const persistedDefinition = registry.get(grant.capabilityKey);
    if (!persistedDefinition) {
        throw new AuthorizationConfigurationError(
            "UNKNOWN_PERSISTED_CAPABILITY",
            `Unknown persisted authorization capability: ${grant.capabilityKey}`,
            { capabilityKey: grant.capabilityKey, scope: grant.scope },
        );
    }

    const supportedScope = persistedDefinition.scopes.find(
        (scope) => scope === grant.scope,
    );
    if (supportedScope === undefined) {
        throw new AuthorizationConfigurationError(
            "UNSUPPORTED_PERSISTED_SCOPE",
            `Unsupported persisted authorization scope for ${grant.capabilityKey}: ${grant.scope}`,
            { capabilityKey: grant.capabilityKey, scope: grant.scope },
        );
    }

    return {
        capability: persistedDefinition.key,
        scope: supportedScope,
    };
}

function createEffectiveGrant(
    capability: CapabilityKey,
    scope: AuthorizationScope,
    source: AuthorizationGrantSource,
    teamId?: number,
): EffectiveAuthorizationGrant {
    const baseGrant = {
        capability,
        scope,
        source,
    };

    if (scope !== "TEAM") {
        return Object.freeze(baseGrant);
    }

    if (teamId === undefined) {
        throw new AuthorizationConfigurationError(
            "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN",
            `TEAM scope requires an originating Team: ${capability}`,
            { capabilityKey: capability, scope },
        );
    }

    return Object.freeze({
        ...baseGrant,
        constraint: Object.freeze({ teamId }),
    });
}

function createAllowedDecision(
    capability: string,
    grants: readonly EffectiveAuthorizationGrant[],
): AuthorizationDecision {
    return createDecision(capability, grants);
}

function createDecision(
    capability: string,
    grants: readonly EffectiveAuthorizationGrant[],
): AuthorizationDecision {
    const frozenGrants = Object.freeze([...grants]);
    if (frozenGrants.length === 0) {
        return Object.freeze({
            capability,
            allowed: false,
            scopes: Object.freeze([] as AuthorizationScope[]),
            grants: frozenGrants,
            reason: "NO_APPLICABLE_GRANT" as const,
        });
    }

    return Object.freeze({
        capability,
        allowed: true,
        scopes: normalizeAuthorizationScopes(
            frozenGrants.map((grant) => grant.scope),
        ),
        grants: frozenGrants,
    });
}

function createDeniedDecision(
    capability: string,
    reason: Exclude<AuthorizationDecisionReason, "NO_APPLICABLE_GRANT">,
): AuthorizationDecision {
    return Object.freeze({
        capability,
        allowed: false,
        scopes: Object.freeze([] as AuthorizationScope[]),
        grants: Object.freeze([] as EffectiveAuthorizationGrant[]),
        reason,
    });
}

function compareEffectiveAuthorizationGrants(
    left: EffectiveAuthorizationGrant,
    right: EffectiveAuthorizationGrant,
): number {
    const sourceOrder = compareNumbers(
        getSourceOrder(left.source),
        getSourceOrder(right.source),
    );
    if (sourceOrder !== 0) return sourceOrder;

    const sourceIdentityOrder = compareSourceIdentity(left.source, right.source);
    if (sourceIdentityOrder !== 0) return sourceIdentityOrder;

    return compareNumbers(
        AUTHORIZATION_SCOPES.indexOf(left.scope),
        AUTHORIZATION_SCOPES.indexOf(right.scope),
    );
}

function getSourceOrder(source: AuthorizationGrantSource): number {
    switch (source.type) {
        case "SYSTEM_ROLE":
            return 0;
        case "TEAM":
            return 1;
        case "TEAM_ROLE":
            return 2;
        case "USER":
            return 3;
    }
}

function compareSourceIdentity(
    left: AuthorizationGrantSource,
    right: AuthorizationGrantSource,
): number {
    if (left.type === "TEAM" && right.type === "TEAM") {
        return compareNumbers(left.teamId, right.teamId);
    }
    if (left.type === "TEAM_ROLE" && right.type === "TEAM_ROLE") {
        return compareNumbers(left.teamId, right.teamId)
            || compareNumbers(left.teamRoleId, right.teamRoleId);
    }
    if (left.type === "USER" && right.type === "USER") {
        return compareNumbers(left.userId, right.userId);
    }
    return 0;
}

function compareNumbers(left: number, right: number): number {
    return left - right;
}
