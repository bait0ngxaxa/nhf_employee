import {
    authorization,
    composeAuthorizationAuthority,
    type AuthorizationActor,
    type AuthorizationDecision,
    type AuthorizationScope,
    type ComposedAuthorizationAuthority,
} from "@/modules/authorization";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import type { UserRole } from "@/lib/ssot/permissions";
import type { NotificationPresentationCapabilities } from "./types";

export const NOTIFICATION_CAPABILITIES = [
    "notification.inbox.read",
    "notification.inbox.update",
] as const;

export type NotificationCapability = (typeof NOTIFICATION_CAPABILITIES)[number];

export type NotificationAuthorizationActor = AuthorizationActor & {
    readonly channel: "DASHBOARD";
};

export interface NotificationAuthorizationContext {
    readonly authorizationActor: NotificationAuthorizationActor;
}

export interface NotificationCapabilityAuthorization {
    readonly actor: NotificationAuthorizationActor;
    readonly capability: NotificationCapability;
    readonly decision: AuthorizationDecision;
    readonly defaultScopes: readonly AuthorizationScope[];
    readonly scopes: readonly AuthorizationScope[];
}

export class NotificationCapabilityDeniedError extends Error {
    readonly authorizationReason: AuthorizationDecision["reason"];
    readonly capability: string;
    readonly statusCode = 403;

    constructor(
        capability: string,
        reason: AuthorizationDecision["reason"],
    ) {
        super("คุณไม่มีสิทธิ์ดำเนินการ");
        this.name = "NotificationCapabilityDeniedError";
        this.capability = capability;
        this.authorizationReason = reason;
    }
}

const NOTIFICATION_CAPABILITY_SET = new Set<string>(
    NOTIFICATION_CAPABILITIES,
);

function isNotificationCapability(
    capability: string,
): capability is NotificationCapability {
    return NOTIFICATION_CAPABILITY_SET.has(capability);
}

function parseUserRole(role: string): UserRole {
    if (role === "ADMIN" || role === "USER") return role;
    throw new WorkforceAuthorizationError();
}

export function buildNotificationAuthorizationActor(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null = null,
): NotificationAuthorizationActor {
    return Object.freeze({
        userId: user.id,
        employeeId,
        systemRole: parseUserRole(user.role),
        channel: "DASHBOARD" as const,
    });
}

export function buildNotificationAuthorizationContext(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null = null,
): NotificationAuthorizationContext {
    return Object.freeze({
        authorizationActor: buildNotificationAuthorizationActor(user, employeeId),
    });
}

function defaultNotificationScopes(
    capability: NotificationCapability,
): readonly AuthorizationScope[] {
    switch (capability) {
        case "notification.inbox.read":
        case "notification.inbox.update":
            return ["OWN"];
    }
}

function buildNotificationCapabilityAuthorization(
    actor: NotificationAuthorizationActor,
    capability: string,
    authority: ComposedAuthorizationAuthority,
): NotificationCapabilityAuthorization {
    if (!isNotificationCapability(capability)) {
        throw new NotificationCapabilityDeniedError(
            capability,
            authority.configuredDecision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    if (!authority.allowed) {
        throw new NotificationCapabilityDeniedError(
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

function composeNotificationCapabilityAuthorization(
    actor: NotificationAuthorizationActor,
    capability: string,
    decision: AuthorizationDecision,
): NotificationCapabilityAuthorization {
    if (!isNotificationCapability(capability)) {
        throw new NotificationCapabilityDeniedError(
            capability,
            decision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    const authority = composeAuthorizationAuthority(
        actor,
        capability,
        defaultNotificationScopes(capability),
        decision,
    );
    return buildNotificationCapabilityAuthorization(actor, capability, authority);
}

function getNotificationPresentationDecision(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: NotificationCapability,
): AuthorizationDecision {
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(
            `Authorization resolver omitted Notification capability: ${capability}`,
        );
    }
    return decision;
}

function projectNotificationCapabilityDecision(
    actor: NotificationAuthorizationActor,
    capability: NotificationCapability,
    decision: AuthorizationDecision,
): readonly AuthorizationScope[] | null {
    try {
        return assertNotificationCapabilityScope(
            composeNotificationCapabilityAuthorization(actor, capability, decision),
            "OWN",
        ).scopes;
    } catch (error) {
        if (
            error instanceof NotificationCapabilityDeniedError
            && error.authorizationReason !== "UNKNOWN_CAPABILITY"
        ) {
            return null;
        }
        throw error;
    }
}

function hasNotificationScope(
    scopes: readonly AuthorizationScope[] | null,
    scope: AuthorizationScope,
): boolean {
    return scopes?.includes(scope) === true;
}

/**
 * Projects independent Dashboard inbox read/update eligibility. Notification
 * APIs remain authoritative at the server boundary.
 */
export async function getNotificationPresentationCapabilities(
    context: NotificationAuthorizationContext,
): Promise<NotificationPresentationCapabilities> {
    const actor = context.authorizationActor;
    const decisions = await authorization.resolveMany(
        actor,
        NOTIFICATION_CAPABILITIES,
    );
    const project = (
        capability: NotificationCapability,
    ): readonly AuthorizationScope[] | null =>
        projectNotificationCapabilityDecision(
            actor,
            capability,
            getNotificationPresentationDecision(decisions, capability),
        );

    return Object.freeze({
        canReadInbox: hasNotificationScope(
            project("notification.inbox.read"),
            "OWN",
        ),
        canUpdateInbox: hasNotificationScope(
            project("notification.inbox.update"),
            "OWN",
        ),
    });
}

export async function resolveNotificationCapability(
    context: NotificationAuthorizationContext,
    capability: string,
): Promise<NotificationCapabilityAuthorization> {
    const actor = context.authorizationActor;
    const decision = await authorization.resolve(actor, capability);
    return composeNotificationCapabilityAuthorization(actor, capability, decision);
}

export async function assertNotificationCapability(
    context: NotificationAuthorizationContext,
    capability: string,
): Promise<NotificationCapabilityAuthorization> {
    return resolveNotificationCapability(context, capability);
}

export function assertNotificationCapabilityScope(
    capabilityAuthorization: NotificationCapabilityAuthorization,
    scope: AuthorizationScope,
): NotificationCapabilityAuthorization {
    // Notification inbox capabilities are intentionally OWN-only. Do not let
    // a broader scope turn an inbox route into an all-users surface.
    if (capabilityAuthorization.scopes.includes(scope)) {
        return capabilityAuthorization;
    }

    throw new NotificationCapabilityDeniedError(
        capabilityAuthorization.capability,
        capabilityAuthorization.decision.reason,
    );
}
