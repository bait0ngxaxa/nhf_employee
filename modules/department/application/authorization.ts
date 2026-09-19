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
import type { DepartmentPresentationCapabilities } from "./types";

export const DEPARTMENT_CAPABILITIES = [
    "department.read",
] as const;

export type DepartmentCapability = (typeof DEPARTMENT_CAPABILITIES)[number];

export type DepartmentAuthorizationActor = AuthorizationActor & {
    readonly channel: "DASHBOARD";
};

export interface DepartmentAuthorizationContext {
    readonly authorizationActor: DepartmentAuthorizationActor;
}

export interface DepartmentCapabilityAuthorization {
    readonly actor: DepartmentAuthorizationActor;
    readonly capability: DepartmentCapability;
    readonly decision: AuthorizationDecision;
    readonly defaultScopes: readonly AuthorizationScope[];
    readonly scopes: readonly AuthorizationScope[];
}

export class DepartmentCapabilityDeniedError extends Error {
    readonly authorizationReason: AuthorizationDecision["reason"];
    readonly capability: string;
    readonly statusCode = 403;

    constructor(
        capability: string,
        reason: AuthorizationDecision["reason"],
    ) {
        super("คุณไม่มีสิทธิ์ดำเนินการ");
        this.name = "DepartmentCapabilityDeniedError";
        this.capability = capability;
        this.authorizationReason = reason;
    }
}

const DEPARTMENT_CAPABILITY_SET = new Set<string>(
    DEPARTMENT_CAPABILITIES,
);

function isDepartmentCapability(
    capability: string,
): capability is DepartmentCapability {
    return DEPARTMENT_CAPABILITY_SET.has(capability);
}

function parseUserRole(role: string): UserRole {
    if (role === "ADMIN" || role === "USER") return role;
    throw new WorkforceAuthorizationError();
}

export function buildDepartmentAuthorizationActor(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null = null,
): DepartmentAuthorizationActor {
    return Object.freeze({
        userId: user.id,
        employeeId,
        systemRole: parseUserRole(user.role),
        channel: "DASHBOARD" as const,
    });
}

export function buildDepartmentAuthorizationContext(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null = null,
): DepartmentAuthorizationContext {
    return Object.freeze({
        authorizationActor: buildDepartmentAuthorizationActor(user, employeeId),
    });
}

export function defaultDepartmentScopes(
    capability: DepartmentCapability,
): readonly AuthorizationScope[] {
    switch (capability) {
        case "department.read":
            return ["ALL"];
    }
}

function buildDepartmentCapabilityAuthorization(
    actor: DepartmentAuthorizationActor,
    capability: string,
    authority: ComposedAuthorizationAuthority,
): DepartmentCapabilityAuthorization {
    if (!isDepartmentCapability(capability)) {
        throw new DepartmentCapabilityDeniedError(
            capability,
            authority.configuredDecision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    if (!authority.allowed) {
        throw new DepartmentCapabilityDeniedError(
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

function composeDepartmentCapabilityAuthorization(
    actor: DepartmentAuthorizationActor,
    capability: string,
    decision: AuthorizationDecision,
): DepartmentCapabilityAuthorization {
    if (!isDepartmentCapability(capability)) {
        throw new DepartmentCapabilityDeniedError(
            capability,
            decision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    const authority = composeAuthorizationAuthority(
        actor,
        capability,
        defaultDepartmentScopes(capability),
        decision,
    );
    return buildDepartmentCapabilityAuthorization(actor, capability, authority);
}

function getDepartmentPresentationDecision(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: DepartmentCapability,
): AuthorizationDecision {
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(
            `Authorization resolver omitted Department capability: ${capability}`,
        );
    }
    return decision;
}

function projectDepartmentCapabilityDecision(
    actor: DepartmentAuthorizationActor,
    capability: DepartmentCapability,
    decision: AuthorizationDecision,
): readonly AuthorizationScope[] | null {
    try {
        return assertDepartmentCapabilityScope(
            composeDepartmentCapabilityAuthorization(actor, capability, decision),
            "ALL",
        ).scopes;
    } catch (error) {
        if (
            error instanceof DepartmentCapabilityDeniedError
            && error.authorizationReason !== "UNKNOWN_CAPABILITY"
        ) {
            return null;
        }
        throw error;
    }
}

function hasDepartmentScope(
    scopes: readonly AuthorizationScope[] | null,
    scope: AuthorizationScope,
): boolean {
    return scopes?.includes(scope) === true || scopes?.includes("ALL") === true;
}

/**
 * Projects Department reference-data eligibility for Dashboard presentation.
 * The Department API remains the authoritative authorization boundary.
 */
export async function getDepartmentPresentationCapabilities(
    context: DepartmentAuthorizationContext,
): Promise<DepartmentPresentationCapabilities> {
    const actor = context.authorizationActor;
    const decisions = await authorization.resolveMany(
        actor,
        DEPARTMENT_CAPABILITIES,
    );
    const decision = getDepartmentPresentationDecision(
        decisions,
        "department.read",
    );
    const scopes = projectDepartmentCapabilityDecision(
        actor,
        "department.read",
        decision,
    );

    return Object.freeze({
        canReadDepartments: hasDepartmentScope(scopes, "ALL"),
    });
}

export async function resolveDepartmentCapability(
    context: DepartmentAuthorizationContext,
    capability: string,
): Promise<DepartmentCapabilityAuthorization> {
    const actor = context.authorizationActor;
    const decision = await authorization.resolve(actor, capability);
    return composeDepartmentCapabilityAuthorization(actor, capability, decision);
}

export async function assertDepartmentCapability(
    context: DepartmentAuthorizationContext,
    capability: string,
): Promise<DepartmentCapabilityAuthorization> {
    return resolveDepartmentCapability(context, capability);
}

export function assertDepartmentCapabilityScope(
    capabilityAuthorization: DepartmentCapabilityAuthorization,
    scope: AuthorizationScope,
): DepartmentCapabilityAuthorization {
    if (
        capabilityAuthorization.scopes.includes(scope)
        || capabilityAuthorization.scopes.includes("ALL")
    ) {
        return capabilityAuthorization;
    }

    throw new DepartmentCapabilityDeniedError(
        capabilityAuthorization.capability,
        capabilityAuthorization.decision.reason,
    );
}
