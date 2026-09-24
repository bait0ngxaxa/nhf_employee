import type { UserRole } from "@/lib/ssot/permissions";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import {
    authorization,
    composeAuthorizationAuthority,
    type AuthorizationActor,
    type AuthorizationDecision,
    type AuthorizationPersistenceContext,
    type AuthorizationScope,
    type ComposedAuthorizationAuthority,
} from "@/modules/authorization";

import type {
    ITCapabilityScopes,
    ITPresentationCapabilities,
    ITTicketResourceScope,
} from "./types";

export const IT_CAPABILITIES = Object.freeze([
    "it.ticket.read",
    "it.ticket.create",
    "it.ticket.comment",
    "it.ticket.manage",
    "it.analytics.read",
] as const);

export type ITCapability = (typeof IT_CAPABILITIES)[number];

export type ITAuthorizationActor = AuthorizationActor & {
    readonly channel: "DASHBOARD";
};

export interface ITAuthorizationContext {
    readonly authorizationActor: ITAuthorizationActor;
}

export interface ITCapabilityAuthorization {
    readonly actor: ITAuthorizationActor;
    readonly capability: ITCapability;
    readonly decision: AuthorizationDecision;
    readonly defaultScopes: readonly AuthorizationScope[];
    readonly scopes: readonly AuthorizationScope[];
}

export class ITCapabilityDeniedError extends Error {
    readonly authorizationReason: AuthorizationDecision["reason"];
    readonly capability: string;
    readonly statusCode = 403;

    constructor(
        capability: string,
        reason: AuthorizationDecision["reason"],
    ) {
        super("คุณไม่มีสิทธิ์ดำเนินการ");
        this.name = "ITCapabilityDeniedError";
        this.capability = capability;
        this.authorizationReason = reason;
    }
}

const IT_CAPABILITY_SET = new Set<string>(IT_CAPABILITIES);
const OWN_DEFAULT_SCOPES = Object.freeze(["OWN"] as const);
const NO_DEFAULT_SCOPES = Object.freeze([] as const);

function isITCapability(capability: string): capability is ITCapability {
    return IT_CAPABILITY_SET.has(capability);
}

function parseUserRole(role: string): UserRole {
    if (role === "ADMIN" || role === "USER") return role;
    throw new WorkforceAuthorizationError();
}

export function buildITAuthorizationActor(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null,
): ITAuthorizationActor {
    return Object.freeze({
        userId: user.id,
        employeeId,
        systemRole: parseUserRole(user.role),
        channel: "DASHBOARD" as const,
    });
}

export function buildITAuthorizationContext(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null,
): ITAuthorizationContext {
    return Object.freeze({
        authorizationActor: buildITAuthorizationActor(user, employeeId),
    });
}

export function defaultITScopes(
    _actor: ITAuthorizationActor,
    capability: ITCapability,
): readonly AuthorizationScope[] {
    switch (capability) {
        case "it.ticket.read":
        case "it.ticket.create":
        case "it.ticket.comment":
            return OWN_DEFAULT_SCOPES;
        case "it.ticket.manage":
        case "it.analytics.read":
            return NO_DEFAULT_SCOPES;
    }
}

function buildITCapabilityAuthorization(
    actor: ITAuthorizationActor,
    capability: string,
    authority: ComposedAuthorizationAuthority,
): ITCapabilityAuthorization {
    if (!isITCapability(capability)) {
        throw new ITCapabilityDeniedError(
            capability,
            authority.configuredDecision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    if (!authority.allowed) {
        throw new ITCapabilityDeniedError(
            capability,
            authority.configuredDecision.reason,
        );
    }

    return Object.freeze({
        actor,
        capability,
        decision: authority.configuredDecision,
        defaultScopes: authority.defaultScopes,
        scopes: authority.scopes,
    });
}

function composeITCapabilityAuthorization(
    actor: ITAuthorizationActor,
    capability: string,
    decision: AuthorizationDecision,
): ITCapabilityAuthorization {
    if (!isITCapability(capability)) {
        throw new ITCapabilityDeniedError(
            capability,
            decision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    const authority = composeAuthorizationAuthority(
        actor,
        capability,
        defaultITScopes(actor, capability),
        decision,
    );
    return buildITCapabilityAuthorization(actor, capability, authority);
}

function getITPresentationDecision(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: ITCapability,
): AuthorizationDecision {
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(
            `Authorization resolver omitted IT capability: ${capability}`,
        );
    }
    return decision;
}

function projectITCapabilityScopes(
    actor: ITAuthorizationActor,
    capability: ITCapability,
    decision: AuthorizationDecision,
): ITCapabilityScopes | null {
    try {
        return composeITCapabilityAuthorization(actor, capability, decision).scopes;
    } catch (error) {
        if (error instanceof ITCapabilityDeniedError) return null;
        throw error;
    }
}

function hasITScope(
    scopes: ITCapabilityScopes | null,
    scope: AuthorizationScope,
): boolean {
    return scopes?.includes(scope) === true || scopes?.includes("ALL") === true;
}

export async function resolveITCapability(
    context: ITAuthorizationContext,
    capability: string,
): Promise<ITCapabilityAuthorization> {
    const actor = context.authorizationActor;
    if (!isITCapability(capability)) {
        throw new ITCapabilityDeniedError(capability, "UNKNOWN_CAPABILITY");
    }

    const decision = await authorization.resolve(actor, capability);
    return composeITCapabilityAuthorization(actor, capability, decision);
}

export async function assertITCapability(
    context: ITAuthorizationContext,
    capability: string,
): Promise<ITCapabilityAuthorization> {
    return resolveITCapability(context, capability);
}

/**
 * Transaction-aware variant for future IT mutations. The caller remains
 * responsible for binding this context to a current active-workforce identity.
 */
export async function resolveITCapabilityInTransaction(
    context: ITAuthorizationContext,
    capability: string,
    persistenceContext: AuthorizationPersistenceContext,
): Promise<ITCapabilityAuthorization> {
    const actor = context.authorizationActor;
    if (!isITCapability(capability)) {
        throw new ITCapabilityDeniedError(capability, "UNKNOWN_CAPABILITY");
    }

    const decision = await authorization.resolveInTransaction(
        actor,
        capability,
        persistenceContext,
    );
    return composeITCapabilityAuthorization(actor, capability, decision);
}

export async function getITPresentationCapabilities(
    context: ITAuthorizationContext,
): Promise<ITPresentationCapabilities> {
    const actor = context.authorizationActor;
    const decisions = await authorization.resolveMany(actor, IT_CAPABILITIES);
    const project = (
        capability: ITCapability,
    ): ITCapabilityScopes | null => projectITCapabilityScopes(
        actor,
        capability,
        getITPresentationDecision(decisions, capability),
    );

    const readScopes = project("it.ticket.read");
    const commentScopes = project("it.ticket.comment");

    return Object.freeze({
        canReadOwnTickets: hasITScope(readScopes, "OWN"),
        canReadAllTickets: hasITScope(readScopes, "ALL"),
        canCreateOwnTickets: hasITScope(project("it.ticket.create"), "OWN"),
        canCommentOwnTickets: hasITScope(commentScopes, "OWN"),
        canCommentAllTickets: hasITScope(commentScopes, "ALL"),
        canManageTickets: hasITScope(project("it.ticket.manage"), "ALL"),
        canReadAnalytics: hasITScope(project("it.analytics.read"), "ALL"),
    });
}

/**
 * Applies requester ownership to a Ticket resource. Assignment and workforce
 * relationships are deliberately absent from this resource contract.
 */
export function isITTicketResourceInScope(
    actor: Pick<ITAuthorizationActor, "userId">,
    scopes: readonly AuthorizationScope[],
    ticket: ITTicketResourceScope,
): boolean {
    if (scopes.includes("ALL")) return true;
    return scopes.includes("OWN") && ticket.requesterUserId === actor.userId;
}
