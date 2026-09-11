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
    evaluateAuthorization,
    getAuthorizationEvaluationContext,
} from "./evaluator";
import type {
    AuthorizationDecision,
    AuthorizationPersistenceContext,
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

        if (context.isAdmin) {
            return evaluateAuthorization(actor, capability, undefined, registry);
        }

        const resolutionData = await resolutionRepository.load({
            userId: actor.userId,
            capabilityKey: context.definition.key,
        });
        return evaluateAuthorization(
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
        resolveInTransaction,
        getScopes,
    });
}

export const authorization: AuthorizationResolver =
    createAuthorizationResolver();
