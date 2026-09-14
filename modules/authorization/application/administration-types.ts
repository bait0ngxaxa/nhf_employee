import type { EmployeeStatus, Prisma } from "@prisma/client";

import type {
    AuthorizationChannel,
    AuthorizationDomain,
    AuthorizationScope,
} from "../contracts";
import type { RegisteredCapabilityKey } from "../registry";
import type {
    AuthorizationDecisionReason,
    AuthorizationGrantSource,
} from "./types";
import type { AuthorizationResolver } from "./resolver";
import type { AuthorizationConfigurationErrorCode } from "./errors";
import type { UserRole } from "@/lib/ssot/permissions";

export type AuthorizationAdministrationPersistenceContext = Pick<
    Prisma.TransactionClient,
    "team" | "user"
>;

export interface AuthorizationAdministrationPrincipal {
    readonly userId: number;
    readonly systemRole: UserRole;
}

export type RuntimeAuthorizationMode =
    | "CENTRAL_ONLY"
    | "CENTRAL_WITH_COMPATIBILITY"
    | "DEFERRED";

export type CapabilityAdministrationStatus =
    | "GRANTABLE"
    | "POLICY_ACTIVATION_REQUIRED"
    | "DEFERRED";

export interface CapabilityAdministrationProjection {
    readonly key: RegisteredCapabilityKey;
    readonly registered: true;
    readonly domain: AuthorizationDomain;
    readonly description: string;
    readonly supportedScopes: readonly AuthorizationScope[];
    readonly supportedChannels: readonly AuthorizationChannel[];
    /**
     * Describes whether a domain adapter may still translate a central
     * resolver denial through a documented compatibility floor.
     */
    readonly runtimeAuthorizationMode: RuntimeAuthorizationMode;
    readonly administrativeStatus: CapabilityAdministrationStatus;
    /** True only when an ordinary additive Phase 10B grant is safe to expose. */
    readonly administrativelyGrantable: boolean;
    readonly nonGrantableReason?: string;
}

export type AuthorizationAdministrationGrantValidationCode =
    AuthorizationConfigurationErrorCode;

export type AuthorizationAdministrationGrantValidation =
    | { readonly status: "VALID" }
    | {
        readonly status: "INVALID";
        readonly code: AuthorizationAdministrationGrantValidationCode;
        readonly reason: string;
    };

export interface AuthorizationAdministrationGrantProjection {
    /** Raw persisted value; it is never trimmed, coerced, or normalized. */
    readonly capabilityKey: string;
    /** Raw persisted value; it is never trimmed, coerced, or normalized. */
    readonly scope: string;
    readonly capability: CapabilityAdministrationProjection | null;
    readonly validation: AuthorizationAdministrationGrantValidation;
}

export interface AuthorizationAdministrationTeamReference {
    readonly id: number;
    readonly key: string;
    readonly name: string;
    readonly isActive: boolean;
}

export interface AuthorizationAdministrationTeamRoleReference {
    readonly id: number;
    readonly teamId: number;
    readonly key: string;
    readonly name: string;
    readonly isActive: boolean;
}

export interface AuthorizationAdministrationTeamSummary {
    readonly id: number;
    readonly key: string;
    readonly name: string;
    readonly description: string | null;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly roleCount: number;
    readonly membershipCount: number;
    readonly teamGrantCount: number;
}

export interface AuthorizationAdministrationTeamRole {
    readonly id: number;
    readonly teamId: number;
    readonly key: string;
    readonly name: string;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly membershipCount: number;
    readonly grantCount: number;
}

export interface AuthorizationAdministrationAccountIdentity {
    readonly id: number;
    readonly name: string;
    readonly email: string;
    readonly role: UserRole;
    readonly isActive: boolean;
    readonly deletedAt: Date | null;
    readonly employee: {
        readonly id: number;
        readonly displayName: string;
        readonly status: EmployeeStatus;
        readonly deletedAt: Date | null;
    } | null;
}

export interface AuthorizationAdministrationRawUserIdentity {
    readonly id: number;
    readonly name: string;
    readonly email: string;
    readonly role: string;
    readonly isActive: boolean;
    readonly deletedAt: Date | null;
    readonly employee: {
        readonly id: number;
        readonly firstName: string;
        readonly lastName: string;
        readonly nickname: string | null;
        readonly status: EmployeeStatus;
        readonly deletedAt: Date | null;
    } | null;
}

export interface AuthorizationAdministrationTeamMembership {
    readonly teamId: number;
    readonly userId: number;
    readonly teamRoleId: number | null;
    readonly teamRole: AuthorizationAdministrationTeamRoleReference | null;
    readonly user: AuthorizationAdministrationAccountIdentity;
}

export interface AuthorizationAdministrationTeamGrant
    extends AuthorizationAdministrationGrantProjection {
    readonly teamId: number;
}

export interface AuthorizationAdministrationTeamRoleGrant
    extends AuthorizationAdministrationGrantProjection {
    readonly teamId: number;
    readonly teamRoleId: number;
    readonly teamRole: AuthorizationAdministrationTeamRoleReference;
}

export type AuthorizationAdministrationConfigurationIssueSource =
    | "TEAM_GRANT"
    | "TEAM_ROLE_GRANT"
    | "USER_GRANT"
    | "MEMBERSHIP"
    | "EFFECTIVE_RESOLUTION";

export interface AuthorizationAdministrationConfigurationIssue {
    readonly source: AuthorizationAdministrationConfigurationIssueSource;
    readonly code: AuthorizationAdministrationGrantValidationCode;
    readonly capabilityKey?: string;
    readonly scope?: string;
    readonly teamId?: number;
    readonly teamRoleId?: number;
    readonly userId?: number;
}

export interface AuthorizationAdministrationTeamDetail
    extends AuthorizationAdministrationTeamSummary {
    readonly roles: readonly AuthorizationAdministrationTeamRole[];
    readonly memberships: readonly AuthorizationAdministrationTeamMembership[];
    readonly teamGrants: readonly AuthorizationAdministrationTeamGrant[];
    readonly teamRoleGrants: readonly AuthorizationAdministrationTeamRoleGrant[];
    readonly configurationIssues: readonly AuthorizationAdministrationConfigurationIssue[];
}

export interface AuthorizationAdministrationUserTeamMembership {
    readonly teamId: number;
    readonly userId: number;
    readonly teamRoleId: number | null;
    readonly team: AuthorizationAdministrationTeamReference;
    readonly teamRole: AuthorizationAdministrationTeamRoleReference | null;
}

export type AuthorizationAdministrationSourceExplanation =
    | {
        readonly type: "SYSTEM_ROLE";
        readonly role: "ADMIN";
    }
    | {
        readonly type: "TEAM";
        readonly teamId: number;
        readonly team: AuthorizationAdministrationTeamReference | null;
    }
    | {
        readonly type: "TEAM_ROLE";
        readonly teamId: number;
        readonly team: AuthorizationAdministrationTeamReference | null;
        readonly teamRoleId: number;
        readonly teamRole: AuthorizationAdministrationTeamRoleReference | null;
    }
    | {
        readonly type: "USER";
        readonly userId: number;
    };

export interface AuthorizationAdministrationResolverEffectiveGrant {
    readonly capability: RegisteredCapabilityKey;
    readonly scope: AuthorizationScope;
    readonly source: AuthorizationGrantSource;
    readonly constraint?: Readonly<{ readonly teamId: number }>;
    readonly origin: AuthorizationAdministrationSourceExplanation;
}

export interface AuthorizationAdministrationResolverEffectivePermission {
    readonly capability: CapabilityAdministrationProjection;
    readonly allowed: boolean;
    readonly scopes: readonly AuthorizationScope[];
    readonly grants: readonly AuthorizationAdministrationResolverEffectiveGrant[];
    readonly reason?: AuthorizationDecisionReason;
}

export interface AuthorizationAdministrationResolutionError {
    readonly code: AuthorizationConfigurationErrorCode;
    readonly capabilityKey?: string;
    readonly scope?: string;
    readonly teamId?: number;
    readonly teamRoleId?: number;
}

export type AuthorizationAdministrationResolverEffectivePermissionStatus =
    | { readonly status: "RESOLVED" }
    | {
        readonly status: "INVALID_CONFIGURATION";
        readonly error: AuthorizationAdministrationResolutionError;
    };

export interface AuthorizationAdministrationUserDetail {
    readonly user: AuthorizationAdministrationAccountIdentity;
    readonly systemRole: UserRole;
    readonly teamMemberships: readonly AuthorizationAdministrationUserTeamMembership[];
    readonly directGrants: readonly AuthorizationAdministrationGrantProjection[];
    /** Central resolver results; not a final domain/runtime access decision. */
    readonly resolverEffectivePermissionStatus: AuthorizationAdministrationResolverEffectivePermissionStatus;
    /** Central resolver results; domain compatibility adapters may still apply. */
    readonly resolverEffectivePermissions: readonly AuthorizationAdministrationResolverEffectivePermission[];
    readonly configurationIssues: readonly AuthorizationAdministrationConfigurationIssue[];
}

export interface AuthorizationAdministrationOverview {
    readonly capabilities: readonly CapabilityAdministrationProjection[];
    readonly teams: readonly AuthorizationAdministrationTeamSummary[];
    readonly summary: {
        readonly registeredCapabilityCount: number;
        readonly administrativelyGrantableCapabilityCount: number;
        readonly policyActivationRequiredCapabilityCount: number;
        readonly deferredCapabilityCount: number;
        readonly teamCount: number;
        readonly activeTeamCount: number;
    };
}

export type AuthorizationAdministrationTeamRecord =
    AuthorizationAdministrationTeamSummary;

export interface AuthorizationAdministrationRawGrant {
    readonly capabilityKey: string;
    readonly scope: string;
}

export interface AuthorizationAdministrationTeamRoleRecord
    extends AuthorizationAdministrationTeamRole {
    readonly grants: readonly AuthorizationAdministrationRawGrant[];
}

export interface AuthorizationAdministrationTeamMembershipRecord {
    readonly teamId: number;
    readonly userId: number;
    readonly teamRoleId: number | null;
    readonly role: AuthorizationAdministrationTeamRoleReference | null;
    readonly user: AuthorizationAdministrationRawUserIdentity;
}

export interface AuthorizationAdministrationTeamDetailRecord
    extends AuthorizationAdministrationTeamSummary {
    readonly roles: readonly AuthorizationAdministrationTeamRoleRecord[];
    readonly memberships: readonly AuthorizationAdministrationTeamMembershipRecord[];
    readonly grants: readonly AuthorizationAdministrationRawGrant[];
}

export interface AuthorizationAdministrationUserRecord {
    readonly id: number;
    readonly name: string;
    readonly email: string;
    readonly role: string;
    readonly isActive: boolean;
    readonly deletedAt: Date | null;
    readonly employee: AuthorizationAdministrationRawUserIdentity["employee"];
    readonly teamMemberships: readonly {
        readonly teamId: number;
        readonly userId: number;
        readonly teamRoleId: number | null;
        readonly team: AuthorizationAdministrationTeamReference;
        readonly role: AuthorizationAdministrationTeamRoleReference | null;
    }[];
    readonly userCapabilityGrants: readonly AuthorizationAdministrationRawGrant[];
}

export interface AuthorizationAdministrationRepository {
    listTeams(): Promise<readonly AuthorizationAdministrationTeamRecord[]>;
    findTeamById(
        teamId: number,
    ): Promise<AuthorizationAdministrationTeamDetailRecord | null>;
    findUserById(
        userId: number,
    ): Promise<AuthorizationAdministrationUserRecord | null>;
}

export interface AuthorizationAdministrationQueryDependencies {
    readonly repository?: AuthorizationAdministrationRepository;
    readonly resolver?: Pick<AuthorizationResolver, "resolveMany">;
}
