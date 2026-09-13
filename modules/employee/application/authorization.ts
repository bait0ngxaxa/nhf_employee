import type { Prisma } from "@prisma/client";

import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";
import {
    authorization,
    type AuthorizationActor,
    type AuthorizationDecision,
    type AuthorizationScope,
} from "@/modules/authorization";
import type { UserRole } from "@/lib/ssot/permissions";

import type { EmployeeLifecycleActor } from "./types";

export const EMPLOYEE_MIGRATED_CAPABILITIES = [
    "employee.read",
    "employee.stats.read",
    "employee.create",
    "employee.update",
    "employee.delete",
    "employee.import",
    "employee.export",
] as const;

export type EmployeeMigratedCapability =
    (typeof EMPLOYEE_MIGRATED_CAPABILITIES)[number];

export type EmployeeAuthorizationActor = AuthorizationActor & {
    readonly channel: "DASHBOARD";
};

export interface EmployeeAuthorizationContext {
    readonly authorizationActor: EmployeeAuthorizationActor;
}

export type EmployeeAuthorizedCommandActor = EmployeeLifecycleActor & {
    readonly authorization: EmployeeAuthorizationContext;
};

export interface EmployeeCapabilityAuthorization {
    readonly actor: EmployeeAuthorizationActor;
    readonly capability: EmployeeMigratedCapability;
    readonly decision: AuthorizationDecision;
    readonly scopes: readonly AuthorizationScope[];
    readonly usedMigrationCompatibility: boolean;
}

export class EmployeeCapabilityDeniedError extends Error {
    readonly authorizationReason: AuthorizationDecision["reason"];
    readonly capability: string;
    readonly statusCode = 403;

    constructor(
        capability: string,
        reason: AuthorizationDecision["reason"],
    ) {
        super("คุณไม่มีสิทธิ์ดำเนินการ");
        this.name = "EmployeeCapabilityDeniedError";
        this.capability = capability;
        this.authorizationReason = reason;
    }
}

const EMPLOYEE_CAPABILITY_SET = new Set<string>(
    EMPLOYEE_MIGRATED_CAPABILITIES,
);

function isEmployeeMigratedCapability(
    capability: string,
): capability is EmployeeMigratedCapability {
    return EMPLOYEE_CAPABILITY_SET.has(capability);
}

function parseUserRole(role: string): UserRole {
    if (role === "ADMIN" || role === "USER") return role;
    throw new WorkforceAuthorizationError();
}

export function buildEmployeeAuthorizationActor(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null = null,
): EmployeeAuthorizationActor {
    return Object.freeze({
        userId: user.id,
        employeeId,
        systemRole: parseUserRole(user.role),
        channel: "DASHBOARD" as const,
    });
}

export function buildEmployeeAuthorizationContext(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null = null,
): EmployeeAuthorizationContext {
    return Object.freeze({
        authorizationActor: buildEmployeeAuthorizationActor(user, employeeId),
    });
}

export function buildEmployeeAuthorizedCommandActor(
    user: { readonly id: number; readonly role: string; readonly email: string },
): EmployeeAuthorizedCommandActor {
    return Object.freeze({
        userId: user.id,
        email: user.email,
        authorization: buildEmployeeAuthorizationContext(user),
    });
}

function freezeScopes(
    scopes: readonly AuthorizationScope[],
): readonly AuthorizationScope[] {
    return Object.freeze([...scopes]);
}

function legacyEmployeeScopes(
    actor: EmployeeAuthorizationActor,
    capability: EmployeeMigratedCapability,
): readonly AuthorizationScope[] | null {
    switch (capability) {
        case "employee.read":
        case "employee.stats.read":
        case "employee.export":
            return ["ALL"];
        case "employee.create":
        case "employee.update":
        case "employee.delete":
        case "employee.import":
            return actor.systemRole === "ADMIN" ? ["ALL"] : null;
    }
}

function buildEmployeeCapabilityAuthorization(
    actor: EmployeeAuthorizationActor,
    capability: string,
    decision: AuthorizationDecision,
): EmployeeCapabilityAuthorization {
    if (!isEmployeeMigratedCapability(capability)) {
        throw new EmployeeCapabilityDeniedError(
            capability,
            decision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    if (!decision.allowed) {
        const compatibilityScopes = decision.reason === "NO_APPLICABLE_GRANT"
            ? legacyEmployeeScopes(actor, capability)
            : null;
        if (compatibilityScopes === null) {
            throw new EmployeeCapabilityDeniedError(
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

export async function resolveEmployeeCapabilityForMigration(
    context: EmployeeAuthorizationContext,
    capability: string,
): Promise<EmployeeCapabilityAuthorization> {
    const actor = context.authorizationActor;
    const decision = await authorization.resolve(actor, capability);
    return buildEmployeeCapabilityAuthorization(actor, capability, decision);
}

export async function assertEmployeeCapabilityForMigration(
    context: EmployeeAuthorizationContext,
    capability: string,
): Promise<EmployeeCapabilityAuthorization> {
    return resolveEmployeeCapabilityForMigration(context, capability);
}

export function assertEmployeeCapabilityScope(
    capabilityAuthorization: EmployeeCapabilityAuthorization,
    scope: AuthorizationScope,
): EmployeeCapabilityAuthorization {
    if (
        capabilityAuthorization.scopes.includes(scope)
        || capabilityAuthorization.scopes.includes("ALL")
    ) {
        return capabilityAuthorization;
    }

    throw new EmployeeCapabilityDeniedError(
        capabilityAuthorization.capability,
        capabilityAuthorization.decision.reason,
    );
}

interface ActiveEmployeeAuthorizationUser {
    readonly id: number;
    readonly role: string;
    readonly isActive: boolean;
    readonly deletedAt: Date | null;
    readonly employee: {
        readonly id: number;
        readonly status: string;
        readonly deletedAt: Date | null;
    } | null;
}

const ACTIVE_EMPLOYEE_AUTHORIZATION_USER_SELECT = {
    id: true,
    role: true,
    isActive: true,
    deletedAt: true,
    employee: {
        select: { id: true, status: true, deletedAt: true },
    },
} as const satisfies Prisma.UserSelect;

function isActiveEmployee(
    employee: ActiveEmployeeAuthorizationUser["employee"],
): employee is NonNullable<ActiveEmployeeAuthorizationUser["employee"]> {
    return employee?.status === "ACTIVE" && employee.deletedAt === null;
}

async function findActiveEmployeeAuthorizationUser(
    tx: Prisma.TransactionClient,
    requestedActor: EmployeeAuthorizationActor,
): Promise<ActiveEmployeeAuthorizationUser> {
    if (requestedActor.channel !== "DASHBOARD") {
        throw new WorkforceAuthorizationError();
    }

    await lockUserRows(tx, [requestedActor.userId]);
    const userBeforeEmployeeLock = await tx.user.findUnique({
        where: { id: requestedActor.userId },
        select: ACTIVE_EMPLOYEE_AUTHORIZATION_USER_SELECT,
    });
    if (!userBeforeEmployeeLock?.employee) {
        throw new WorkforceAuthorizationError();
    }

    await lockEmployeeRows(tx, [userBeforeEmployeeLock.employee.id]);

    const user = await tx.user.findUnique({
        where: { id: requestedActor.userId },
        select: ACTIVE_EMPLOYEE_AUTHORIZATION_USER_SELECT,
    });
    if (
        !user
        || !user.isActive
        || user.deletedAt !== null
        || !isActiveEmployee(user.employee)
        || (
            requestedActor.employeeId !== null
            && requestedActor.employeeId !== user.employee.id
        )
    ) {
        throw new WorkforceAuthorizationError();
    }

    return user;
}

function buildCurrentEmployeeAuthorizationActor(
    user: ActiveEmployeeAuthorizationUser,
): EmployeeAuthorizationActor {
    if (!isActiveEmployee(user.employee)) {
        throw new WorkforceAuthorizationError();
    }

    return buildEmployeeAuthorizationActor(
        { id: user.id, role: user.role },
        user.employee.id,
    );
}

export async function resolveEmployeeCapabilityInTransaction(
    tx: Prisma.TransactionClient,
    actor: EmployeeAuthorizedCommandActor,
    capability: string,
): Promise<EmployeeCapabilityAuthorization> {
    const requestedActor = actor.authorization.authorizationActor;
    if (requestedActor.userId !== actor.userId) {
        throw new WorkforceAuthorizationError();
    }

    const user = await findActiveEmployeeAuthorizationUser(tx, requestedActor);
    const activeActor = buildCurrentEmployeeAuthorizationActor(user);
    const decision = await authorization.resolveInTransaction(
        activeActor,
        capability,
        tx,
    );

    return buildEmployeeCapabilityAuthorization(activeActor, capability, decision);
}
