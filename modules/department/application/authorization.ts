import {
    authorization,
    type AuthorizationActor,
    type AuthorizationDecision,
    type AuthorizationScope,
} from "@/modules/authorization";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import type { UserRole } from "@/lib/ssot/permissions";

export const DEPARTMENT_MIGRATED_CAPABILITIES = [
    "department.read",
] as const;

export type DepartmentMigratedCapability =
    (typeof DEPARTMENT_MIGRATED_CAPABILITIES)[number];

export type DepartmentAuthorizationActor = AuthorizationActor & {
    readonly channel: "DASHBOARD";
};

export interface DepartmentAuthorizationContext {
    readonly authorizationActor: DepartmentAuthorizationActor;
}

export interface DepartmentCapabilityAuthorization {
    readonly actor: DepartmentAuthorizationActor;
    readonly capability: DepartmentMigratedCapability;
    readonly decision: AuthorizationDecision;
    readonly scopes: readonly AuthorizationScope[];
    readonly usedMigrationCompatibility: boolean;
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
    DEPARTMENT_MIGRATED_CAPABILITIES,
);

function isDepartmentMigratedCapability(
    capability: string,
): capability is DepartmentMigratedCapability {
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

function freezeScopes(
    scopes: readonly AuthorizationScope[],
): readonly AuthorizationScope[] {
    return Object.freeze([...scopes]);
}

function legacyDepartmentScopes(
    capability: DepartmentMigratedCapability,
): readonly AuthorizationScope[] {
    switch (capability) {
        case "department.read":
            // requireApiSession() has already enforced the legacy eligible
            // workforce contract before this compatibility floor is reached.
            return ["ALL"];
    }
}

function buildDepartmentCapabilityAuthorization(
    actor: DepartmentAuthorizationActor,
    capability: string,
    decision: AuthorizationDecision,
): DepartmentCapabilityAuthorization {
    if (!isDepartmentMigratedCapability(capability)) {
        throw new DepartmentCapabilityDeniedError(
            capability,
            decision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    if (!decision.allowed) {
        const compatibilityScopes = decision.reason === "NO_APPLICABLE_GRANT"
            ? legacyDepartmentScopes(capability)
            : null;
        if (compatibilityScopes === null) {
            throw new DepartmentCapabilityDeniedError(
                capability,
                decision.reason,
            );
        }

        return Object.freeze({
            actor,
            capability,
            decision,
            scopes: freezeScopes(compatibilityScopes),
            usedMigrationCompatibility: true,
        });
    }

    return Object.freeze({
        actor,
        capability,
        decision,
        scopes: decision.scopes,
        usedMigrationCompatibility: false,
    });
}

export async function resolveDepartmentCapabilityForMigration(
    context: DepartmentAuthorizationContext,
    capability: string,
): Promise<DepartmentCapabilityAuthorization> {
    const actor = context.authorizationActor;
    const decision = await authorization.resolve(actor, capability);
    return buildDepartmentCapabilityAuthorization(actor, capability, decision);
}

export async function assertDepartmentCapabilityForMigration(
    context: DepartmentAuthorizationContext,
    capability: string,
): Promise<DepartmentCapabilityAuthorization> {
    return resolveDepartmentCapabilityForMigration(context, capability);
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
