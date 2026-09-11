import type { Prisma } from "@prisma/client";

import {
    authorization,
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

export const ROUTINE_MIGRATED_CAPABILITIES = [
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

export type RoutineMigratedCapability =
    (typeof ROUTINE_MIGRATED_CAPABILITIES)[number];

export type RoutineTaskReadView = "management" | "work-item";

export interface RoutineCapabilityOptions {
    readonly taskReadView?: RoutineTaskReadView;
    readonly requestedScope?: "mine" | "all";
}

export interface RoutineCapabilityAuthorization {
    readonly actor: AuthorizationActor;
    readonly capability: RoutineMigratedCapability;
    readonly decision: AuthorizationDecision;
    /** Effective scopes after Routine's temporary migration compatibility rules. */
    readonly scopes: readonly AuthorizationScope[];
    /** True only for Dashboard ADMIN system-role authorization. */
    readonly isAdministrative: boolean;
    readonly usedMigrationCompatibility: boolean;
    readonly usedLiffSelfServiceCompatibility: boolean;
}

export interface RoutineActorAuthorization {
    readonly authorizationActor: AuthorizationActor;
    readonly employeeId: number | null;
}

const ROUTINE_CAPABILITY_SET = new Set<string>(
    ROUTINE_MIGRATED_CAPABILITIES,
);

function isRoutineMigratedCapability(
    capability: string,
): capability is RoutineMigratedCapability {
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
 * Legacy presentation predicate retained only by deferred summary/reference
 * projections. Migrated capability decisions use the central resolver below.
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

function legacyRoutineScopes(
    actor: AuthorizationActor,
    capability: RoutineMigratedCapability,
    options: RoutineCapabilityOptions,
): readonly AuthorizationScope[] | null {
    if (actor.systemRole !== "USER") return null;

    return routineSelfServiceScopes(capability, options);
}

function routineSelfServiceScopes(
    capability: RoutineMigratedCapability,
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

function getEffectiveScopes(
    actor: AuthorizationActor,
    capability: RoutineMigratedCapability,
    decision: AuthorizationDecision,
    options: RoutineCapabilityOptions,
): {
    scopes: readonly AuthorizationScope[];
    usedMigrationCompatibility: boolean;
    usedLiffSelfServiceCompatibility: boolean;
} {
    if (!decision.allowed) {
        const legacyScopes = decision.reason === "NO_APPLICABLE_GRANT"
            ? legacyRoutineScopes(actor, capability, options)
            : null;
        if (legacyScopes === null) {
            throw new RoutineCapabilityDeniedError(decision.reason);
        }
        return {
            scopes: freezeScopes(legacyScopes),
            usedMigrationCompatibility: true,
            usedLiffSelfServiceCompatibility: false,
        };
    }

    const isLiffAdmin = actor.channel === "LIFF_SELF_SERVICE"
        && actor.systemRole === "ADMIN";
    if (!isLiffAdmin) {
        return {
            scopes: decision.scopes,
            usedMigrationCompatibility: false,
            usedLiffSelfServiceCompatibility: false,
        };
    }

    const selfServiceScopes = routineSelfServiceScopes(capability, options);
    if (selfServiceScopes === null) {
        throw new RoutineCapabilityDeniedError(decision.reason);
    }
    return {
        scopes: freezeScopes(selfServiceScopes),
        usedMigrationCompatibility: false,
        usedLiffSelfServiceCompatibility: true,
    };
}

function buildRoutineCapabilityAuthorization(
    actor: AuthorizationActor,
    capability: RoutineMigratedCapability,
    decision: AuthorizationDecision,
    options: RoutineCapabilityOptions,
): RoutineCapabilityAuthorization {
    const effective = getEffectiveScopes(actor, capability, decision, options);
    return Object.freeze({
        actor,
        capability,
        decision,
        scopes: effective.scopes,
        isAdministrative: isDashboardSystemRoleAuthorization(actor, decision),
        usedMigrationCompatibility: effective.usedMigrationCompatibility,
        usedLiffSelfServiceCompatibility:
            effective.usedLiffSelfServiceCompatibility,
    });
}

export async function resolveRoutineCapabilityForMigration(
    actor: RoutineCommandActor,
    employeeId: number | null,
    capability: string,
    options: RoutineCapabilityOptions = {},
): Promise<RoutineCapabilityAuthorization> {
    if (!isRoutineMigratedCapability(capability)) {
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

async function canResolveRoutinePresentationCapability(
    actor: RoutineCommandActor,
    employeeId: number | null,
    capability: RoutineMigratedCapability,
): Promise<boolean> {
    try {
        await resolveRoutineCapabilityForMigration(actor, employeeId, capability);
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

export async function getRoutinePresentationCapabilities(
    actor: RoutineCommandActor,
    employeeId: number | null,
): Promise<RoutinePresentationCapabilities> {
    const [
        canReadTasks,
        canCreateTasks,
        canUpdateTasks,
        canDeleteTasks,
        canReadOccurrences,
        canOverrideOccurrences,
        canReassignOccurrences,
        canChangeOccurrenceDueDate,
        canManageImports,
    ] = await Promise.all([
        canResolveRoutinePresentationCapability(
            actor,
            employeeId,
            "routine.task.read",
        ),
        canResolveRoutinePresentationCapability(
            actor,
            employeeId,
            "routine.task.create",
        ),
        canResolveRoutinePresentationCapability(
            actor,
            employeeId,
            "routine.task.update",
        ),
        canResolveRoutinePresentationCapability(
            actor,
            employeeId,
            "routine.task.delete",
        ),
        canResolveRoutinePresentationCapability(
            actor,
            employeeId,
            "routine.occurrence.read",
        ),
        canResolveRoutinePresentationCapability(
            actor,
            employeeId,
            "routine.occurrence.override",
        ),
        canResolveRoutinePresentationCapability(
            actor,
            employeeId,
            "routine.occurrence.reassign",
        ),
        canResolveRoutinePresentationCapability(
            actor,
            employeeId,
            "routine.occurrence.change_due_date",
        ),
        canResolveRoutinePresentationCapability(
            actor,
            employeeId,
            "routine.import.manage",
        ),
    ]);

    return Object.freeze({
        canReadTasks,
        canCreateTasks,
        canUpdateTasks,
        canDeleteTasks,
        canReadOccurrences,
        canOverrideOccurrences,
        canReassignOccurrences,
        canChangeOccurrenceDueDate,
        canManageImports,
    });
}

/**
 * Route preflight for legacy Admin-guarded endpoints. The mutation service
 * resolves the same capability again inside its transaction.
 */
export async function assertRoutineCapabilityForMigration(
    actor: RoutineCommandActor,
    employeeId: number | null,
    capability: string,
): Promise<void> {
    await resolveRoutineCapabilityForMigration(actor, employeeId, capability);
}

export async function resolveRoutineCapabilityInTransaction(
    tx: AuthorizationPersistenceContext,
    activeActor: RoutineActorAuthorization,
    capability: string,
    options: RoutineCapabilityOptions = {},
): Promise<RoutineCapabilityAuthorization> {
    if (!isRoutineMigratedCapability(capability)) {
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
