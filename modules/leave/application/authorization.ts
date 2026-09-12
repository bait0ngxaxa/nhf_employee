import type { Prisma } from "@prisma/client";

import {
    authorization,
    type AuthorizationActor,
    type AuthorizationChannel,
    type AuthorizationDecision,
    type AuthorizationScope,
} from "@/modules/authorization";
import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import type { UserRole } from "@/lib/ssot/permissions";

export const LEAVE_MIGRATED_CAPABILITIES = [
    "leave.request.read",
    "leave.approval.read",
    "leave.request.create",
    "leave.request.cancel",
    "leave.request.approve",
    "leave.cancellation.decide",
    "leave.request.not_taken",
    "leave.approver.manage",
] as const;

export type LeaveMigratedCapability =
    (typeof LEAVE_MIGRATED_CAPABILITIES)[number];

export type LeaveAuthorizationChannel = Exclude<
    AuthorizationChannel,
    "SYSTEM"
>;

export type LeaveAuthorizationActor = AuthorizationActor & {
    readonly channel: LeaveAuthorizationChannel;
};

export interface LeaveAuthorizationContext {
    readonly authorizationActor: LeaveAuthorizationActor;
}

export interface LeaveCapabilityAuthorization {
    readonly actor: LeaveAuthorizationActor;
    readonly capability: LeaveMigratedCapability;
    readonly decision: AuthorizationDecision;
    readonly scopes: readonly AuthorizationScope[];
    readonly usedMigrationCompatibility: boolean;
}

export class LeaveCapabilityDeniedError extends Error {
    readonly authorizationReason: AuthorizationDecision["reason"];
    readonly capability: string;
    readonly statusCode = 403;

    constructor(
        capability: string,
        reason: AuthorizationDecision["reason"],
    ) {
        super("คุณไม่มีสิทธิ์ดำเนินการ");
        this.name = "LeaveCapabilityDeniedError";
        this.capability = capability;
        this.authorizationReason = reason;
    }
}

const LEAVE_CAPABILITY_SET = new Set<string>(
    LEAVE_MIGRATED_CAPABILITIES,
);

function isLeaveMigratedCapability(
    capability: string,
): capability is LeaveMigratedCapability {
    return LEAVE_CAPABILITY_SET.has(capability);
}

function parseUserRole(role: string): UserRole {
    if (role === "ADMIN" || role === "USER") return role;
    throw new WorkforceAuthorizationError();
}

export function buildLeaveAuthorizationActor(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null,
    channel: LeaveAuthorizationChannel,
): LeaveAuthorizationActor {
    return Object.freeze({
        userId: user.id,
        employeeId,
        systemRole: parseUserRole(user.role),
        channel,
    });
}

export function buildLeaveAuthorizationContext(
    user: { readonly id: number; readonly role: string },
    employeeId: number | null,
    channel: LeaveAuthorizationChannel,
): LeaveAuthorizationContext {
    return Object.freeze({
        authorizationActor: buildLeaveAuthorizationActor(user, employeeId, channel),
    });
}

function freezeScopes(
    scopes: readonly AuthorizationScope[],
): readonly AuthorizationScope[] {
    return Object.freeze([...scopes]);
}

function legacyLeaveScopes(
    actor: LeaveAuthorizationActor,
    capability: LeaveMigratedCapability,
): readonly AuthorizationScope[] | null {
    switch (capability) {
        case "leave.request.read":
        case "leave.request.create":
        case "leave.request.cancel":
            return ["OWN"];
        case "leave.approval.read":
        case "leave.request.approve":
            return ["ASSIGNED"];
        case "leave.cancellation.decide":
            return actor.channel === "DASHBOARD" ? ["ASSIGNED"] : null;
        case "leave.request.not_taken":
            return ["OWN", "ASSIGNED"];
        case "leave.approver.manage":
            return actor.systemRole === "ADMIN" ? ["ALL"] : null;
    }
}

function buildLeaveCapabilityAuthorization(
    actor: LeaveAuthorizationActor,
    capability: string,
    decision: AuthorizationDecision,
): LeaveCapabilityAuthorization {
    if (!isLeaveMigratedCapability(capability)) {
        throw new LeaveCapabilityDeniedError(
            capability,
            decision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    if (!decision.allowed) {
        const compatibilityScopes = decision.reason === "NO_APPLICABLE_GRANT"
            ? legacyLeaveScopes(actor, capability)
            : null;
        if (compatibilityScopes === null) {
            throw new LeaveCapabilityDeniedError(
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

export async function resolveLeaveCapabilityForMigration(
    context: LeaveAuthorizationContext,
    capability: string,
): Promise<LeaveCapabilityAuthorization> {
    const actor = context.authorizationActor;
    const decision = await authorization.resolve(actor, capability);
    return buildLeaveCapabilityAuthorization(actor, capability, decision);
}

export async function assertLeaveCapabilityForMigration(
    context: LeaveAuthorizationContext,
    capability: string,
): Promise<LeaveCapabilityAuthorization> {
    return resolveLeaveCapabilityForMigration(context, capability);
}

export function assertLeaveCapabilityScope(
    capabilityAuthorization: LeaveCapabilityAuthorization,
    scope: AuthorizationScope,
): LeaveCapabilityAuthorization {
    if (
        capabilityAuthorization.scopes.includes(scope)
        || capabilityAuthorization.scopes.includes("ALL")
    ) {
        return capabilityAuthorization;
    }

    throw new LeaveCapabilityDeniedError(
        capabilityAuthorization.capability,
        capabilityAuthorization.decision.reason,
    );
}

export function canUseLeaveAdminRecoveryOverride(
    capabilityAuthorization: LeaveCapabilityAuthorization,
): boolean {
    return (
        (
            capabilityAuthorization.capability === "leave.cancellation.decide"
            || capabilityAuthorization.capability === "leave.request.not_taken"
        )
        && capabilityAuthorization.actor.systemRole === "ADMIN"
        && capabilityAuthorization.actor.channel === "DASHBOARD"
    );
}

interface ActiveLeaveAuthorizationUser {
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

async function findActiveLeaveAuthorizationUser(
    tx: Prisma.TransactionClient,
    requestedActor: LeaveAuthorizationActor,
    allowAccountOnlyAdminApproverManagement = false,
): Promise<ActiveLeaveAuthorizationUser> {
    const isAccountOnlyAdminApproverManagement =
        allowAccountOnlyAdminApproverManagement
        && requestedActor.channel === "DASHBOARD"
        && requestedActor.systemRole === "ADMIN"
        && requestedActor.employeeId === null;

    if (requestedActor.employeeId === null && !isAccountOnlyAdminApproverManagement) {
        throw new WorkforceAuthorizationError();
    }

    await lockUserRows(tx, [requestedActor.userId]);
    if (requestedActor.employeeId !== null) {
        await lockEmployeeRows(tx, [requestedActor.employeeId]);
    }

    const user = requestedActor.employeeId === null
        ? await tx.user.findFirst({
            where: {
                id: requestedActor.userId,
                role: "ADMIN",
                isActive: true,
                deletedAt: null,
            },
            select: {
                id: true,
                role: true,
                isActive: true,
                deletedAt: true,
                employee: {
                    select: { id: true, status: true, deletedAt: true },
                },
            },
        })
        : await tx.user.findFirst({
            where: {
                id: requestedActor.userId,
                isActive: true,
                deletedAt: null,
                employeeId: requestedActor.employeeId,
                employee: {
                    is: { status: "ACTIVE", deletedAt: null },
                },
            },
            select: {
                id: true,
                role: true,
                isActive: true,
                deletedAt: true,
                employee: {
                    select: { id: true, status: true, deletedAt: true },
                },
            },
        });

    if (!user || !user.isActive || user.deletedAt !== null) {
        throw new WorkforceAuthorizationError();
    }

    const currentRole = parseUserRole(user.role);
    if (isAccountOnlyAdminApproverManagement && currentRole !== "ADMIN") {
        throw new WorkforceAuthorizationError();
    }
    if (requestedActor.employeeId !== null && (
        user.employee === null
        || user.employee.id !== requestedActor.employeeId
        || user.employee.status !== "ACTIVE"
        || user.employee.deletedAt !== null
    )) {
        throw new WorkforceAuthorizationError();
    }

    return user;
}

function buildCurrentLeaveAuthorizationActor(
    requestedActor: LeaveAuthorizationActor,
    user: ActiveLeaveAuthorizationUser,
): LeaveAuthorizationActor {
    return buildLeaveAuthorizationActor(
        { id: user.id, role: parseUserRole(user.role) },
        user.employee?.id ?? null,
        requestedActor.channel,
    );
}

export async function resolveLeaveActorInTransaction(
    tx: Prisma.TransactionClient,
    context: LeaveAuthorizationContext,
): Promise<LeaveAuthorizationActor> {
    const requestedActor = context.authorizationActor;
    const user = await findActiveLeaveAuthorizationUser(tx, requestedActor);
    return buildCurrentLeaveAuthorizationActor(requestedActor, user);
}

export async function resolveLeaveCapabilityInTransaction(
    tx: Prisma.TransactionClient,
    context: LeaveAuthorizationContext,
    capability: string,
): Promise<LeaveCapabilityAuthorization> {
    const requestedActor = context.authorizationActor;
    const allowAccountOnlyAdminApproverManagement =
        capability === "leave.approver.manage";
    const user = await findActiveLeaveAuthorizationUser(
        tx,
        requestedActor,
        allowAccountOnlyAdminApproverManagement,
    );
    const activeActor = buildCurrentLeaveAuthorizationActor(
        requestedActor,
        user,
    );
    const decision = await authorization.resolveInTransaction(
        activeActor,
        capability,
        tx,
    );

    return buildLeaveCapabilityAuthorization(activeActor, capability, decision);
}
