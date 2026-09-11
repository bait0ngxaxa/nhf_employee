import type { Prisma } from "@prisma/client";

import type { AuthorizationScope, CapabilityKey } from "../contracts";

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

export type AuthorizationGrantSource =
    | {
        readonly type: "SYSTEM_ROLE";
        readonly role: "ADMIN";
    }
    | {
        readonly type: "TEAM";
        readonly teamId: number;
    }
    | {
        readonly type: "TEAM_ROLE";
        readonly teamId: number;
        readonly teamRoleId: number;
    }
    | {
        readonly type: "USER";
        readonly userId: number;
    };

export interface EffectiveAuthorizationGrant {
    /** The registry validated this key before the grant was constructed. */
    readonly capability: CapabilityKey;
    readonly scope: AuthorizationScope;
    readonly source: AuthorizationGrantSource;
    readonly constraint?: Readonly<{
        readonly teamId: number;
    }>;
}

export type AuthorizationDecisionReason =
    | "UNKNOWN_CAPABILITY"
    | "CHANNEL_NOT_SUPPORTED"
    | "NO_APPLICABLE_GRANT";

export interface AuthorizationDecision {
    readonly capability: string;
    readonly allowed: boolean;
    readonly scopes: readonly AuthorizationScope[];
    readonly grants: readonly EffectiveAuthorizationGrant[];
    readonly reason?: AuthorizationDecisionReason;
}

export interface AuthorizationPersistedGrant {
    readonly capabilityKey: string;
    readonly scope: string;
}

export interface AuthorizationPersistedUserGrant
    extends AuthorizationPersistedGrant {
    readonly userId: number;
}

export interface AuthorizationPersistedTeamGrant
    extends AuthorizationPersistedGrant {
    readonly teamId: number;
}

export interface AuthorizationPersistedTeamRoleGrant
    extends AuthorizationPersistedGrant {
    readonly teamId: number;
    readonly teamRoleId: number;
}

export interface AuthorizationMembershipResolution {
    readonly userId: number;
    readonly teamId: number;
    readonly isTeamActive: boolean;
    readonly teamRoleId: number | null;
    readonly teamRole: Readonly<{
        readonly id: number;
        readonly isActive: boolean;
    }> | null;
    readonly teamGrants: readonly AuthorizationPersistedTeamGrant[];
}

export interface AuthorizationResolutionData {
    readonly userGrants: readonly AuthorizationPersistedUserGrant[];
    readonly memberships: readonly AuthorizationMembershipResolution[];
    readonly teamRoleGrants: readonly AuthorizationPersistedTeamRoleGrant[];
}

export interface AuthorizationResolutionRequest {
    readonly userId: number;
    readonly capabilityKey: string;
}

export interface AuthorizationResolutionManyRequest {
    readonly userId: number;
    readonly capabilityKeys: readonly string[];
}

export interface AuthorizationResolutionRepository {
    load(
        request: AuthorizationResolutionRequest,
    ): Promise<AuthorizationResolutionData>;
    loadMany(
        request: AuthorizationResolutionManyRequest,
    ): Promise<AuthorizationResolutionData>;
}
