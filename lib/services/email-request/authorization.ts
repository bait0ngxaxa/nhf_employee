import {
    authorization,
    CAPABILITY_REGISTRY,
    composeAuthorizationAuthority,
    AuthorizationConfigurationError,
    type AuthorizationActor,
    projectAuthorizationAdministrationEffectiveAccess,
    type AuthorizationDecision,
    type AuthorizationAdministrationEffectiveAccessInspection,
    type AuthorizationAdministrationInspectionContext,
    type AuthorizationScope,
} from "@/modules/authorization";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import type { UserRole } from "@/lib/ssot/permissions";

import type { EmailRequestPresentationCapabilities } from "@/types/email-request";

import type { EmailRequestReadAuthorization } from "./types";

export const EMAIL_REQUEST_CAPABILITIES = [
    "email.request.read",
    "email.request.create",
] as const;

export type EmailRequestCapability = (typeof EMAIL_REQUEST_CAPABILITIES)[number];

export type EmailRequestAuthorizationActor = AuthorizationActor & {
    readonly channel: "DASHBOARD";
};

export interface EmailRequestAuthorizationContext {
    readonly authorizationActor: EmailRequestAuthorizationActor;
}

export interface EmailRequestCapabilityAuthorization {
    readonly actor: EmailRequestAuthorizationActor;
    readonly capability: EmailRequestCapability;
    readonly decision: AuthorizationDecision;
    readonly defaultScopes: readonly AuthorizationScope[];
    readonly scopes: readonly AuthorizationScope[];
}

export class EmailRequestCapabilityDeniedError extends Error {
    readonly authorizationReason: AuthorizationDecision["reason"];
    readonly capability: string;
    readonly statusCode = 403;

    constructor(
        capability: string,
        reason: AuthorizationDecision["reason"],
    ) {
        super("คุณไม่มีสิทธิ์ดำเนินการ");
        this.name = "EmailRequestCapabilityDeniedError";
        this.capability = capability;
        this.authorizationReason = reason;
    }
}

const EMAIL_REQUEST_CAPABILITY_SET = new Set<string>(
    EMAIL_REQUEST_CAPABILITIES,
);

function isEmailRequestCapability(
    capability: string,
): capability is EmailRequestCapability {
    return EMAIL_REQUEST_CAPABILITY_SET.has(capability);
}

function parseUserRole(role: string): UserRole {
    if (role === "ADMIN" || role === "USER") return role;
    throw new WorkforceAuthorizationError();
}

export function buildEmailRequestAuthorizationActor(
    user: { readonly id: number; readonly role: string },
): EmailRequestAuthorizationActor {
    return Object.freeze({
        userId: user.id,
        employeeId: null,
        systemRole: parseUserRole(user.role),
        channel: "DASHBOARD" as const,
    });
}

export function buildEmailRequestAuthorizationContext(
    user: { readonly id: number; readonly role: string },
): EmailRequestAuthorizationContext {
    return Object.freeze({
        authorizationActor: buildEmailRequestAuthorizationActor(user),
    });
}

export function defaultEmailRequestScopes(
    _actor: EmailRequestAuthorizationActor,
    capability: EmailRequestCapability,
): readonly AuthorizationScope[] {
    void capability;
    return [];
}

function composeEmailRequestCapabilityAuthorization(
    actor: EmailRequestAuthorizationActor,
    capability: string,
    decision: AuthorizationDecision,
): EmailRequestCapabilityAuthorization {
    if (!isEmailRequestCapability(capability)) {
        throw new EmailRequestCapabilityDeniedError(
            capability,
            decision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    const definition = CAPABILITY_REGISTRY.get(capability);
    if (!definition) {
        throw new AuthorizationConfigurationError(
            "UNKNOWN_PERSISTED_CAPABILITY",
            `Email Request capability is not registered: ${capability}`,
            { capabilityKey: capability },
        );
    }
    for (const scope of decision.scopes) {
        if (!definition.scopes.includes(scope)) {
            throw new AuthorizationConfigurationError(
                "UNSUPPORTED_PERSISTED_SCOPE",
                `Email Request resolver returned an unsupported scope: ${scope}`,
                { capabilityKey: capability, scope },
            );
        }
    }

    const authority = composeAuthorizationAuthority(
        actor,
        capability,
        defaultEmailRequestScopes(actor, capability),
        decision,
    );
    if (!authority.allowed) {
        throw new EmailRequestCapabilityDeniedError(
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

export async function resolveEmailRequestCapability(
    context: EmailRequestAuthorizationContext,
    capability: string,
): Promise<EmailRequestCapabilityAuthorization> {
    if (!isEmailRequestCapability(capability)) {
        throw new AuthorizationConfigurationError(
            "UNKNOWN_PERSISTED_CAPABILITY",
            `Email Request capability is not supported by this adapter: ${capability}`,
            { capabilityKey: capability },
        );
    }
    const actor = context.authorizationActor;
    const decision = await authorization.resolve(actor, capability);
    return composeEmailRequestCapabilityAuthorization(actor, capability, decision);
}

export async function assertEmailRequestCapability(
    context: EmailRequestAuthorizationContext,
    capability: string,
): Promise<EmailRequestCapabilityAuthorization> {
    return resolveEmailRequestCapability(context, capability);
}

function projectEmailRequestCapabilityDecision(
    actor: EmailRequestAuthorizationActor,
    capability: EmailRequestCapability,
    decision: AuthorizationDecision,
): readonly AuthorizationScope[] | null {
    try {
        return composeEmailRequestCapabilityAuthorization(
            actor,
            capability,
            decision,
        ).scopes;
    } catch (error) {
        if (
            error instanceof EmailRequestCapabilityDeniedError
            && error.authorizationReason !== "UNKNOWN_CAPABILITY"
        ) {
            return null;
        }
        throw error;
    }
}

export async function getEmailRequestPresentationCapabilities(
    context: EmailRequestAuthorizationContext,
): Promise<EmailRequestPresentationCapabilities> {
    const actor = context.authorizationActor;
    const decisions = await authorization.resolveMany(
        actor,
        EMAIL_REQUEST_CAPABILITIES,
    );
    const project = (
        capability: EmailRequestCapability,
    ): readonly AuthorizationScope[] | null => {
        const decision = decisions.get(capability);
        if (decision === undefined) {
            throw new Error(
                `Authorization resolver omitted Email Request capability: ${capability}`,
            );
        }
        return projectEmailRequestCapabilityDecision(actor, capability, decision);
    };
    const readScopes = project("email.request.read");
    const createScopes = project("email.request.create");

    return Object.freeze({
        canReadRequests: readScopes?.includes("OWN") === true
            || readScopes?.includes("ALL") === true,
        canCreateRequests: createScopes?.includes("ALL") === true,
    });
}

export function assertEmailRequestCapabilityScope(
    capabilityAuthorization: EmailRequestCapabilityAuthorization,
    scope: AuthorizationScope,
): EmailRequestCapabilityAuthorization {
    if (
        capabilityAuthorization.scopes.includes(scope)
        || capabilityAuthorization.scopes.includes("ALL")
    ) {
        return capabilityAuthorization;
    }

    throw new EmailRequestCapabilityDeniedError(
        capabilityAuthorization.capability,
        capabilityAuthorization.decision.reason ?? "NO_APPLICABLE_GRANT",
    );
}

export function toEmailRequestReadAuthorization(
    capabilityAuthorization: EmailRequestCapabilityAuthorization,
): EmailRequestReadAuthorization {
    assertEmailRequestCapabilityScope(capabilityAuthorization, "OWN");
    return Object.freeze({
        userId: capabilityAuthorization.actor.userId,
        scopes: Object.freeze([...capabilityAuthorization.scopes]),
    });
}

const DASHBOARD_CONTEXT: AuthorizationAdministrationInspectionContext = Object.freeze({
    key: "dashboard",
    label: "Dashboard",
    channel: "DASHBOARD",
});

const LIMITATIONS = Object.freeze([
    Object.freeze({
        code: "email.request.workflow",
        label: "สิทธิ์กลางยังต้องผ่าน validation, idempotency และ workflow ของ Email Request",
    }),
]);

export function inspectEmailRequestEffectiveAccess(
    actor: AuthorizationActor,
    decisions: ReadonlyMap<string, AuthorizationDecision>,
): readonly AuthorizationAdministrationEffectiveAccessInspection[] {
    if (actor.channel !== "DASHBOARD") {
        throw new Error("Email Request effective-access inspection requires Dashboard channel");
    }

    const dashboardActor = Object.freeze({
        ...actor,
        channel: "DASHBOARD" as const,
    });

    return Object.freeze(EMAIL_REQUEST_CAPABILITIES.map((capability) => {
        const decision = decisions.get(capability);
        if (decision === undefined) {
            throw new Error(
                `Authorization resolver omitted Email Request capability: ${capability}`,
            );
        }

        const authority = composeAuthorizationAuthority(
            dashboardActor,
            capability,
            defaultEmailRequestScopes(dashboardActor, capability),
            decision,
        );
        return projectAuthorizationAdministrationEffectiveAccess(
            capability,
            DASHBOARD_CONTEXT,
            authority,
            LIMITATIONS,
        );
    }));
}
