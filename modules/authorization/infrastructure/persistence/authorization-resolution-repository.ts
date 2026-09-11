import { prisma } from "@/lib/db/prisma";

import type {
    AuthorizationPersistenceContext,
    AuthorizationResolutionData,
    AuthorizationResolutionRepository,
} from "../../application/types";

export function createAuthorizationResolutionRepository(
    context: AuthorizationPersistenceContext = prisma,
): AuthorizationResolutionRepository {
    return {
        async load({ userId, capabilityKey }): Promise<AuthorizationResolutionData> {
            const [userGrants, memberships] = await Promise.all([
                context.userCapabilityGrant.findMany({
                    where: { userId, capabilityKey },
                    select: {
                        userId: true,
                        capabilityKey: true,
                        scope: true,
                    },
                    orderBy: [{ scope: "asc" }],
                }),
                context.teamMembership.findMany({
                    where: {
                        userId,
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
                                    where: { capabilityKey },
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
                          capabilityKey,
                          teamRoleId: { in: activeTeamRoleIds },
                          teamRole: {
                              is: {
                                  isActive: true,
                                  team: { is: { isActive: true } },
                                  memberships: { some: { userId } },
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
        },
    };
}

export const authorizationResolutionRepository: AuthorizationResolutionRepository =
    createAuthorizationResolutionRepository();
