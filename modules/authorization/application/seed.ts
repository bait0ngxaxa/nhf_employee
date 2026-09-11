import { prisma } from "@/lib/db/prisma";
import {
    validateCapabilityGrant,
    type ValidatedCapabilityGrant,
} from "./grant-validation";
import {
    upsertTeamCapabilityGrantForSeed,
    upsertTeamForSeed,
    upsertTeamMembershipForSeed,
    upsertTeamRoleCapabilityGrantForSeed,
    upsertTeamRoleForSeed,
    upsertUserCapabilityGrantForSeed,
} from "../infrastructure/persistence/authorization-repository";
import type {
    AuthorizationPersistenceContext,
    AuthorizationSeedConfiguration,
} from "./types";

/**
 * Phase 2 intentionally owns no approved production Team policy yet.
 * Keep this definition empty until an explicit mapping is approved.
 */
export const AUTHORIZATION_SEED_CONFIGURATION = Object.freeze({
    teams: Object.freeze([] as const),
    roles: Object.freeze([] as const),
    memberships: Object.freeze([] as const),
    teamGrants: Object.freeze([] as const),
    teamRoleGrants: Object.freeze([] as const),
    userGrants: Object.freeze([] as const),
}) satisfies AuthorizationSeedConfiguration;

function assertNonEmpty(value: string, label: string): void {
    if (value.trim().length === 0 || value !== value.trim()) {
        throw new Error(`Invalid authorization seed ${label}`);
    }
}

function identityKey(...parts: (string | number)[]): string {
    return JSON.stringify(parts);
}

function assertUnique(values: readonly string[], label: string): void {
    if (new Set(values).size !== values.length) {
        throw new Error(`Duplicate authorization seed ${label}`);
    }
}

interface ValidatedSeedGrants {
    teamGrants: readonly ValidatedCapabilityGrant[];
    teamRoleGrants: readonly ValidatedCapabilityGrant[];
    userGrants: readonly ValidatedCapabilityGrant[];
}

function validateSeedConfiguration(
    configuration: AuthorizationSeedConfiguration,
): ValidatedSeedGrants {
    configuration.teams.forEach((team) => {
        assertNonEmpty(team.key, "Team key");
        assertNonEmpty(team.name, "Team name");
    });
    assertUnique(
        configuration.teams.map((team) => team.key),
        "Team key",
    );

    configuration.roles.forEach((role) => {
        assertNonEmpty(role.teamKey, "role Team key");
        assertNonEmpty(role.key, "role key");
        assertNonEmpty(role.name, "role name");
    });
    assertUnique(
        configuration.roles.map((role) => identityKey(role.teamKey, role.key)),
        "TeamRole identity",
    );

    const teamKeys = new Set(configuration.teams.map((team) => team.key));
    configuration.roles.forEach((role) => {
        if (!teamKeys.has(role.teamKey)) {
            throw new Error(`Unknown authorization seed Team: ${role.teamKey}`);
        }
    });

    configuration.memberships.forEach((membership) => {
        assertNonEmpty(membership.teamKey, "membership Team key");
        if (!Number.isSafeInteger(membership.userId) || membership.userId <= 0) {
            throw new Error("Invalid authorization seed membership user ID");
        }
        if (membership.teamRoleKey !== null && membership.teamRoleKey !== undefined) {
            assertNonEmpty(membership.teamRoleKey, "membership role key");
            if (!configuration.roles.some((role) =>
                role.teamKey === membership.teamKey
                && role.key === membership.teamRoleKey
            )) {
                throw new Error(
                    `Unknown authorization seed TeamRole: ${membership.teamKey}/${membership.teamRoleKey}`,
                );
            }
        }
        if (!teamKeys.has(membership.teamKey)) {
            throw new Error(`Unknown authorization seed Team: ${membership.teamKey}`);
        }
    });
    assertUnique(
        configuration.memberships.map((membership) =>
            identityKey(membership.teamKey, membership.userId),
        ),
        "TeamMembership identity",
    );

    const teamGrants = configuration.teamGrants.map((grant) => {
        assertNonEmpty(grant.teamKey, "Team grant Team key");
        if (!teamKeys.has(grant.teamKey)) {
            throw new Error(`Unknown authorization seed Team: ${grant.teamKey}`);
        }
        return validateCapabilityGrant(grant);
    });
    assertUnique(
        configuration.teamGrants.map((grant) =>
            identityKey(grant.teamKey, grant.capabilityKey, grant.scope),
        ),
        "TeamCapabilityGrant identity",
    );

    const teamRoleGrants = configuration.teamRoleGrants.map((grant) => {
        assertNonEmpty(grant.teamKey, "TeamRole grant Team key");
        assertNonEmpty(grant.teamRoleKey, "TeamRole grant role key");
        if (!configuration.roles.some((role) =>
            role.teamKey === grant.teamKey && role.key === grant.teamRoleKey
        )) {
            throw new Error(
                `Unknown authorization seed TeamRole: ${grant.teamKey}/${grant.teamRoleKey}`,
            );
        }
        return validateCapabilityGrant(grant);
    });
    assertUnique(
        configuration.teamRoleGrants.map((grant) =>
            identityKey(
                grant.teamKey,
                grant.teamRoleKey,
                grant.capabilityKey,
                grant.scope,
            ),
        ),
        "TeamRoleCapabilityGrant identity",
    );

    const userGrants = configuration.userGrants.map((grant) => {
        if (!Number.isSafeInteger(grant.userId) || grant.userId <= 0) {
            throw new Error("Invalid authorization seed direct-grant user ID");
        }
        return validateCapabilityGrant(grant);
    });
    assertUnique(
        configuration.userGrants.map((grant) =>
            identityKey(grant.userId, grant.capabilityKey, grant.scope),
        ),
        "UserCapabilityGrant identity",
    );

    return { teamGrants, teamRoleGrants, userGrants };
}

function findRoleId(
    roles: Map<string, number>,
    teamKey: string,
    roleKey: string,
): number {
    const roleId = roles.get(identityKey(teamKey, roleKey));
    if (roleId === undefined) {
        throw new Error(`Unknown authorization seed TeamRole: ${teamKey}/${roleKey}`);
    }
    return roleId;
}

export async function applyAuthorizationSeed(
    configuration: AuthorizationSeedConfiguration,
    persistenceContext: AuthorizationPersistenceContext,
): Promise<void> {
    const validatedGrants = validateSeedConfiguration(configuration);
    const teamIds = new Map<string, number>();
    const roleIds = new Map<string, number>();

    for (const team of configuration.teams) {
        const record = await upsertTeamForSeed(team, persistenceContext);
        teamIds.set(team.key, record.id);
    }

    for (const role of configuration.roles) {
        const teamId = teamIds.get(role.teamKey);
        if (teamId === undefined) {
            throw new Error(`Unknown authorization seed Team: ${role.teamKey}`);
        }
        const record = await upsertTeamRoleForSeed(
            teamId,
            role,
            persistenceContext,
        );
        roleIds.set(identityKey(role.teamKey, role.key), record.id);
    }

    for (const membership of configuration.memberships) {
        const teamId = teamIds.get(membership.teamKey);
        if (teamId === undefined) {
            throw new Error(`Unknown authorization seed Team: ${membership.teamKey}`);
        }
        const teamRoleId = membership.teamRoleKey === null
            || membership.teamRoleKey === undefined
            ? null
            : findRoleId(roleIds, membership.teamKey, membership.teamRoleKey);
        await upsertTeamMembershipForSeed(
            teamId,
            membership,
            teamRoleId,
            persistenceContext,
        );
    }

    for (const [index, grant] of configuration.teamGrants.entries()) {
        const teamId = teamIds.get(grant.teamKey);
        if (teamId === undefined) {
            throw new Error(`Unknown authorization seed Team: ${grant.teamKey}`);
        }
        await upsertTeamCapabilityGrantForSeed(
            teamId,
            validatedGrants.teamGrants[index],
            persistenceContext,
        );
    }

    for (const [index, grant] of configuration.teamRoleGrants.entries()) {
        const roleId = findRoleId(roleIds, grant.teamKey, grant.teamRoleKey);
        await upsertTeamRoleCapabilityGrantForSeed(
            roleId,
            validatedGrants.teamRoleGrants[index],
            persistenceContext,
        );
    }

    for (const [index, grant] of configuration.userGrants.entries()) {
        await upsertUserCapabilityGrantForSeed(
            grant.userId,
            validatedGrants.userGrants[index],
            persistenceContext,
        );
    }
}

export async function seedAuthorizationConfiguration(): Promise<void> {
    if (
        AUTHORIZATION_SEED_CONFIGURATION.teams.length === 0
        && AUTHORIZATION_SEED_CONFIGURATION.roles.length === 0
        && AUTHORIZATION_SEED_CONFIGURATION.memberships.length === 0
        && AUTHORIZATION_SEED_CONFIGURATION.teamGrants.length === 0
        && AUTHORIZATION_SEED_CONFIGURATION.teamRoleGrants.length === 0
        && AUTHORIZATION_SEED_CONFIGURATION.userGrants.length === 0
    ) {
        return;
    }

    validateSeedConfiguration(AUTHORIZATION_SEED_CONFIGURATION);
    await prisma.$transaction((tx) =>
        applyAuthorizationSeed(AUTHORIZATION_SEED_CONFIGURATION, tx),
    );
}
