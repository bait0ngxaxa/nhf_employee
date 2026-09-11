import type {
    Team,
    TeamCapabilityGrant,
    TeamMembership,
    TeamRole,
    TeamRoleCapabilityGrant,
    UserCapabilityGrant,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { ValidatedCapabilityGrant } from "../../application/grant-validation";
import type {
    AuthorizationPersistenceContext,
    AuthorizationSeedMembership,
    AuthorizationSeedTeam,
    AuthorizationSeedTeamRole,
} from "../../application/types";

export function upsertTeamForSeed(
    input: AuthorizationSeedTeam,
    persistenceContext: AuthorizationPersistenceContext = prisma,
): Promise<Team> {
    const description = input.description ?? null;
    const isActive = input.isActive ?? true;

    return persistenceContext.team.upsert({
        where: { key: input.key },
        update: {
            name: input.name,
            description,
            isActive,
        },
        create: {
            key: input.key,
            name: input.name,
            description,
            isActive,
        },
    });
}

export function upsertTeamRoleForSeed(
    teamId: number,
    input: AuthorizationSeedTeamRole,
    persistenceContext: AuthorizationPersistenceContext = prisma,
): Promise<TeamRole> {
    const isActive = input.isActive ?? true;

    return persistenceContext.teamRole.upsert({
        where: {
            teamId_key: {
                teamId,
                key: input.key,
            },
        },
        update: {
            name: input.name,
            isActive,
        },
        create: {
            teamId,
            key: input.key,
            name: input.name,
            isActive,
        },
    });
}

export function upsertTeamMembershipForSeed(
    teamId: number,
    input: AuthorizationSeedMembership,
    teamRoleId: number | null,
    persistenceContext: AuthorizationPersistenceContext = prisma,
): Promise<TeamMembership> {
    return persistenceContext.teamMembership.upsert({
        where: {
            teamId_userId: {
                teamId,
                userId: input.userId,
            },
        },
        update: { teamRoleId },
        create: {
            teamId,
            userId: input.userId,
            teamRoleId,
        },
    });
}

export function upsertTeamCapabilityGrantForSeed(
    teamId: number,
    grant: ValidatedCapabilityGrant,
    persistenceContext: AuthorizationPersistenceContext = prisma,
): Promise<TeamCapabilityGrant> {
    return persistenceContext.teamCapabilityGrant.upsert({
        where: {
            teamId_capabilityKey_scope: {
                teamId,
                capabilityKey: grant.capabilityKey,
                scope: grant.scope,
            },
        },
        update: {},
        create: {
            teamId,
            capabilityKey: grant.capabilityKey,
            scope: grant.scope,
        },
    });
}

export function upsertTeamRoleCapabilityGrantForSeed(
    teamRoleId: number,
    grant: ValidatedCapabilityGrant,
    persistenceContext: AuthorizationPersistenceContext = prisma,
): Promise<TeamRoleCapabilityGrant> {
    return persistenceContext.teamRoleCapabilityGrant.upsert({
        where: {
            teamRoleId_capabilityKey_scope: {
                teamRoleId,
                capabilityKey: grant.capabilityKey,
                scope: grant.scope,
            },
        },
        update: {},
        create: {
            teamRoleId,
            capabilityKey: grant.capabilityKey,
            scope: grant.scope,
        },
    });
}

export function upsertUserCapabilityGrantForSeed(
    userId: number,
    grant: ValidatedCapabilityGrant,
    persistenceContext: AuthorizationPersistenceContext = prisma,
): Promise<UserCapabilityGrant> {
    return persistenceContext.userCapabilityGrant.upsert({
        where: {
            userId_capabilityKey_scope: {
                userId,
                capabilityKey: grant.capabilityKey,
                scope: grant.scope,
            },
        },
        update: {},
        create: {
            userId,
            capabilityKey: grant.capabilityKey,
            scope: grant.scope,
        },
    });
}
