import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type {
    AuthorizationAdministrationPersistenceContext,
    AuthorizationAdministrationRepository,
    AuthorizationAdministrationTeamDetailRecord,
    AuthorizationAdministrationTeamRecord,
    AuthorizationAdministrationRawUserIdentity,
    AuthorizationAdministrationUserRecord,
} from "../../application/administration-types";
import {
    AUTHORIZATION_ADMINISTRATION_USER_SEARCH_LIMIT,
} from "../../application/administration-types";

const TEAM_SUMMARY_SELECT = {
    id: true,
    key: true,
    name: true,
    description: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    _count: {
        select: {
            roles: true,
            memberships: true,
            grants: true,
        },
    },
} as const satisfies Prisma.TeamSelect;

const TEAM_REFERENCE_SELECT = {
    id: true,
    key: true,
    name: true,
    isActive: true,
} as const satisfies Prisma.TeamSelect;

const TEAM_ROLE_REFERENCE_SELECT = {
    id: true,
    teamId: true,
    key: true,
    name: true,
    isActive: true,
} as const satisfies Prisma.TeamRoleSelect;

const USER_TEAM_PRESENTATION_SELECT = {
    id: true,
    name: true,
    isActive: true,
} as const satisfies Prisma.TeamSelect;

const USER_IDENTITY_SELECT = {
    id: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    deletedAt: true,
    employee: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
            status: true,
            deletedAt: true,
        },
    },
    teamMemberships: {
        where: { team: { isActive: true } },
        orderBy: [{ team: { name: "asc" } }, { teamId: "asc" }],
        select: {
            team: { select: USER_TEAM_PRESENTATION_SELECT },
        },
    },
} as const satisfies Prisma.UserSelect;

const RAW_GRANT_SELECT = {
    capabilityKey: true,
    scope: true,
} as const;

const TEAM_DETAIL_SELECT = {
    ...TEAM_SUMMARY_SELECT,
    roles: {
        orderBy: { key: "asc" },
        select: {
            ...TEAM_ROLE_REFERENCE_SELECT,
            createdAt: true,
            updatedAt: true,
            _count: {
                select: {
                    memberships: true,
                    grants: true,
                },
            },
            grants: {
                orderBy: [{ capabilityKey: "asc" }, { scope: "asc" }],
                select: RAW_GRANT_SELECT,
            },
        },
    },
    memberships: {
        orderBy: { userId: "asc" },
        select: {
            teamId: true,
            userId: true,
            teamRoleId: true,
            role: { select: TEAM_ROLE_REFERENCE_SELECT },
            user: { select: USER_IDENTITY_SELECT },
        },
    },
    grants: {
        orderBy: [{ capabilityKey: "asc" }, { scope: "asc" }],
        select: RAW_GRANT_SELECT,
    },
} as const satisfies Prisma.TeamSelect;

const USER_DETAIL_SELECT = {
    ...USER_IDENTITY_SELECT,
    teamMemberships: {
        orderBy: { teamId: "asc" },
        select: {
            teamId: true,
            userId: true,
            teamRoleId: true,
            team: { select: TEAM_REFERENCE_SELECT },
            role: { select: TEAM_ROLE_REFERENCE_SELECT },
        },
    },
    userCapabilityGrants: {
        orderBy: [{ capabilityKey: "asc" }, { scope: "asc" }],
        select: RAW_GRANT_SELECT,
    },
} as const satisfies Prisma.UserSelect;

type TeamSummaryRow = Prisma.TeamGetPayload<{
    select: typeof TEAM_SUMMARY_SELECT;
}>;
type TeamDetailRow = Prisma.TeamGetPayload<{
    select: typeof TEAM_DETAIL_SELECT;
}>;
type UserDetailRow = Prisma.UserGetPayload<{
    select: typeof USER_DETAIL_SELECT;
}>;

function projectTeamSummary(row: TeamSummaryRow): AuthorizationAdministrationTeamRecord {
    return {
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        roleCount: row._count.roles,
        membershipCount: row._count.memberships,
        teamGrantCount: row._count.grants,
    };
}

function projectTeamDetail(row: TeamDetailRow): AuthorizationAdministrationTeamDetailRecord {
    return {
        ...projectTeamSummary({
            ...row,
            _count: row._count,
        }),
        roles: row.roles.map((role) => ({
            id: role.id,
            teamId: role.teamId,
            key: role.key,
            name: role.name,
            isActive: role.isActive,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
            membershipCount: role._count.memberships,
            grantCount: role._count.grants,
            grants: role.grants,
        })),
        memberships: row.memberships,
        grants: row.grants,
    };
}

function projectUserDetail(row: UserDetailRow): AuthorizationAdministrationUserRecord {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        isActive: row.isActive,
        deletedAt: row.deletedAt,
        employee: row.employee,
        teamMemberships: row.teamMemberships,
        userCapabilityGrants: row.userCapabilityGrants,
    };
}

function buildUserSearchWhere(query: string): Prisma.UserWhereInput | undefined {
    if (query.length === 0) return undefined;

    const searchClauses: Prisma.UserWhereInput[] = [
        { name: { contains: query } },
        { email: { contains: query } },
        {
            employee: {
                is: {
                    OR: [
                        { firstName: { contains: query } },
                        { lastName: { contains: query } },
                        { nickname: { contains: query } },
                    ],
                },
            },
        },
    ];

    if (/^\d+$/.test(query)) {
        const numericId = Number(query);
        if (Number.isSafeInteger(numericId) && numericId > 0) {
            searchClauses.unshift({ id: numericId });
        }
    }

    return { OR: searchClauses };
}

export function createAuthorizationAdministrationRepository(
    context: AuthorizationAdministrationPersistenceContext = prisma,
): AuthorizationAdministrationRepository {
    return {
        async listTeams(): Promise<readonly AuthorizationAdministrationTeamRecord[]> {
            const rows = await context.team.findMany({
                orderBy: { key: "asc" },
                select: TEAM_SUMMARY_SELECT,
            });
            return rows.map(projectTeamSummary);
        },

        async findTeamById(
            teamId: number,
        ): Promise<AuthorizationAdministrationTeamDetailRecord | null> {
            const row = await context.team.findUnique({
                where: { id: teamId },
                select: TEAM_DETAIL_SELECT,
            });
            return row === null ? null : projectTeamDetail(row);
        },

        async searchUsers(
            query: string,
        ): Promise<readonly AuthorizationAdministrationRawUserIdentity[]> {
            const rows = await context.user.findMany({
                where: buildUserSearchWhere(query),
                orderBy: [{ name: "asc" }, { id: "asc" }],
                take: AUTHORIZATION_ADMINISTRATION_USER_SEARCH_LIMIT,
                select: USER_IDENTITY_SELECT,
            });
            return rows;
        },

        async findUserById(
            userId: number,
        ): Promise<AuthorizationAdministrationUserRecord | null> {
            const row = await context.user.findUnique({
                where: { id: userId },
                select: USER_DETAIL_SELECT,
            });
            return row === null ? null : projectUserDetail(row);
        },
    };
}

export const authorizationAdministrationRepository: AuthorizationAdministrationRepository =
    createAuthorizationAdministrationRepository();
