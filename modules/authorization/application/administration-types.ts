import type { EmployeeStatus, Prisma } from "@prisma/client";

import type {
    AuthorizationChannel,
    AuthorizationDomain,
    AuthorizationScope,
    AuthorizationActor,
} from "../contracts";
import type { RegisteredCapabilityKey } from "../registry";
import type {
    AuthorizationDecision,
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
    | "CENTRAL_WITH_DEFAULT_POLICY"
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
    /** Describes how central authority combines with the domain runtime policy. */
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
    readonly teams?: readonly AuthorizationAdministrationUserTeamSummary[];
}

/**
 * Safe identity projection used by the bounded Authorization Administration
 * user directory. It intentionally contains no credential or session fields.
 */
export type AuthorizationAdministrationUserSummary =
    AuthorizationAdministrationAccountIdentity;

export interface AuthorizationAdministrationUserTeamSummary {
    readonly id: number;
    readonly name: string;
    readonly isActive: boolean;
}

export const AUTHORIZATION_ADMINISTRATION_USER_SEARCH_MAX_LENGTH = 100;
export const AUTHORIZATION_ADMINISTRATION_USER_SEARCH_LIMIT = 25;

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
    readonly teamMemberships?: readonly {
        readonly team: AuthorizationAdministrationUserTeamSummary;
    }[];
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

export type AuthorizationAdministrationEffectiveAccessState =
    | "AVAILABLE"
    | "UNAVAILABLE"
    | "UNSUPPORTED"
    | "DEFERRED";

/**
 * A trusted, code-owned runtime intent used by a domain inspector. This is
 * deliberately not a browser-supplied scope or authorization decision.
 */
export interface AuthorizationAdministrationInspectionContext {
    readonly key: string;
    readonly label: string;
    readonly channel: AuthorizationChannel;
}

export interface AuthorizationAdministrationEffectiveAccessLimitation {
    readonly code: string;
    readonly label: string;
}

/**
 * Domain-owned inspection output. The configured decision remains the raw
 * resolver result; `effectiveScopes` is produced by the domain's runtime
 * composition and channel policy.
 */
export interface AuthorizationAdministrationEffectiveAccessInspection {
    readonly capability: RegisteredCapabilityKey;
    readonly context: AuthorizationAdministrationInspectionContext;
    readonly defaultScopes: readonly AuthorizationScope[];
    readonly configuredDecision: AuthorizationDecision | null;
    /** Additive composition result before any domain channel clamp. */
    readonly composedScopes: readonly AuthorizationScope[];
    readonly effectiveScopes: readonly AuthorizationScope[];
    readonly state: AuthorizationAdministrationEffectiveAccessState;
    readonly limitations: readonly AuthorizationAdministrationEffectiveAccessLimitation[];
}

export interface AuthorizationAdministrationEffectiveAccessProviderInput {
    readonly actor: AuthorizationActor;
    readonly dashboardDecisions: ReadonlyMap<string, AuthorizationDecision>;
    readonly resolver: Pick<AuthorizationResolver, "resolveMany">;
}

/**
 * Structural port consumed by the generic Administration read model. Domain
 * implementations are bound by the outer application composition layer so
 * the authorization core does not import every business domain.
 */
export interface AuthorizationAdministrationEffectiveAccessProvider {
    inspect(
        input: AuthorizationAdministrationEffectiveAccessProviderInput,
    ): Promise<readonly AuthorizationAdministrationEffectiveAccessInspection[]>;
}

export interface AuthorizationAdministrationDefaultAuthority {
    readonly scopes: readonly AuthorizationScope[];
}

export interface AuthorizationAdministrationAdditionalAuthority {
    readonly scopes: readonly AuthorizationScope[];
    readonly grants: readonly AuthorizationAdministrationResolverEffectiveGrant[];
    readonly reason?: AuthorizationDecisionReason;
}

export interface AuthorizationAdministrationEffectiveAuthority {
    readonly state: AuthorizationAdministrationEffectiveAccessState;
    readonly scopes: readonly AuthorizationScope[];
    /** True when configured authority is present but adds no normalized scope. */
    readonly redundant: boolean;
}

export interface AuthorizationAdministrationEffectiveAccessRow {
    readonly capability: CapabilityAdministrationProjection;
    readonly context: AuthorizationAdministrationInspectionContext;
    readonly defaultAuthority: AuthorizationAdministrationDefaultAuthority;
    readonly additionalAuthority: AuthorizationAdministrationAdditionalAuthority;
    readonly effectiveAuthority: AuthorizationAdministrationEffectiveAuthority;
    readonly limitations: readonly AuthorizationAdministrationEffectiveAccessLimitation[];
}

export type AuthorizationAdministrationEffectiveAccessStatus =
    AuthorizationAdministrationResolverEffectivePermissionStatus;

export interface AuthorizationAdministrationEffectiveAccessSummary {
    /** Counts are context rows, except deferredCapabilityCount. */
    readonly inspectedContextCount: number;
    readonly availableContextCount: number;
    readonly defaultBackedContextCount: number;
    readonly additionalAuthorityContextCount: number;
    readonly unsupportedContextCount: number;
    readonly deferredCapabilityCount: number;
    readonly configurationIssueCount: number;
}

export interface AuthorizationAdministrationUserDetail {
    readonly user: AuthorizationAdministrationAccountIdentity;
    readonly systemRole: UserRole;
    readonly teamMemberships: readonly AuthorizationAdministrationUserTeamMembership[];
    readonly directGrants: readonly AuthorizationAdministrationGrantProjection[];
    /** Central resolver results; not a final domain/runtime access decision. */
    readonly resolverEffectivePermissionStatus: AuthorizationAdministrationResolverEffectivePermissionStatus;
    /** Central resolver results only; domain-owned defaults may still apply. */
    readonly resolverEffectivePermissions: readonly AuthorizationAdministrationResolverEffectivePermission[];
    /** Domain-composed capability authority; not a final resource/workflow decision. */
    readonly effectiveAccessStatus: AuthorizationAdministrationEffectiveAccessStatus;
    readonly effectiveAccess: readonly AuthorizationAdministrationEffectiveAccessRow[];
    readonly effectiveAccessSummary: AuthorizationAdministrationEffectiveAccessSummary;
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
    searchUsers(
        query: string,
    ): Promise<readonly AuthorizationAdministrationRawUserIdentity[]>;
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

export interface AuthorizationAdministrationUserQueryDependencies
    extends AuthorizationAdministrationQueryDependencies {
    /** Required for User detail; bound only by the outer application layer. */
    readonly effectiveAccessProvider: AuthorizationAdministrationEffectiveAccessProvider;
}
