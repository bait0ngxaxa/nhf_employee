import { prisma } from "@/lib/db/prisma";

import type {
    AuthorizationPersistenceContext,
    AuthorizationRecipientCandidate,
    AuthorizationRecipientLookupRequest,
    AuthorizationRecipientRepository,
} from "../../application/types";
import { loadAuthorizationResolutionsForUsers } from "./authorization-resolution-repository";

/**
 * Load only explicit configured capability authority.
 *
 * This query deliberately does not compose a domain default policy. The
 * recipient audiences that use it require an explicit ALL grant, so the
 * application layer must still evaluate the returned resolution data before
 * selecting a recipient.
 */
async function loadActiveUsersWithConfiguredCapability(
    context: AuthorizationPersistenceContext,
    request: Pick<AuthorizationRecipientLookupRequest, "capability" | "scope">,
): Promise<readonly AuthorizationRecipientCandidate[]> {
    const grant = {
        capabilityKey: request.capability,
        scope: request.scope,
    };
    const users = await context.user.findMany({
        where: {
            isActive: true,
            deletedAt: null,
            OR: [
                {
                    userCapabilityGrants: {
                        some: grant,
                    },
                },
                {
                    teamMemberships: {
                        some: {
                            team: {
                                is: {
                                    isActive: true,
                                    grants: {
                                        some: grant,
                                    },
                                },
                            },
                        },
                    },
                },
                {
                    teamMemberships: {
                        some: {
                            team: {
                                is: {
                                    isActive: true,
                                },
                            },
                            // The composite TeamRole relation only resolves
                            // roles owned by this membership's Team. A
                            // structurally invalid relation therefore fails
                            // closed instead of leaking another Team's grant.
                            role: {
                                is: {
                                    isActive: true,
                                    team: {
                                        is: {
                                            isActive: true,
                                        },
                                    },
                                    grants: {
                                        some: grant,
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        },
        select: { id: true },
        orderBy: { id: "asc" },
    });

    const userIds = [...new Set(users.map((user) => user.id))].sort(
        (left, right) => left - right,
    );
    const resolutions = await loadAuthorizationResolutionsForUsers(context, {
        userIds,
        capability: request.capability,
    });

    return userIds.flatMap((userId) => {
        const resolutionData = resolutions.get(userId);
        if (!resolutionData || !hasConfiguredGrant(resolutionData)) return [];
        return [{ userId, resolutionData }];
    });
}

function hasConfiguredGrant(
    resolutionData: AuthorizationRecipientCandidate["resolutionData"],
): boolean {
    if (resolutionData.userGrants.length > 0) return true;

    const activeRoleIds = new Set(
        resolutionData.memberships.flatMap((membership) =>
            membership.teamRole !== null
            && membership.teamRoleId !== null
            && membership.teamRole.isActive
                ? [membership.teamRole.id]
                : [],
        ),
    );

    return resolutionData.memberships.some(
        (membership) => membership.teamGrants.length > 0,
    ) || resolutionData.teamRoleGrants.some(
        (grant) => activeRoleIds.has(grant.teamRoleId),
    );
}

export function createAuthorizationRecipientRepository(
    context: AuthorizationPersistenceContext = prisma,
): AuthorizationRecipientRepository {
    return {
        loadActiveUsersWithConfiguredCapability(request) {
            return loadActiveUsersWithConfiguredCapability(context, request);
        },
    };
}

export const authorizationRecipientRepository: AuthorizationRecipientRepository =
    createAuthorizationRecipientRepository();
