import { prisma } from "@/lib/db/prisma";

import type {
    AuthorizationPersistenceContext,
    AuthorizationResolutionData,
    AuthorizationResolutionRepository,
    AuthorizationResolutionManyRequest,
} from "../../application/types";

function emptyResolutionData(): AuthorizationResolutionData {
    return {
        userGrants: [],
        memberships: [],
        teamRoleGrants: [],
    };
}

export interface AuthorizationResolutionBatchRequest {
    readonly userIds: readonly number[];
    readonly capability: string;
}

/**
 * Load the same configured-resolution shape used by the canonical evaluator
 * for a bounded set of active users. This keeps recipient enumeration
 * set-based while allowing the application layer to evaluate each principal
 * with the canonical fail-closed rules.
 */
export async function loadAuthorizationResolutionsForUsers(
    context: AuthorizationPersistenceContext,
    request: AuthorizationResolutionBatchRequest,
): Promise<ReadonlyMap<number, AuthorizationResolutionData>> {
    const userIds = [...new Set(request.userIds)].sort((left, right) => left - right);
    if (userIds.length === 0) return new Map();

    const userIdFilter = userIds.length === 1
        ? userIds[0]
        : { in: userIds };

    const [userGrants, memberships] = await Promise.all([
        context.userCapabilityGrant.findMany({
            where: {
                userId: userIdFilter,
                capabilityKey: request.capability,
            },
            select: {
                userId: true,
                capabilityKey: true,
                scope: true,
            },
            orderBy: [{ userId: "asc" }, { scope: "asc" }],
        }),
        context.teamMembership.findMany({
            where: {
                userId: userIdFilter,
                team: { isActive: true },
            },
            select: {
                userId: true,
                teamId: true,
                teamRoleId: true,
                team: {
                    select: {
                        isActive: true,
                        grants: {
                            where: { capabilityKey: request.capability },
                            select: {
                                teamId: true,
                                capabilityKey: true,
                                scope: true,
                            },
                            orderBy: [{ scope: "asc" }],
                        },
                    },
                },
                role: {
                    select: {
                        id: true,
                        isActive: true,
                    },
                },
            },
            orderBy: [{ userId: "asc" }, { teamId: "asc" }],
        }),
    ]);

    const activeTeamRoleIds = [
        ...new Set(
            memberships.flatMap((membership) =>
                membership.role !== null && membership.role.isActive
                    ? [membership.role.id]
                    : [],
            ),
        ),
    ];
    const teamRoleGrants = activeTeamRoleIds.length === 0
        ? []
        : await context.teamRoleCapabilityGrant.findMany({
              where: {
                  capabilityKey: request.capability,
                  teamRoleId: { in: activeTeamRoleIds },
                  teamRole: {
                      is: {
                          isActive: true,
                          team: { is: { isActive: true } },
                          memberships: { some: { userId: userIdFilter } },
                      },
                  },
              },
              select: {
                  teamRoleId: true,
                  capabilityKey: true,
                  scope: true,
                  teamRole: {
                      select: {
                          teamId: true,
                      },
                  },
              },
              orderBy: [
                  { teamRoleId: "asc" },
                  { scope: "asc" },
              ],
          });

    const userGrantsByUserId = new Map<number, typeof userGrants>();
    for (const grant of userGrants) {
        const current = userGrantsByUserId.get(grant.userId) ?? [];
        current.push(grant);
        userGrantsByUserId.set(grant.userId, current);
    }

    const membershipsByUserId = new Map<number, typeof memberships>();
    for (const membership of memberships) {
        const current = membershipsByUserId.get(membership.userId) ?? [];
        current.push(membership);
        membershipsByUserId.set(membership.userId, current);
    }

    const resolutions = new Map<number, AuthorizationResolutionData>();
    for (const userId of userIds) {
        const userMemberships = membershipsByUserId.get(userId) ?? [];
        const roleIds = new Set(
            userMemberships.flatMap((membership) =>
                membership.role !== null && membership.role.isActive
                    ? [membership.role.id]
                    : [],
            ),
        );
        const userTeamRoleGrants = teamRoleGrants
            .filter((grant) => roleIds.has(grant.teamRoleId))
            .map((grant) => ({
                teamId: grant.teamRole.teamId,
                teamRoleId: grant.teamRoleId,
                capabilityKey: grant.capabilityKey,
                scope: grant.scope,
            }));

        resolutions.set(userId, {
            userGrants: userGrantsByUserId.get(userId) ?? [],
            memberships: userMemberships.map((membership) => ({
                userId: membership.userId,
                teamId: membership.teamId,
                isTeamActive: membership.team.isActive,
                teamRoleId: membership.teamRoleId,
                teamRole: membership.role === null
                    ? null
                    : {
                        id: membership.role.id,
                        isActive: membership.role.isActive,
                    },
                teamGrants: membership.team.grants,
            })),
            teamRoleGrants: userTeamRoleGrants,
        });
    }

    return resolutions;
}

async function loadAuthorizationResolution(
    context: AuthorizationPersistenceContext,
    request: AuthorizationResolutionManyRequest,
): Promise<AuthorizationResolutionData> {
    const capabilityKeys = [...new Set(request.capabilityKeys)];
    if (capabilityKeys.length === 0) return emptyResolutionData();

    const capabilityKeyFilter = capabilityKeys.length === 1
        ? capabilityKeys[0]
        : { in: capabilityKeys };

    const [userGrants, memberships] = await Promise.all([
        context.userCapabilityGrant.findMany({
            where: {
                userId: request.userId,
                capabilityKey: capabilityKeyFilter,
            },
            select: {
                userId: true,
                capabilityKey: true,
                scope: true,
            },
            orderBy: [{ scope: "asc" }],
        }),
        context.teamMembership.findMany({
            where: {
                userId: request.userId,
                team: { isActive: true },
            },
            select: {
                userId: true,
                teamId: true,
                teamRoleId: true,
                team: {
                    select: {
                        isActive: true,
                        grants: {
                            where: { capabilityKey: capabilityKeyFilter },
                            select: {
                                teamId: true,
                                capabilityKey: true,
                                scope: true,
                            },
                            orderBy: [{ scope: "asc" }],
                        },
                    },
                },
                role: {
                    select: {
                        id: true,
                        isActive: true,
                    },
                },
            },
            orderBy: [{ teamId: "asc" }],
        }),
    ]);

    const activeTeamRoleIds = memberships.flatMap((membership) =>
        membership.role !== null && membership.role.isActive
            ? [membership.role.id]
            : [],
    );

    const teamRoleGrants = activeTeamRoleIds.length === 0
        ? []
        : await context.teamRoleCapabilityGrant.findMany({
              where: {
                  capabilityKey: capabilityKeyFilter,
                  teamRoleId: { in: activeTeamRoleIds },
                  teamRole: {
                      is: {
                          isActive: true,
                          team: { is: { isActive: true } },
                          memberships: { some: { userId: request.userId } },
                      },
                  },
              },
              select: {
                  teamRoleId: true,
                  capabilityKey: true,
                  scope: true,
                  teamRole: {
                      select: {
                          teamId: true,
                      },
                  },
              },
              orderBy: [
                  { teamRoleId: "asc" },
                  { scope: "asc" },
              ],
          });

    return {
        userGrants,
        memberships: memberships.map((membership) => ({
            userId: membership.userId,
            teamId: membership.teamId,
            isTeamActive: membership.team.isActive,
            teamRoleId: membership.teamRoleId,
            teamRole: membership.role === null
                ? null
                : {
                    id: membership.role.id,
                    isActive: membership.role.isActive,
                },
            teamGrants: membership.team.grants,
        })),
        teamRoleGrants: teamRoleGrants.map((grant) => ({
            teamId: grant.teamRole.teamId,
            teamRoleId: grant.teamRoleId,
            capabilityKey: grant.capabilityKey,
            scope: grant.scope,
        })),
    };
}

export function createAuthorizationResolutionRepository(
    context: AuthorizationPersistenceContext = prisma,
): AuthorizationResolutionRepository {
    return {
        async load({ userId, capabilityKey }): Promise<AuthorizationResolutionData> {
            return loadAuthorizationResolution(context, {
                userId,
                capabilityKeys: [capabilityKey],
            });
        },
        async loadMany({
            userId,
            capabilityKeys,
        }): Promise<AuthorizationResolutionData> {
            return loadAuthorizationResolution(context, {
                userId,
                capabilityKeys,
            });
        },
    };
}

export const authorizationResolutionRepository: AuthorizationResolutionRepository =
    createAuthorizationResolutionRepository();
