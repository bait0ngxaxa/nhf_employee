import { prisma } from "@/lib/db/prisma";

import type {
    AuthorizationPersistenceContext,
    AuthorizationRecipientLookupRequest,
    AuthorizationRecipientRepository,
} from "../../application/types";

/**
 * Enumerate only explicit configured capability authority.
 *
 * This query deliberately does not compose a domain default policy. The
 * recipient audiences that use it require an explicit ALL grant, so using it
 * for a general "who can perform this capability" question would be wrong.
 */
async function findActiveUsersWithConfiguredCapabilityScope(
    context: AuthorizationPersistenceContext,
    request: AuthorizationRecipientLookupRequest,
): Promise<readonly number[]> {
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

    return [...new Set(users.map((user) => user.id))].sort((left, right) => left - right);
}

export function createAuthorizationRecipientRepository(
    context: AuthorizationPersistenceContext = prisma,
): AuthorizationRecipientRepository {
    return {
        findActiveUsersWithConfiguredCapabilityScope(request) {
            return findActiveUsersWithConfiguredCapabilityScope(context, request);
        },
    };
}

export const authorizationRecipientRepository: AuthorizationRecipientRepository =
    createAuthorizationRecipientRepository();
