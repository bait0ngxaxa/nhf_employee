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

        const resolutionData = await resolutionRepository.load({
            userId: actor.userId,
            capabilityKey: context.definition.key,
        });
        return evaluateConfiguredAuthorization(
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
                evaluateConfiguredAuthorization(
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
