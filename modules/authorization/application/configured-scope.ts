import type { AuthorizationChannel, AuthorizationScope } from "../contracts";
import { CAPABILITY_REGISTRY } from "../registry";
import type { AuthorizationPersistenceContext } from "./types";
import { evaluateConfiguredAuthorization } from "./evaluator";
import { createAuthorizationResolutionRepository } from "../infrastructure/persistence/authorization-resolution-repository";

export interface ConfiguredCapabilityScopeRequest {
    readonly userId: number;
    readonly capability: string;
    readonly scope: AuthorizationScope;
    readonly channel: AuthorizationChannel;
}

/**
 * Checks one user's currently configured authority through the canonical
 * resolver repository and evaluator. Domain default policies are not applied.
 */
export async function hasConfiguredCapabilityScopeForUser(
    request: ConfiguredCapabilityScopeRequest,
    persistenceContext: AuthorizationPersistenceContext,
): Promise<boolean> {
    const definition = CAPABILITY_REGISTRY.get(request.capability);
    if (
        definition === undefined
        || !definition.scopes.includes(request.scope)
        || !definition.channels.includes(request.channel)
    ) {
        return false;
    }

    const resolutionData = await createAuthorizationResolutionRepository(
        persistenceContext,
    ).load({
        userId: request.userId,
        capabilityKey: definition.key,
    });
    const decision = evaluateConfiguredAuthorization(
        { userId: request.userId, channel: request.channel },
        request.capability,
        resolutionData,
    );

    return decision.allowed
        && (decision.scopes.includes("ALL")
            || decision.scopes.includes(request.scope));
}
