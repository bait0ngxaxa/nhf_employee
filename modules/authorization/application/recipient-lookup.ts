import type { CapabilityRegistry } from "../contracts";
import { CAPABILITY_REGISTRY } from "../registry";
import { AuthorizationConfigurationError } from "./errors";
import type {
    AuthorizationPersistenceContext,
    AuthorizationRecipientLookupRequest,
    AuthorizationRecipientRepository,
} from "./types";
import {
    authorizationRecipientRepository,
    createAuthorizationRecipientRepository,
} from "../infrastructure/persistence/authorization-recipient-repository";

export interface AuthorizationRecipientLookup {
    /**
     * Returns active users with explicit configured authority for the exact
     * capability and scope. Domain defaults are intentionally not evaluated.
     */
    findActiveUsersWithConfiguredCapabilityScope(
        request: AuthorizationRecipientLookupRequest,
    ): Promise<readonly number[]>;
}

export interface AuthorizationRecipientLookupDependencies {
    readonly registry?: CapabilityRegistry;
    readonly repository?: AuthorizationRecipientRepository;
}

function validateLookupRequest(
    request: AuthorizationRecipientLookupRequest,
    registry: CapabilityRegistry,
): AuthorizationRecipientLookupRequest {
    const definition = registry.get(request.capability);
    if (!definition) {
        throw new AuthorizationConfigurationError(
            "UNKNOWN_PERSISTED_CAPABILITY",
            `Unknown authorization recipient capability: ${request.capability}`,
            { capabilityKey: request.capability },
        );
    }

    if (!definition.scopes.includes(request.scope)) {
        throw new AuthorizationConfigurationError(
            "UNSUPPORTED_PERSISTED_SCOPE",
            `Unsupported authorization recipient scope for ${request.capability}: ${request.scope}`,
            {
                capabilityKey: request.capability,
                scope: request.scope,
            },
        );
    }

    return {
        capability: definition.key,
        scope: request.scope,
    };
}

export function createAuthorizationRecipientLookup(
    dependencies: AuthorizationRecipientLookupDependencies = {},
): AuthorizationRecipientLookup {
    const registry = dependencies.registry ?? CAPABILITY_REGISTRY;
    const repository = dependencies.repository ?? authorizationRecipientRepository;

    return Object.freeze({
        async findActiveUsersWithConfiguredCapabilityScope(
            request: AuthorizationRecipientLookupRequest,
        ): Promise<readonly number[]> {
            const userIds = await repository.findActiveUsersWithConfiguredCapabilityScope(
                validateLookupRequest(request, registry),
            );
            return [...new Set(userIds)].sort((left, right) => left - right);
        },
    });
}

export const authorizationRecipientLookup: AuthorizationRecipientLookup =
    createAuthorizationRecipientLookup();

/**
 * Resolve against a supplied transaction when recipient eligibility must be
 * revalidated atomically with the business event or delivery state.
 */
export function findActiveUsersWithConfiguredCapabilityScope(
    request: AuthorizationRecipientLookupRequest,
    persistenceContext?: AuthorizationPersistenceContext,
): Promise<readonly number[]> {
    if (!persistenceContext) {
        return authorizationRecipientLookup.findActiveUsersWithConfiguredCapabilityScope(
            request,
        );
    }

    return createAuthorizationRecipientLookup({
        repository: createAuthorizationRecipientRepository(persistenceContext),
    }).findActiveUsersWithConfiguredCapabilityScope(request);
}

export type {
    AuthorizationRecipientLookupRequest,
    AuthorizationRecipientRepository,
};
