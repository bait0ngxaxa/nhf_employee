import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS,
    type AuthorizationProductionEmployeeSnapshot,
    type AuthorizationProductionInventorySnapshot,
    type AuthorizationProductionMigrationSnapshot,
    type AuthorizationProductionReadinessRepository,
    type AuthorizationProductionUserRole,
} from "../../application/production-readiness";

type AuthorizationProductionReadinessQueryContext = Pick<
    Prisma.TransactionClient,
    | "team"
    | "teamRole"
    | "teamMembership"
    | "teamCapabilityGrant"
    | "teamRoleCapabilityGrant"
    | "userCapabilityGrant"
    | "user"
    | "employee"
    | "$queryRaw"
>;

interface RawMigrationRow {
    readonly migration_name: string;
    readonly finished_at: Date | null;
    readonly rolled_back_at: Date | null;
    readonly applied_steps_count: number;
}

function mapEmployeeStatus(
    status: string,
): AuthorizationProductionEmployeeSnapshot["status"] {
    if (status === "ACTIVE" || status === "INACTIVE" || status === "SUSPENDED") {
        return status;
    }
    throw new Error("Invalid persisted Employee lifecycle status");
}

function mapUserRole(role: string): AuthorizationProductionUserRole {
    if (role === "USER" || role === "ADMIN") return role;
    throw new Error("Invalid persisted User system role");
}

async function loadAuthorizationProductionInventory(
    context: AuthorizationProductionReadinessQueryContext,
): Promise<AuthorizationProductionInventorySnapshot> {
    const [
        teams,
        teamRoles,
        memberships,
        teamGrants,
        teamRoleGrants,
        userGrants,
        users,
        employees,
        migrationRows,
    ] = await Promise.all([
        context.team.findMany({
            select: { id: true, isActive: true },
            orderBy: { id: "asc" },
        }),
        context.teamRole.findMany({
            select: { id: true, teamId: true, isActive: true },
            orderBy: { id: "asc" },
        }),
        context.teamMembership.findMany({
            select: { teamId: true, userId: true, teamRoleId: true },
            orderBy: [{ teamId: "asc" }, { userId: "asc" }],
        }),
        context.teamCapabilityGrant.findMany({
            select: { teamId: true, capabilityKey: true, scope: true },
            orderBy: [
                { teamId: "asc" },
                { capabilityKey: "asc" },
                { scope: "asc" },
            ],
        }),
        context.teamRoleCapabilityGrant.findMany({
            select: {
                teamRoleId: true,
                capabilityKey: true,
                scope: true,
                teamRole: { select: { teamId: true } },
            },
            orderBy: [
                { teamRoleId: "asc" },
                { capabilityKey: "asc" },
                { scope: "asc" },
            ],
        }),
        context.userCapabilityGrant.findMany({
            select: { userId: true, capabilityKey: true, scope: true },
            orderBy: [
                { userId: "asc" },
                { capabilityKey: "asc" },
                { scope: "asc" },
            ],
        }),
        context.user.findMany({
            select: {
                id: true,
                role: true,
                isActive: true,
                deletedAt: true,
                employeeId: true,
            },
            orderBy: { id: "asc" },
        }),
        context.employee.findMany({
            select: { id: true, status: true, deletedAt: true },
            orderBy: { id: "asc" },
        }),
        context.$queryRaw<readonly RawMigrationRow[]>(Prisma.sql`
            SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
            FROM _prisma_migrations
            WHERE migration_name IN (${Prisma.join([...AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS])})
            ORDER BY migration_name ASC
        `),
    ]);

    const migrations: readonly AuthorizationProductionMigrationSnapshot[] =
        migrationRows.map((row) => ({
            migrationName: row.migration_name,
            finishedAt: row.finished_at,
            rolledBackAt: row.rolled_back_at,
            appliedStepsCount: row.applied_steps_count,
        }));

    return {
        teams,
        teamRoles,
        memberships,
        teamGrants,
        teamRoleGrants: teamRoleGrants.map((grant) => ({
            teamRoleId: grant.teamRoleId,
            teamId: grant.teamRole?.teamId ?? null,
            capabilityKey: grant.capabilityKey,
            scope: grant.scope,
        })),
        userGrants,
        users: users.map((user) => ({
            id: user.id,
            role: mapUserRole(user.role),
            isActive: user.isActive,
            deletedAt: user.deletedAt,
            employeeId: user.employeeId,
        })),
        employees: employees.map((employee) => ({
            id: employee.id,
            status: mapEmployeeStatus(employee.status),
            deletedAt: employee.deletedAt,
        })),
        migrations,
    };
}

export function createAuthorizationProductionReadinessRepository(
    database: PrismaClient = prisma,
): AuthorizationProductionReadinessRepository {
    return {
        async load(): Promise<AuthorizationProductionInventorySnapshot> {
            return database.$transaction(
                (transaction) => loadAuthorizationProductionInventory(transaction),
                {
                    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
                    maxWait: 10_000,
                    timeout: 60_000,
                },
            );
        },
    };
}

export const authorizationProductionReadinessRepository =
    createAuthorizationProductionReadinessRepository();
