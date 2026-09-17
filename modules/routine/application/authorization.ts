import type { Prisma } from "@prisma/client";

import {
    authorization,
    composeAuthorizationAuthority,
    type AuthorizationActor,
    type AuthorizationDecision,
    type AuthorizationPersistenceContext,
    type AuthorizationScope,
} from "@/modules/authorization";
import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";
import type { UserRole } from "@/lib/ssot/permissions";

import {
    RoutineForbiddenError,
    RoutineValidationError,
} from "./errors";
import type {
    RoutineCommandActor,
    RoutinePresentationCapabilities,
} from "./types";

type RoutineTransaction = Prisma.TransactionClient;

export const ROUTINE_ENFORCED_CAPABILITIES = [
    "routine.task.read",
    "routine.task.create",
    "routine.task.update",
    "routine.task.delete",
    "routine.occurrence.read",
    "routine.occurrence.override",
    "routine.occurrence.reassign",
    "routine.occurrence.change_due_date",
    "routine.import.manage",
] as const;

export type RoutineEnforcedCapability =
    (typeof ROUTINE_ENFORCED_CAPABILITIES)[number];

export type RoutineTaskReadView = "management" | "work-item";

export interface RoutineCapabilityOptions {
    readonly taskReadView?: RoutineTaskReadView;
    readonly requestedScope?: "mine" | "all";
}

export interface RoutineCapabilityAuthorization {
    readonly actor: AuthorizationActor;
    readonly capability: RoutineEnforcedCapability;
    readonly decision: AuthorizationDecision;
    /** Permanent normal-user Default Domain Policy scopes before composition. */
    readonly defaultScopes: readonly AuthorizationScope[];
    /** Final Routine scopes after central composition and channel policy. */
    readonly scopes: readonly AuthorizationScope[];
    /** True only for Dashboard ADMIN system-role authorization. */
    readonly isAdministrative: boolean;
    /** True when LIFF ADMIN authority was constrained to self-service policy. */
    readonly liffSelfServicePolicyApplied: boolean;
}

export interface RoutineActorAuthorization {
    readonly authorizationActor: AuthorizationActor;
    readonly employeeId: number | null;
}

const ROUTINE_CAPABILITY_SET = new Set<string>(
    ROUTINE_ENFORCED_CAPABILITIES,
);

function isRoutineEnforcedCapability(
    capability: string,
): capability is RoutineEnforcedCapability {
    return ROUTINE_CAPABILITY_SET.has(capability);
}

class RoutineCapabilityDeniedError extends RoutineForbiddenError {
    readonly authorizationReason: AuthorizationDecision["reason"];

    constructor(reason: AuthorizationDecision["reason"]) {
        super();
        this.name = "RoutineCapabilityDeniedError";
        this.authorizationReason = reason;
    }
}

function parseUserRole(role: string): UserRole {
    if (role === "ADMIN" || role === "USER") return role;
    throw new RoutineForbiddenError("บัญชีผู้ใช้ไม่พร้อมดำเนินการ");
}

function routineAuthorizationChannel(
    actor: RoutineCommandActor,
): AuthorizationActor["channel"] {
    return actor.mode === "LIFF_SELF_SERVICE"
        ? "LIFF_SELF_SERVICE"
        : "DASHBOARD";
}

export function buildRoutineAuthorizationActor(
    actor: RoutineCommandActor,
    employeeId: number | null,
    systemRole: string = actor.role,
): AuthorizationActor {
    return Object.freeze({
        userId: actor.id,
        employeeId,
        systemRole: parseUserRole(systemRole),
        channel: routineAuthorizationChannel(actor),
    });
}

/**
 * Deferred summary/reference/export projections still use this role-and-
 * channel predicate. Enforced Routine capabilities use the central resolver.
 */
export function isRoutineAdminActor(
    role: string,
    mode: RoutineCommandActor["mode"] = undefined,
): boolean {
    return role === "ADMIN" && mode !== "LIFF_SELF_SERVICE";
}

function freezeScopes(
    scopes: readonly AuthorizationScope[],
): readonly AuthorizationScope[] {
    return Object.freeze([...scopes]);
}

export function defaultRoutineScopes(
    actor: AuthorizationActor,
    capability: RoutineEnforcedCapability,
    options: RoutineCapabilityOptions = {},
): readonly AuthorizationScope[] {
    if (actor.systemRole !== "USER") return [];

    switch (capability) {
        case "routine.task.read":
            if (options.taskReadView === "work-item") {
                return options.requestedScope === "all"
                    ? ["ALL"]
                    : ["ASSIGNED"];
            }
            return ["CREATED", "ASSIGNED"];
        case "routine.task.create":
            return ["OWN"];
        case "routine.task.update":
            return ["CREATED", "ASSIGNED"];
        case "routine.task.delete":
            return ["CREATED"];
        case "routine.occurrence.read":
            return ["ASSIGNED"];
        case "routine.occurrence.override":
        case "routine.occurrence.reassign":
        case "routine.occurrence.change_due_date":
        case "routine.import.manage":
            return [];
    }
}

function routineLiffSelfServiceScopes(
    capability: RoutineEnforcedCapability,
    options: RoutineCapabilityOptions,
): readonly AuthorizationScope[] | null {

    switch (capability) {
        case "routine.task.read":
            if (options.taskReadView === "work-item") {
                return options.requestedScope === "all"
                    ? ["ALL"]
                    : ["ASSIGNED"];
            }
            return ["CREATED", "ASSIGNED"];
        case "routine.task.create":
            return ["OWN"];
        case "routine.task.update":
            return ["CREATED", "ASSIGNED"];
        case "routine.task.delete":
            return ["CREATED"];
        case "routine.occurrence.read":
            return ["ASSIGNED"];
        case "routine.occurrence.override":
        case "routine.occurrence.reassign":
        case "routine.occurrence.change_due_date":
        case "routine.import.manage":
            return null;
    }
}

function isDashboardSystemRoleAuthorization(
    actor: AuthorizationActor,
    decision: AuthorizationDecision,
): boolean {
    return actor.channel === "DASHBOARD"
        && actor.systemRole === "ADMIN"
        && decision.grants.some((grant) => grant.source.type === "SYSTEM_ROLE");
}

function applyRoutineChannelPolicy(
    actor: AuthorizationActor,
    capability: RoutineEnforcedCapability,
    options: RoutineCapabilityOptions,
    composedAuthority: ReturnType<typeof composeAuthorizationAuthority>,
): {
    scopes: readonly AuthorizationScope[];
    isAdministrative: boolean;
    liffSelfServicePolicyApplied: boolean;
} {
    if (!composedAuthority.allowed) {
        throw new RoutineCapabilityDeniedError(
            composedAuthority.configuredDecision.reason,
        );
    }

    const isLiffAdmin = actor.channel === "LIFF_SELF_SERVICE"
        && actor.systemRole === "ADMIN";
    if (!isLiffAdmin) {
        return {
            scopes: composedAuthority.scopes,
            isAdministrative: isDashboardSystemRoleAuthorization(
                actor,
                composedAuthority.configuredDecision,
            ),
            liffSelfServicePolicyApplied: false,
        };
    }

    const selfServiceScopes = routineLiffSelfServiceScopes(capability, options);
    if (selfServiceScopes === null) {
        throw new RoutineCapabilityDeniedError(
            composedAuthority.configuredDecision.reason,
        );
    }
    return {
        scopes: freezeScopes(selfServiceScopes),
        isAdministrative: false,
        liffSelfServicePolicyApplied: true,
    };
}

function buildRoutineCapabilityAuthorization(
    actor: AuthorizationActor,
    capability: RoutineEnforcedCapability,
    decision: AuthorizationDecision,
    options: RoutineCapabilityOptions,
): RoutineCapabilityAuthorization {
    const composedAuthority = composeAuthorizationAuthority(
        actor,
        capability,
        defaultRoutineScopes(actor, capability, options),
        decision,
    );
    const effective = applyRoutineChannelPolicy(
        actor,
        capability,
        options,
        composedAuthority,
    );
    return Object.freeze({
        actor,
        capability,
        decision,
        defaultScopes: composedAuthority.defaultScopes,
        scopes: effective.scopes,
        isAdministrative: effective.isAdministrative,
        liffSelfServicePolicyApplied: effective.liffSelfServicePolicyApplied,
    });
}

export async function resolveRoutineCapability(
    actor: RoutineCommandActor,
    employeeId: number | null,
    capability: string,
    options: RoutineCapabilityOptions = {},
): Promise<RoutineCapabilityAuthorization> {
    if (!isRoutineEnforcedCapability(capability)) {
        throw new RoutineForbiddenError();
    }
    const authorizationActor = buildRoutineAuthorizationActor(actor, employeeId);
    const decision = await authorization.resolve(authorizationActor, capability);
    return buildRoutineCapabilityAuthorization(
        authorizationActor,
        capability,
        decision,
        options,
    );
}

function projectRoutineCapabilityDecision(
    actor: AuthorizationActor,
    capability: RoutineEnforcedCapability,
    decision: AuthorizationDecision,
): boolean {
    try {
        buildRoutineCapabilityAuthorization(
            actor,
            capability,
            decision,
            {},
        );
        return true;
    } catch (error) {
        if (
            error instanceof RoutineCapabilityDeniedError
            && error.authorizationReason !== "UNKNOWN_CAPABILITY"
        ) {
            return false;
        }
        throw error;
    }
}

function getRoutinePresentationDecision(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: RoutineEnforcedCapability,
): AuthorizationDecision {
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(
            `Authorization resolver omitted Routine capability: ${capability}`,
        );
    }
    return decision;
}

export async function getRoutinePresentationCapabilities(
    actor: RoutineCommandActor,
    employeeId: number | null,
): Promise<RoutinePresentationCapabilities> {
    const authorizationActor = buildRoutineAuthorizationActor(
        actor,
        employeeId,
    );
    const decisions = await authorization.resolveMany(
        authorizationActor,
        ROUTINE_ENFORCED_CAPABILITIES,
    );

    const canResolve = (capability: RoutineEnforcedCapability): boolean =>
        projectRoutineCapabilityDecision(
            authorizationActor,
            capability,
            getRoutinePresentationDecision(decisions, capability),
        );

    return Object.freeze({
        canReadTasks: canResolve("routine.task.read"),
        canCreateTasks: canResolve("routine.task.create"),
        canUpdateTasks: canResolve("routine.task.update"),
        canDeleteTasks: canResolve("routine.task.delete"),
        canReadOccurrences: canResolve("routine.occurrence.read"),
        canOverrideOccurrences: canResolve("routine.occurrence.override"),
        canReassignOccurrences: canResolve("routine.occurrence.reassign"),
        canChangeOccurrenceDueDate: canResolve(
            "routine.occurrence.change_due_date",
        ),
        canManageImports: canResolve("routine.import.manage"),
    });
}

/**
 * Route preflight for Routine endpoints. The mutation service resolves the
 * same capability again inside its transaction.
 */
export async function assertRoutineCapability(
    actor: RoutineCommandActor,
    employeeId: number | null,
    capability: string,
): Promise<void> {
    await resolveRoutineCapability(actor, employeeId, capability);
}

export async function resolveRoutineCapabilityInTransaction(
    tx: AuthorizationPersistenceContext,
    activeActor: RoutineActorAuthorization,
    capability: string,
    options: RoutineCapabilityOptions = {},
): Promise<RoutineCapabilityAuthorization> {
    if (!isRoutineEnforcedCapability(capability)) {
        throw new RoutineForbiddenError();
    }
    const decision = await authorization.resolveInTransaction(
        activeActor.authorizationActor,
        capability,
        tx,
    );
    return buildRoutineCapabilityAuthorization(
        activeActor.authorizationActor,
        capability,
        decision,
        options,
    );
}

interface ActiveUserRecord {
    id: number;
    role: string;
    isActive: boolean;
    deletedAt: Date | null;
    employee: {
        id: number;
        status: string;
        deletedAt: Date | null;
    } | null;
}

async function findActiveUser(
    tx: RoutineTransaction,
    actorId: number,
): Promise<ActiveUserRecord | null> {
    await lockUserRows(tx, [actorId]);
    return tx.user.findUnique({
        where: { id: actorId },
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
}

function isActiveEmployee(
    employee: ActiveUserRecord["employee"],
): employee is NonNullable<ActiveUserRecord["employee"]> {
    return employee?.status === "ACTIVE" && employee.deletedAt === null;
}

export async function assertActiveRoutineActorInTransaction(
    tx: RoutineTransaction,
    actor: RoutineCommandActor,
): Promise<RoutineActorAuthorization> {
    const user = await findActiveUser(tx, actor.id);
    if (!user || !user.isActive || user.deletedAt !== null) {
        throw new RoutineForbiddenError("บัญชีผู้ใช้ไม่พร้อมดำเนินการ");
    }

    const systemRole = parseUserRole(user.role);
    const isDashboardAdmin = systemRole === "ADMIN"
        && actor.mode !== "LIFF_SELF_SERVICE";
    if (isDashboardAdmin) {
        if (user.employee && !isActiveEmployee(user.employee)) {
            throw new RoutineForbiddenError("บัญชีผู้ดูแลระบบไม่พร้อมดำเนินการ");
        }
        return {
            authorizationActor: buildRoutineAuthorizationActor(
                actor,
                user.employee?.id ?? null,
                user.role,
            ),
            employeeId: user.employee?.id ?? null,
        };
    }

    if (!isActiveEmployee(user.employee)) {
        throw new RoutineForbiddenError("บัญชีพนักงานไม่พร้อมดำเนินการ");
    }

    await lockEmployeeRows(tx, [user.employee.id]);
    return {
        authorizationActor: buildRoutineAuthorizationActor(
            actor,
            user.employee.id,
            user.role,
        ),
        employeeId: user.employee.id,
    };
}

export async function assertActiveWorkforceInTransaction(
    tx: RoutineTransaction,
    actor: RoutineCommandActor,
): Promise<number> {
    const user = await findActiveUser(tx, actor.id);
    if (
        !user
        || !user.isActive
        || user.deletedAt !== null
        || !user.employee
        || !isActiveEmployee(user.employee)
    ) {
        throw new RoutineForbiddenError("บัญชีพนักงานไม่พร้อมดำเนินการ");
    }

    await lockEmployeeRows(tx, [user.employee.id]);
    return user.employee.id;
}

export function buildRoutineTaskScope(
    actorId: number,
    employeeId: number | null,
    scopes: readonly AuthorizationScope[],
    options: { requireActiveAssignee?: boolean } = {},
): Prisma.RoutineTaskWhereInput {
    if (scopes.includes("ALL")) return {};

    const predicates: Prisma.RoutineTaskWhereInput[] = [];
    if (scopes.includes("CREATED")) {
        predicates.push({ createdById: actorId });
    }
    if (scopes.includes("ASSIGNED") && employeeId !== null) {
        predicates.push({
            assignees: {
                some: {
                    employeeId,
                    ...(options.requireActiveAssignee
                        ? { employee: activeEmployeeWhere() }
                        : {}),
                },
            },
        });
    }

    if (predicates.length === 0) return { id: { in: [] } };
    if (predicates.length === 1) return predicates[0];
    return { OR: predicates };
}

export function buildRoutineOccurrenceScope(
    employeeId: number | null,
    scopes: readonly AuthorizationScope[],
): Prisma.RoutineOccurrenceWhereInput {
    if (scopes.includes("ALL")) return {};
    if (!scopes.includes("ASSIGNED") || employeeId === null) {
        return { id: { in: [] } };
    }
    return {
        assignees: {
            some: { employeeId },
        },
    };
}

function activeEmployeeWhere(): Prisma.EmployeeWhereInput {
    return {
        status: "ACTIVE",
        deletedAt: null,
        user: {
            is: {
                isActive: true,
                deletedAt: null,
            },
        },
    };
}

export function buildRoutineTaskAccessScope(
    actorId: number,
    employeeId: number | null,
    scopes: readonly AuthorizationScope[],
): Prisma.RoutineTaskWhereInput {
    if (
        employeeId === null
        && scopes.includes("CREATED")
        && scopes.includes("ASSIGNED")
    ) {
        return { OR: [{ createdById: actorId }] };
    }
    return buildRoutineTaskScope(actorId, employeeId, scopes, {
        requireActiveAssignee: true,
    });
}

export async function assertActiveEmployeesInTransaction(
    tx: RoutineTransaction,
    employeeIds: readonly number[],
): Promise<void> {
    const uniqueEmployeeIds = [...new Set(employeeIds)];
    if (uniqueEmployeeIds.length === 0) {
        throw new RoutineValidationError("กรุณาระบุผู้รับผิดชอบ");
    }

    await lockEmployeeRows(tx, uniqueEmployeeIds);
    const employees = await tx.employee.findMany({
        where: {
            id: { in: uniqueEmployeeIds },
            status: "ACTIVE",
            deletedAt: null,
        },
        select: { id: true },
    });
    if (employees.length !== uniqueEmployeeIds.length) {
        throw new RoutineValidationError(
            "ผู้รับผิดชอบต้องเป็นพนักงานที่ยังปฏิบัติงาน",
        );
    }
}
