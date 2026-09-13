import {
    authorization,
    type AuthorizationActor,
    type AuthorizationDecision,
    type AuthorizationScope,
} from "@/modules/authorization";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import type { UserRole } from "@/lib/ssot/permissions";
import type { AuditPresentationCapabilities } from "./types";

export const AUDIT_MIGRATED_CAPABILITIES = [
    "audit.read",
] as const;

export type AuditMigratedCapability =
    (typeof AUDIT_MIGRATED_CAPABILITIES)[number];

export type AuditAuthorizationActor = AuthorizationActor & {
    readonly channel: "DASHBOARD";
};

export interface AuditAuthorizationContext {
    readonly authorizationActor: AuditAuthorizationActor;
}

export interface AuditCapabilityAuthorization {
    readonly actor: AuditAuthorizationActor;
    readonly capability: AuditMigratedCapability;
    readonly decision: AuthorizationDecision;
    readonly scopes: readonly AuthorizationScope[];
    readonly usedMigrationCompatibility: boolean;
}

export class AuditCapabilityDeniedError extends Error {
    readonly authorizationReason: AuthorizationDecision["reason"];
    readonly capability: string;
    readonly statusCode = 403;

    constructor(
        capability: string,
        reason: AuthorizationDecision["reason"],
    ) {
        super("คุณไม่มีสิทธิ์ดำเนินการ");
        this.name = "AuditCapabilityDeniedError";
        this.capability = capability;
        this.authorizationReason = reason;
    }
}

const AUDIT_CAPABILITY_SET = new Set<string>(
    AUDIT_MIGRATED_CAPABILITIES,
);

function isAuditMigratedCapability(
    capability: string,
): capability is AuditMigratedCapability {
    return AUDIT_CAPABILITY_SET.has(capability);
}

function parseUserRole(role: string): UserRole {
    if (role === "ADMIN" || role === "USER") return role;
    throw new WorkforceAuthorizationError();
}

export function buildAuditAuthorizationActor(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null = null,
): AuditAuthorizationActor {
    return Object.freeze({
        userId: user.id,
        employeeId,
        systemRole: parseUserRole(user.role),
        channel: "DASHBOARD" as const,
    });
}

export function buildAuditAuthorizationContext(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null = null,
): AuditAuthorizationContext {
    return Object.freeze({
        authorizationActor: buildAuditAuthorizationActor(user, employeeId),
    });
}

function buildAuditCapabilityAuthorization(
    actor: AuditAuthorizationActor,
    capability: string,
    decision: AuthorizationDecision,
): AuditCapabilityAuthorization {
    if (!isAuditMigratedCapability(capability) || !decision.allowed) {
        throw new AuditCapabilityDeniedError(
            capability,
            decision.reason ?? "NO_APPLICABLE_GRANT",
        );
    }

    // ADMIN authority and explicit USER grants are both produced by the
    // central resolver. There is no role-based compatibility bypass here.
    return Object.freeze({
        actor,
        capability,
        decision,
        scopes: decision.scopes,
        usedMigrationCompatibility: false,
    });
}

function getAuditPresentationDecision(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: AuditMigratedCapability,
): AuthorizationDecision {
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(
            `Authorization resolver omitted Audit capability: ${capability}`,
        );
    }
    return decision;
}

function projectAuditCapabilityDecision(
    actor: AuditAuthorizationActor,
    capability: AuditMigratedCapability,
    decision: AuthorizationDecision,
): readonly AuthorizationScope[] | null {
    try {
        return assertAuditCapabilityScope(
            buildAuditCapabilityAuthorization(actor, capability, decision),
            "ALL",
        ).scopes;
    } catch (error) {
        if (
            error instanceof AuditCapabilityDeniedError
            && error.authorizationReason !== "UNKNOWN_CAPABILITY"
        ) {
            return null;
        }
        throw error;
    }
}

function hasAuditScope(
    scopes: readonly AuthorizationScope[] | null,
    scope: AuthorizationScope,
): boolean {
    return scopes?.includes(scope) === true || scopes?.includes("ALL") === true;
}

/**
 * Projects Audit log eligibility for Dashboard presentation only. The Audit
 * route and API remain authoritative and central-resolver driven.
 */
export async function getAuditPresentationCapabilities(
    context: AuditAuthorizationContext,
): Promise<AuditPresentationCapabilities> {
    const actor = context.authorizationActor;
    const decisions = await authorization.resolveMany(
        actor,
        AUDIT_MIGRATED_CAPABILITIES,
    );
    const decision = getAuditPresentationDecision(decisions, "audit.read");
    const scopes = projectAuditCapabilityDecision(
        actor,
        "audit.read",
        decision,
    );

    return Object.freeze({
        canReadAuditLogs: hasAuditScope(scopes, "ALL"),
    });
}

export async function resolveAuditCapabilityForMigration(
    context: AuditAuthorizationContext,
    capability: string,
): Promise<AuditCapabilityAuthorization> {
    const actor = context.authorizationActor;
    const decision = await authorization.resolve(actor, capability);
    return buildAuditCapabilityAuthorization(actor, capability, decision);
}

export async function assertAuditCapabilityForMigration(
    context: AuditAuthorizationContext,
    capability: string,
): Promise<AuditCapabilityAuthorization> {
    return resolveAuditCapabilityForMigration(context, capability);
}

export function assertAuditCapabilityScope(
    capabilityAuthorization: AuditCapabilityAuthorization,
    scope: AuthorizationScope,
): AuditCapabilityAuthorization {
    if (
        capabilityAuthorization.scopes.includes(scope)
        || capabilityAuthorization.scopes.includes("ALL")
    ) {
        return capabilityAuthorization;
    }

    throw new AuditCapabilityDeniedError(
        capabilityAuthorization.capability,
        capabilityAuthorization.decision.reason,
    );
}
