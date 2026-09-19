import type {
    AuthorizationActor,
    AuthorizationScope,
    CapabilityRegistry,
} from "../contracts";
import { CAPABILITY_REGISTRY } from "../registry";
import {
    AuthorizationDeniedError,
} from "./errors";
import {
    evaluateConfiguredAuthorization,
    getAuthorizationEvaluationContext,
} from "./evaluator";
import {
    evaluateLegacyAuthorization,
    shouldLoadLegacyAuthorizationPersistence,
} from "./legacy-admin-business-authority-compatibility";
import type {
    AuthorizationDecision,
    AuthorizationPersistenceContext,
    AuthorizationResolutionData,
    AuthorizationResolutionRepository,
} from "./types";
import {
    authorizationResolutionRepository,
    createAuthorizationResolutionRepository,
} from "../infrastructure/persistence/authorization-resolution-repository";

export interface AuthorizationResolverDependencies {
    readonly registry?: CapabilityRegistry;
    readonly repository?: AuthorizationResolutionRepository;
}

export interface AuthorizationResolver {
    can(
        actor: AuthorizationActor,
        capability: string,
    ): Promise<boolean>;
    require(
        actor: AuthorizationActor,
        capability: string,
    ): Promise<AuthorizationDecision>;
    resolve(
        actor: AuthorizationActor,
        capability: string,
    ): Promise<AuthorizationDecision>;
    resolveMany(
        actor: AuthorizationActor,
        capabilities: readonly string[],
    ): Promise<ReadonlyMap<string, AuthorizationDecision>>;
    resolveInTransaction(
        actor: AuthorizationActor,
        capability: string,
        persistenceContext: AuthorizationPersistenceContext,
    ): Promise<AuthorizationDecision>;
    getScopes(
        actor: AuthorizationActor,
        capability: string,
    ): Promise<readonly AuthorizationScope[]>;
}

type AuthorizationEvaluationFunction = (
    actor: AuthorizationActor,
    capability: string,
    resolutionData: AuthorizationResolutionData | undefined,
    registry: CapabilityRegistry,
) => AuthorizationDecision;

interface AuthorizationResolutionStrategy {
    readonly shouldLoadConfiguredResolution: (
        actor: AuthorizationActor,
    ) => boolean;
    readonly evaluate: AuthorizationEvaluationFunction;
}

const ROLE_NEUTRAL_CONFIGURED_RESOLUTION: AuthorizationResolutionStrategy =
    Object.freeze({
        shouldLoadConfiguredResolution: (): boolean => true,
        evaluate: (
            actor: AuthorizationActor,
            capability: string,
            resolutionData: AuthorizationResolutionData | undefined,
            registry: CapabilityRegistry,
        ): AuthorizationDecision => evaluateConfiguredAuthorization(
            actor,
            capability,
            resolutionData,
            registry,
        ),
    });

const LEGACY_ADMIN_BUSINESS_AUTHORITY_COMPATIBILITY:
    AuthorizationResolutionStrategy = Object.freeze({
        shouldLoadConfiguredResolution: shouldLoadLegacyAuthorizationPersistence,
        evaluate: (
            actor: AuthorizationActor,
            capability: string,
            resolutionData: AuthorizationResolutionData | undefined,
            registry: CapabilityRegistry,
        ): AuthorizationDecision => evaluateLegacyAuthorization(
            actor,
            capability,
            resolutionData,
            registry,
        ),
    });

function selectResolutionDataForCapability(
    resolutionData: AuthorizationResolutionData,
    capability: string,
): AuthorizationResolutionData {
    return {
        userGrants: resolutionData.userGrants.filter(
            (grant) => grant.capabilityKey === capability,
        ),
        memberships: resolutionData.memberships.map((membership) => ({
            ...membership,
            teamGrants: membership.teamGrants.filter(
                (grant) => grant.capabilityKey === capability,
            ),
        })),
        teamRoleGrants: resolutionData.teamRoleGrants.filter(
            (grant) => grant.capabilityKey === capability,
        ),
    };
}

export function createAuthorizationResolver(
    dependencies: AuthorizationResolverDependencies = {},
): AuthorizationResolver {
    return createAuthorizationResolverWithStrategy(
        dependencies,
        LEGACY_ADMIN_BUSINESS_AUTHORITY_COMPATIBILITY,
    );
}

/**
 * Internal Phase 12H-B target factory. It shares the production resolver
 * pipeline but always loads configured grants before role-neutral evaluation.
 * The default `authorization` singleton deliberately does not use it until
 * later phases rebaseline domain defaults and perform enforcement cutover.
 */
export function createRoleNeutralAuthorizationResolver(
    dependencies: AuthorizationResolverDependencies = {},
): AuthorizationResolver {
    return createAuthorizationResolverWithStrategy(
        dependencies,
        ROLE_NEUTRAL_CONFIGURED_RESOLUTION,
    );
}

function createAuthorizationResolverWithStrategy(
    dependencies: AuthorizationResolverDependencies,
    strategy: AuthorizationResolutionStrategy,
): AuthorizationResolver {
    const registry = dependencies.registry ?? CAPABILITY_REGISTRY;
    const repository =
        dependencies.repository ?? authorizationResolutionRepository;

    const resolveWithRepository = async (
        actor: AuthorizationActor,
        capability: string,
        resolutionRepository: AuthorizationResolutionRepository,
    ): Promise<AuthorizationDecision> => {
        const context = getAuthorizationEvaluationContext(
            actor,
            capability,
            registry,
        );
        if ("decision" in context) {
            return context.decision;
        }

        if (!strategy.shouldLoadConfiguredResolution(actor)) {
            return strategy.evaluate(actor, capability, undefined, registry);
        }

        const resolutionData = await resolutionRepository.load({
            userId: actor.userId,
            capabilityKey: context.definition.key,
        });
        return strategy.evaluate(
            actor,
            capability,
            resolutionData,
            registry,
        );
    };

    const resolve = async (
        actor: AuthorizationActor,
        capability: string,
    ): Promise<AuthorizationDecision> =>
        resolveWithRepository(actor, capability, repository);

    const resolveMany = async (
        actor: AuthorizationActor,
        capabilities: readonly string[],
    ): Promise<ReadonlyMap<string, AuthorizationDecision>> => {
        const decisions = new Map<string, AuthorizationDecision>();
        const capabilitiesToResolve: Array<{
            readonly capability: string;
            readonly definitionKey: string;
        }> = [];

        for (const capability of new Set(capabilities)) {
            const context = getAuthorizationEvaluationContext(
                actor,
                capability,
                registry,
            );
            if ("decision" in context) {
                decisions.set(capability, context.decision);
                continue;
            }

            if (!strategy.shouldLoadConfiguredResolution(actor)) {
                decisions.set(
                    capability,
                    strategy.evaluate(
                        actor,
                        capability,
                        undefined,
                        registry,
                    ),
                );
                continue;
            }

            capabilitiesToResolve.push({
                capability,
                definitionKey: context.definition.key,
            });
        }

        if (capabilitiesToResolve.length === 0) return decisions;

        const resolutionData = await repository.loadMany({
            userId: actor.userId,
            capabilityKeys: capabilitiesToResolve.map(
                ({ definitionKey }) => definitionKey,
            ),
        });

        for (const { capability, definitionKey } of capabilitiesToResolve) {
            decisions.set(
                capability,
                strategy.evaluate(
                    actor,
                    capability,
                    selectResolutionDataForCapability(
                        resolutionData,
                        definitionKey,
                    ),
                    registry,
                ),
            );
        }

        return decisions;
    };

    const resolveInTransaction = async (
        actor: AuthorizationActor,
        capability: string,
        persistenceContext: AuthorizationPersistenceContext,
    ): Promise<AuthorizationDecision> =>
        resolveWithRepository(
            actor,
            capability,
            createAuthorizationResolutionRepository(persistenceContext),
        );

    const can = async (
        actor: AuthorizationActor,
        capability: string,
    ): Promise<boolean> => (await resolve(actor, capability)).allowed;

    const require = async (
        actor: AuthorizationActor,
        capability: string,
    ): Promise<AuthorizationDecision> => {
        const decision = await resolve(actor, capability);
        if (!decision.allowed) {
            throw new AuthorizationDeniedError(decision);
        }
        return decision;
    };

    const getScopes = async (
        actor: AuthorizationActor,
        capability: string,
    ): Promise<readonly AuthorizationScope[]> =>
        (await resolve(actor, capability)).scopes;

    return Object.freeze({
        can,
        require,
        resolve,
        resolveMany,
        resolveInTransaction,
        getScopes,
    });
}

export const authorization: AuthorizationResolver =
    createAuthorizationResolver();
