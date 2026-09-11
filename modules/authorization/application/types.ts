import type { Prisma } from "@prisma/client";

export type AuthorizationPersistenceContext = Pick<
    Prisma.TransactionClient,
    | "team"
    | "teamRole"
    | "teamMembership"
    | "teamCapabilityGrant"
    | "teamRoleCapabilityGrant"
    | "userCapabilityGrant"
>;

export interface AuthorizationSeedTeam {
    key: string;
    name: string;
    description?: string | null;
    isActive?: boolean;
}

export interface AuthorizationSeedTeamRole {
    teamKey: string;
    key: string;
    name: string;
    isActive?: boolean;
}

export interface AuthorizationSeedMembership {
    teamKey: string;
    userId: number;
    teamRoleKey?: string | null;
}

export interface AuthorizationSeedTeamGrant {
    teamKey: string;
    capabilityKey: string;
    scope: string;
}

export interface AuthorizationSeedTeamRoleGrant {
    teamKey: string;
    teamRoleKey: string;
    capabilityKey: string;
    scope: string;
}

export interface AuthorizationSeedUserGrant {
    userId: number;
    capabilityKey: string;
    scope: string;
}

export interface AuthorizationSeedConfiguration {
    teams: readonly AuthorizationSeedTeam[];
    roles: readonly AuthorizationSeedTeamRole[];
    memberships: readonly AuthorizationSeedMembership[];
    teamGrants: readonly AuthorizationSeedTeamGrant[];
    teamRoleGrants: readonly AuthorizationSeedTeamRoleGrant[];
    userGrants: readonly AuthorizationSeedUserGrant[];
}
