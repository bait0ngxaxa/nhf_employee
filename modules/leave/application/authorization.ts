import type { Prisma } from "@prisma/client";

import {
    authorization,
    composeAuthorizationAuthority,
    type AuthorizationActor,
    type AuthorizationChannel,
    type AuthorizationDecision,
    type AuthorizationScope,
} from "@/modules/authorization";
import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import type { UserRole } from "@/lib/ssot/permissions";

import type { LeavePresentationCapabilities } from "./types";

export const LEAVE_CAPABILITIES = [
    "leave.request.read",
    "leave.approval.read",
    "leave.request.create",
    "leave.request.cancel",
    "leave.request.approve",
    "leave.cancellation.decide",
    "leave.request.not_taken",
    "leave.approver.manage",
    "leave.recovery.manage",
] as const;

export type LeaveCapability = (typeof LEAVE_CAPABILITIES)[number];

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
    readonly capability: LeaveCapability;
    readonly decision: AuthorizationDecision;
    readonly defaultScopes: readonly AuthorizationScope[];
    readonly scopes: readonly AuthorizationScope[];
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
    LEAVE_CAPABILITIES,
);

function isLeaveCapability(
    capability: string,
): capability is LeaveCapability {
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

export function defaultLeaveScopes(
    actor: LeaveAuthorizationActor,
    capability: LeaveCapability,
): readonly AuthorizationScope[] {
    switch (capability) {
        case "leave.request.read":
        case "leave.request.create":
        case "leave.request.cancel":
            return ["OWN"];
        case "leave.approval.read":
        case "leave.request.approve":
            return ["ASSIGNED"];
        case "leave.cancellation.decide":
            return actor.channel === "DASHBOARD" ? ["ASSIGNED"] : [];
        case "leave.request.not_taken":
            return ["OWN", "ASSIGNED"];
        case "leave.approver.manage":
        case "leave.recovery.manage":
            return [];
    }
}

function buildLeaveCapabilityAuthorization(
    actor: LeaveAuthorizationActor,
    capability: string,
    decision: AuthorizationDecision,
): LeaveCapabilityAuthorization {
    if (!isLeaveCapability(capability)) {
        throw new LeaveCapabilityDeniedError(
            capability,
            decision.reason ?? "UNKNOWN_CAPABILITY",
        );
    }

    const authority = composeAuthorizationAuthority(
        actor,
        capability,
        defaultLeaveScopes(actor, capability),
        decision,
    );
    if (!authority.allowed) {
        throw new LeaveCapabilityDeniedError(
            capability,
            decision.reason,
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

function getLeavePresentationDecision(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: LeaveCapability,
): AuthorizationDecision {
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(
            `Authorization resolver omitted Leave capability: ${capability}`,
        );
    }
    return decision;
}

function projectLeaveCapabilityDecision(
    actor: LeaveAuthorizationActor,
    capability: LeaveCapability,
    decision: AuthorizationDecision,
): readonly AuthorizationScope[] | null {
    try {
        return buildLeaveCapabilityAuthorization(
            actor,
            capability,
            decision,
        ).scopes;
    } catch (error) {
        if (
            error instanceof LeaveCapabilityDeniedError
            && error.authorizationReason !== "UNKNOWN_CAPABILITY"
        ) {
            return null;
        }
        throw error;
    }
}

function hasLeaveScope(
    scopes: readonly AuthorizationScope[] | null,
    scope: AuthorizationScope,
): boolean {
    return scopes?.includes(scope) === true || scopes?.includes("ALL") === true;
}

/**
 * Projects the registered Leave capability inventory for presentation only.
 * Resource ownership, effective approver relationships, and workflow state
 * remain separate Leave-owned checks.
 */
export async function getLeavePresentationCapabilities(
    context: LeaveAuthorizationContext,
): Promise<LeavePresentationCapabilities> {
    const actor = context.authorizationActor;
    const decisions = await authorization.resolveMany(
        actor,
        LEAVE_CAPABILITIES,
    );

    const project = (
        capability: LeaveCapability,
    ): readonly AuthorizationScope[] | null =>
        projectLeaveCapabilityDecision(
            actor,
            capability,
            getLeavePresentationDecision(decisions, capability),
        );

    return Object.freeze({
        canReadOwnRequests: hasLeaveScope(
            project("leave.request.read"),
            "OWN",
        ),
        canReadAssignedApprovals: hasLeaveScope(
            project("leave.approval.read"),
            "ASSIGNED",
        ),
        canCreateOwnRequests: hasLeaveScope(
            project("leave.request.create"),
            "OWN",
        ),
        canCancelOwnRequests: hasLeaveScope(
            project("leave.request.cancel"),
            "OWN",
        ),
        canApproveAssignedRequests: hasLeaveScope(
            project("leave.request.approve"),
            "ASSIGNED",
        ),
        canDecideAssignedCancellations: hasLeaveScope(
            project("leave.cancellation.decide"),
            "ASSIGNED",
        ),
        canRequestOwnNotTaken: hasLeaveScope(
            project("leave.request.not_taken"),
            "OWN",
        ),
        canConfirmAssignedNotTaken: hasLeaveScope(
            project("leave.request.not_taken"),
            "ASSIGNED",
        ),
        canManageApprovers: hasLeaveScope(
            project("leave.approver.manage"),
            "ALL",
        ),
        canManageRecovery: hasLeaveScope(
            project("leave.recovery.manage"),
            "ALL",
        ),
    });
}

export async function resolveLeaveCapability(
    context: LeaveAuthorizationContext,
    capability: string,
): Promise<LeaveCapabilityAuthorization> {
    const actor = context.authorizationActor;
    const decision = await authorization.resolve(actor, capability);
    return buildLeaveCapabilityAuthorization(actor, capability, decision);
}

export async function assertLeaveCapability(
    context: LeaveAuthorizationContext,
    capability: string,
): Promise<LeaveCapabilityAuthorization> {
    return resolveLeaveCapability(context, capability);
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

export function canUseLeaveRecoveryOverride(
    capabilityAuthorization: LeaveCapabilityAuthorization,
): boolean {
    return (
        capabilityAuthorization.capability === "leave.recovery.manage"
        && capabilityAuthorization.scopes.includes("ALL")
        && capabilityAuthorization.actor.channel === "DASHBOARD"
    );
}

/**
 * Compatibility-named export retained while Leave callers migrate their
 * terminology. Authority is now exclusively the dedicated recovery
 * capability; this helper no longer inspects the actor's system role.
 */
export const canUseLeaveAdminRecoveryOverride = canUseLeaveRecoveryOverride;

interface ActiveLeaveAuthorizationUser {
    readonly id: number;
    readonly role: string;
    readonly isActive: boolean;
    readonly deletedAt: Date | null;
    readonly employee: {
        readonly id: number;
        readonly status: string;
        readonly deletedAt: Date | null;
    };
}

async function findActiveLeaveAuthorizationUser(
    tx: Prisma.TransactionClient,
    requestedActor: LeaveAuthorizationActor,
): Promise<ActiveLeaveAuthorizationUser> {
    if (requestedActor.employeeId === null) {
        throw new WorkforceAuthorizationError();
    }

    await lockUserRows(tx, [requestedActor.userId]);
    await lockEmployeeRows(tx, [requestedActor.employeeId]);

    const user = await tx.user.findFirst({
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

    const employee = user.employee;
    if (
        employee === null
        || employee.id !== requestedActor.employeeId
        || employee.status !== "ACTIVE"
        || employee.deletedAt !== null
    ) {
        throw new WorkforceAuthorizationError();
    }

    return {
        id: user.id,
        role: user.role,
        isActive: user.isActive,
        deletedAt: user.deletedAt,
        employee,
    };
}

function buildCurrentLeaveAuthorizationActor(
    requestedActor: LeaveAuthorizationActor,
    user: ActiveLeaveAuthorizationUser,
): LeaveAuthorizationActor {
    return buildLeaveAuthorizationActor(
        { id: user.id, role: parseUserRole(user.role) },
        user.employee.id,
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
    const user = await findActiveLeaveAuthorizationUser(tx, requestedActor);
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

/**
 * Recovery has no default authority. Only the expected absence of the
 * dedicated recovery grant is converted into `null`; structural resolver and
 * persisted-configuration failures remain fail-closed exceptions.
 */
export async function resolveOptionalLeaveRecoveryCapabilityInTransaction(
    tx: Prisma.TransactionClient,
    context: LeaveAuthorizationContext,
): Promise<LeaveCapabilityAuthorization | null> {
    try {
        return await resolveLeaveCapabilityInTransaction(
            tx,
            context,
            "leave.recovery.manage",
        );
    } catch (error) {
        if (
            error instanceof LeaveCapabilityDeniedError
            && error.authorizationReason === "NO_APPLICABLE_GRANT"
        ) {
            return null;
        }
        throw error;
    }
}
