import type { Prisma } from "@prisma/client";

import type {
    AuthorizationAdministrationMutationMembership,
    AuthorizationAdministrationMutationRepository,
    AuthorizationAdministrationMutationTeam,
    AuthorizationAdministrationMutationTeamGrant,
    AuthorizationAdministrationMutationTeamRole,
    AuthorizationAdministrationMutationTeamRoleGrant,
    AuthorizationAdministrationMutationUser,
} from "../../application/administration-mutation-types";

const TEAM_SELECT = {
    id: true,
    key: true,
    name: true,
    description: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
} as const satisfies Prisma.TeamSelect;

const TEAM_ROLE_SELECT = {
    id: true,
    teamId: true,
    key: true,
    name: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
} as const satisfies Prisma.TeamRoleSelect;

const MEMBERSHIP_SELECT = {
    teamId: true,
    userId: true,
    teamRoleId: true,
    role: { select: TEAM_ROLE_SELECT },
} as const satisfies Prisma.TeamMembershipSelect;

const TEAM_GRANT_SELECT = {
    teamId: true,
    capabilityKey: true,
    scope: true,
} as const satisfies Prisma.TeamCapabilityGrantSelect;

const TEAM_ROLE_GRANT_SELECT = {
    teamRoleId: true,
    capabilityKey: true,
    scope: true,
    teamRole: { select: { teamId: true } },
} as const satisfies Prisma.TeamRoleCapabilityGrantSelect;

type TeamRow = Prisma.TeamGetPayload<{ select: typeof TEAM_SELECT }>;
type TeamRoleRow = Prisma.TeamRoleGetPayload<{
    select: typeof TEAM_ROLE_SELECT;
}>;
type MembershipRow = Prisma.TeamMembershipGetPayload<{
    select: typeof MEMBERSHIP_SELECT;
}>;
type TeamGrantRow = Prisma.TeamCapabilityGrantGetPayload<{
    select: typeof TEAM_GRANT_SELECT;
}>;
type TeamRoleGrantRow = Prisma.TeamRoleCapabilityGrantGetPayload<{
    select: typeof TEAM_ROLE_GRANT_SELECT;
}>;

function projectTeam(row: TeamRow): AuthorizationAdministrationMutationTeam {
    return row;
}

function projectTeamRole(
    row: TeamRoleRow,
): AuthorizationAdministrationMutationTeamRole {
    return row;
}

function projectMembership(
    row: MembershipRow,
): AuthorizationAdministrationMutationMembership {
    return {
        teamId: row.teamId,
        userId: row.userId,
        teamRoleId: row.teamRoleId,
        role: row.role,
    };
}

function projectTeamGrant(
    row: TeamGrantRow,
): AuthorizationAdministrationMutationTeamGrant {
    return row;
}

function projectTeamRoleGrant(
    row: TeamRoleGrantRow,
): AuthorizationAdministrationMutationTeamRoleGrant {
    return {
        teamRoleId: row.teamRoleId,
        teamId: row.teamRole.teamId,
        capabilityKey: row.capabilityKey,
        scope: row.scope,
    };
}

export function createAuthorizationAdministrationMutationRepository():
    AuthorizationAdministrationMutationRepository {
    return {
        async findTeamById(tx, teamId) {
            const row = await tx.team.findUnique({
                where: { id: teamId },
                select: TEAM_SELECT,
            });
            return row === null ? null : projectTeam(row);
        },

        async findTeamByKey(tx, key) {
            const row = await tx.team.findUnique({
                where: { key },
                select: TEAM_SELECT,
            });
            return row === null ? null : projectTeam(row);
        },

        async createTeam(tx, input) {
            const row = await tx.team.create({
                data: input,
                select: TEAM_SELECT,
            });
            return projectTeam(row);
        },

        async updateTeam(tx, teamId, input) {
            const row = await tx.team.update({
                where: { id: teamId },
                data: input,
                select: TEAM_SELECT,
            });
            return projectTeam(row);
        },

        async findTeamRoleById(tx, teamRoleId) {
            const row = await tx.teamRole.findUnique({
                where: { id: teamRoleId },
                select: TEAM_ROLE_SELECT,
            });
            return row === null ? null : projectTeamRole(row);
        },

        async findTeamRoleByTeamAndKey(tx, teamId, key) {
            const row = await tx.teamRole.findUnique({
                where: { teamId_key: { teamId, key } },
                select: TEAM_ROLE_SELECT,
            });
            return row === null ? null : projectTeamRole(row);
        },

        async createTeamRole(tx, input) {
            const row = await tx.teamRole.create({
                data: input,
                select: TEAM_ROLE_SELECT,
            });
            return projectTeamRole(row);
        },

        async updateTeamRole(tx, teamRoleId, input) {
            const row = await tx.teamRole.update({
                where: { id: teamRoleId },
                data: input,
                select: TEAM_ROLE_SELECT,
            });
            return projectTeamRole(row);
        },

        async findUserById(tx, userId): Promise<AuthorizationAdministrationMutationUser | null> {
            const row = await tx.user.findUnique({
                where: { id: userId },
                select: { id: true },
            });
            return row;
        },

        async findMembership(tx, teamId, userId) {
            const row = await tx.teamMembership.findUnique({
                where: { teamId_userId: { teamId, userId } },
                select: MEMBERSHIP_SELECT,
            });
            return row === null ? null : projectMembership(row);
        },

        async listMembershipsForTeam(tx, teamId) {
            const rows = await tx.teamMembership.findMany({
                where: { teamId },
                orderBy: { userId: "asc" },
                select: MEMBERSHIP_SELECT,
            });
            return rows.map(projectMembership);
        },

        async createMembership(tx, input) {
            const row = await tx.teamMembership.create({
                data: input,
                select: MEMBERSHIP_SELECT,
            });
            return projectMembership(row);
        },

        async updateMembershipRole(tx, teamId, userId, teamRoleId) {
            const row = await tx.teamMembership.update({
                where: { teamId_userId: { teamId, userId } },
                data: { teamRoleId },
                select: MEMBERSHIP_SELECT,
            });
            return projectMembership(row);
        },

        async deleteMembership(tx, teamId, userId) {
            const row = await tx.teamMembership.delete({
                where: { teamId_userId: { teamId, userId } },
                select: MEMBERSHIP_SELECT,
            });
            return projectMembership(row);
        },

        async listTeamGrants(tx, teamId) {
            const rows = await tx.teamCapabilityGrant.findMany({
                where: { teamId },
                orderBy: [{ capabilityKey: "asc" }, { scope: "asc" }],
                select: TEAM_GRANT_SELECT,
            });
            return rows.map(projectTeamGrant);
        },

        async listTeamRoleGrantsForTeam(tx, teamId) {
            const rows = await tx.teamRoleCapabilityGrant.findMany({
                where: {
                    teamRole: {
                        is: {
                            teamId,
                            isActive: true,
                            memberships: { some: { teamId } },
                        },
                    },
                },
                orderBy: [
                    { teamRoleId: "asc" },
                    { capabilityKey: "asc" },
                    { scope: "asc" },
                ],
                select: TEAM_ROLE_GRANT_SELECT,
            });
            return rows.map(projectTeamRoleGrant);
        },

        async listTeamRoleGrants(tx, teamRoleId) {
            const rows = await tx.teamRoleCapabilityGrant.findMany({
                where: { teamRoleId },
                orderBy: [{ capabilityKey: "asc" }, { scope: "asc" }],
                select: TEAM_ROLE_GRANT_SELECT,
            });
            return rows.map(projectTeamRoleGrant);
        },

        async findTeamGrant(tx, teamId, capabilityKey, scope) {
            const row = await tx.teamCapabilityGrant.findUnique({
                where: {
                    teamId_capabilityKey_scope: { teamId, capabilityKey, scope },
                },
                select: TEAM_GRANT_SELECT,
            });
            return row === null ? null : projectTeamGrant(row);
        },

        async createTeamGrant(tx, input) {
            const row = await tx.teamCapabilityGrant.create({
                data: input,
                select: TEAM_GRANT_SELECT,
            });
            return projectTeamGrant(row);
        },

        async deleteTeamGrant(tx, input) {
            const row = await tx.teamCapabilityGrant.delete({
                where: {
                    teamId_capabilityKey_scope: input,
                },
                select: TEAM_GRANT_SELECT,
            });
            return projectTeamGrant(row);
        },

        async findTeamRoleGrant(tx, teamRoleId, capabilityKey, scope) {
            const row = await tx.teamRoleCapabilityGrant.findUnique({
                where: {
                    teamRoleId_capabilityKey_scope: {
                        teamRoleId,
                        capabilityKey,
                        scope,
                    },
                },
                select: TEAM_ROLE_GRANT_SELECT,
            });
            return row === null ? null : projectTeamRoleGrant(row);
        },

        async createTeamRoleGrant(tx, input) {
            const row = await tx.teamRoleCapabilityGrant.create({
                data: {
                    teamRoleId: input.teamRoleId,
                    capabilityKey: input.capabilityKey,
                    scope: input.scope,
                },
                select: TEAM_ROLE_GRANT_SELECT,
            });
            return projectTeamRoleGrant(row);
        },

        async deleteTeamRoleGrant(tx, input) {
            const row = await tx.teamRoleCapabilityGrant.delete({
                where: {
                    teamRoleId_capabilityKey_scope: {
                        teamRoleId: input.teamRoleId,
                        capabilityKey: input.capabilityKey,
                        scope: input.scope,
                    },
                },
                select: TEAM_ROLE_GRANT_SELECT,
            });
            return projectTeamRoleGrant(row);
        },

        async findUserGrant(tx, userId, capabilityKey, scope) {
            const row = await tx.userCapabilityGrant.findUnique({
                where: {
                    userId_capabilityKey_scope: { userId, capabilityKey, scope },
                },
                select: { userId: true, capabilityKey: true, scope: true },
            });
            return row;
        },

        async createUserGrant(tx, input) {
            const row = await tx.userCapabilityGrant.create({
                data: input,
                select: { userId: true, capabilityKey: true, scope: true },
            });
            return row;
        },

        async deleteUserGrant(tx, input) {
            const row = await tx.userCapabilityGrant.delete({
                where: {
                    userId_capabilityKey_scope: input,
                },
                select: { userId: true, capabilityKey: true, scope: true },
            });
            return row;
        },
    };
}

export const authorizationAdministrationMutationRepository =
    createAuthorizationAdministrationMutationRepository();
