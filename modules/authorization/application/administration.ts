import { isAdminRole, type UserRole } from "@/lib/ssot/permissions";

import { CAPABILITY_REGISTRY } from "../registry";
import { validateCapabilityGrant, CapabilityGrantValidationError } from "./grant-validation";
import {
    AuthorizationAdministrationAccessError,
    AuthorizationAdministrationInputError,
    AuthorizationConfigurationError,
} from "./errors";
import {
    buildCapabilityAdministrationCatalog,
} from "./administration-catalog";
import {
    authorizationAdministrationRepository,
} from "../infrastructure/persistence/authorization-administration-repository";
import {
    authorization,
    type AuthorizationResolver,
} from "./resolver";
import {
    AUTHORIZATION_ADMINISTRATION_USER_SEARCH_MAX_LENGTH,
    type AuthorizationAdministrationAccountIdentity,
    type AuthorizationAdministrationConfigurationIssue,
    type AuthorizationAdministrationEffectiveAccessInspection,
    type AuthorizationAdministrationEffectiveAccessRow,
    type AuthorizationAdministrationEffectiveAccessStatus,
    type AuthorizationAdministrationEffectiveAccessSummary,
    type AuthorizationAdministrationResolverEffectiveGrant,
    type AuthorizationAdministrationResolverEffectivePermission,
    type AuthorizationAdministrationGrantProjection,
    type AuthorizationAdministrationGrantValidationCode,
    type AuthorizationAdministrationPrincipal,
    type AuthorizationAdministrationQueryDependencies,
    type AuthorizationAdministrationRawGrant,
    type AuthorizationAdministrationRawUserIdentity,
    type AuthorizationAdministrationResolutionError,
    type AuthorizationAdministrationResolverEffectivePermissionStatus,
    type AuthorizationAdministrationRepository,
    type AuthorizationAdministrationSourceExplanation,
    type AuthorizationAdministrationTeamDetail,
    type AuthorizationAdministrationTeamDetailRecord,
    type AuthorizationAdministrationTeamGrant,
    type AuthorizationAdministrationTeamMembership,
    type AuthorizationAdministrationTeamMembershipRecord,
    type AuthorizationAdministrationTeamReference,
    type AuthorizationAdministrationTeamRole,
    type AuthorizationAdministrationTeamRoleGrant,
    type AuthorizationAdministrationTeamRoleReference,
    type AuthorizationAdministrationTeamSummary,
    type AuthorizationAdministrationOverview,
    type AuthorizationAdministrationUserSummary,
    type AuthorizationAdministrationUserDetail,
    type AuthorizationAdministrationUserQueryDependencies,
    type AuthorizationAdministrationUserRecord,
    type AuthorizationAdministrationUserTeamMembership,
    type CapabilityAdministrationProjection,
} from "./administration-types";
import type {
    AuthorizationActor,
} from "../contracts";
import type {
    AuthorizationDecision,
    AuthorizationGrantSource,
    EffectiveAuthorizationGrant,
} from "./types";

function freezeArray<T>(values: readonly T[]): readonly T[] {
    return Object.freeze([...values]);
}

function parsePersistedUserRole(role: string): UserRole {
    if (role === "ADMIN" || role === "USER") return role;
    throw new Error("Invalid persisted User system role");
}

/**
 * Verify the system administration authority after a caller has already
 * crossed the trusted authentication/workforce boundary. The input is
 * intentionally structural so a forged role can never be treated as an
 * ADMIN principal merely because a caller asserted a narrower TypeScript
 * type.
 */
export function assertAuthorizationAdministrationAccess(input: {
    readonly userId: unknown;
    readonly systemRole: unknown;
}): AuthorizationAdministrationPrincipal {
    if (
        typeof input.userId !== "number"
        || !Number.isSafeInteger(input.userId)
        || input.userId <= 0
        || typeof input.systemRole !== "string"
        || !isAdminRole(input.systemRole)
    ) {
        throw new AuthorizationAdministrationAccessError();
    }

    return Object.freeze({
        userId: input.userId,
        systemRole: "ADMIN" as const,
    });
}

function assertValidTargetId(id: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AuthorizationAdministrationInputError();
    }
}

function projectTeamReference(
    team: AuthorizationAdministrationTeamReference,
): AuthorizationAdministrationTeamReference {
    return Object.freeze({
        id: team.id,
        key: team.key,
        name: team.name,
        isActive: team.isActive,
    });
}

function projectTeamRoleReference(
    role: AuthorizationAdministrationTeamRoleReference,
): AuthorizationAdministrationTeamRoleReference {
    return Object.freeze({
        id: role.id,
        teamId: role.teamId,
        key: role.key,
        name: role.name,
        isActive: role.isActive,
    });
}

function projectEmployeeDisplayName(
    employee: NonNullable<AuthorizationAdministrationRawUserIdentity["employee"]>,
): string {
    const fullName = `${employee.firstName} ${employee.lastName}`.trim();
    const nickname = employee.nickname?.trim();
    if (!nickname) return fullName;
    return fullName ? `${fullName} (${nickname})` : nickname;
}

function projectAccountIdentity(
    user: AuthorizationAdministrationRawUserIdentity,
): AuthorizationAdministrationAccountIdentity {
    return Object.freeze({
        id: user.id,
        name: user.name,
        email: user.email,
        role: parsePersistedUserRole(user.role),
        isActive: user.isActive,
        deletedAt: user.deletedAt,
        employee: user.employee === null
            ? null
            : Object.freeze({
                id: user.employee.id,
                displayName: projectEmployeeDisplayName(user.employee),
                status: user.employee.status,
                deletedAt: user.employee.deletedAt,
            }),
    });
}

function projectTeamSummary(
    team: AuthorizationAdministrationTeamSummary,
): AuthorizationAdministrationTeamSummary {
    return Object.freeze({
        id: team.id,
        key: team.key,
        name: team.name,
        description: team.description,
        isActive: team.isActive,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        roleCount: team.roleCount,
        membershipCount: team.membershipCount,
        teamGrantCount: team.teamGrantCount,
    });
}

function projectTeamRole(
    role: AuthorizationAdministrationTeamRole,
): AuthorizationAdministrationTeamRole {
    return Object.freeze({
        id: role.id,
        teamId: role.teamId,
        key: role.key,
        name: role.name,
        isActive: role.isActive,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        membershipCount: role.membershipCount,
        grantCount: role.grantCount,
    });
}

function projectGrantValidationError(
    error: CapabilityGrantValidationError,
): {
    readonly code: AuthorizationAdministrationGrantValidationCode;
    readonly reason: string;
} {
    if (error.code === "UNKNOWN_CAPABILITY") {
        return {
            code: "UNKNOWN_PERSISTED_CAPABILITY",
            reason: "Capability key is not present in the code-owned registry.",
        };
    }

    return {
        code: "UNSUPPORTED_PERSISTED_SCOPE",
        reason: "Scope is not supported by the code-owned registry definition.",
    };
}

function projectPersistedGrant(
    grant: AuthorizationAdministrationRawGrant,
    source: "TEAM" | "TEAM_ROLE" | "USER",
    catalogByKey: ReadonlyMap<string, CapabilityAdministrationProjection>,
): AuthorizationAdministrationGrantProjection {
    const capability = catalogByKey.get(grant.capabilityKey) ?? null;
    if (capability === null) {
        return Object.freeze({
            capabilityKey: grant.capabilityKey,
            scope: grant.scope,
            capability: null,
            validation: Object.freeze({
                status: "INVALID" as const,
                code: "UNKNOWN_PERSISTED_CAPABILITY" as const,
                reason: "Capability key is not present in the code-owned registry.",
            }),
        });
    }

    try {
        const validatedGrant = validateCapabilityGrant(grant);
        if (source === "USER" && validatedGrant.scope === "TEAM") {
            return Object.freeze({
                capabilityKey: grant.capabilityKey,
                scope: grant.scope,
                capability,
                validation: Object.freeze({
                    status: "INVALID" as const,
                    code: "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN" as const,
                    reason:
                        "A direct User grant cannot carry TEAM scope without an originating Team.",
                }),
            });
        }

        return Object.freeze({
            capabilityKey: grant.capabilityKey,
            scope: grant.scope,
            capability,
            validation: Object.freeze({ status: "VALID" as const }),
        });
    } catch (error) {
        if (!(error instanceof CapabilityGrantValidationError)) throw error;
        const validation = projectGrantValidationError(error);
        return Object.freeze({
            capabilityKey: grant.capabilityKey,
            scope: grant.scope,
            capability,
            validation: Object.freeze({
                status: "INVALID" as const,
                ...validation,
            }),
        });
    }
}

function issueFromGrant(
    source: "TEAM_GRANT" | "TEAM_ROLE_GRANT" | "USER_GRANT",
    grant: AuthorizationAdministrationGrantProjection,
    identity: {
        readonly teamId?: number;
        readonly teamRoleId?: number;
        readonly userId?: number;
    } = {},
): AuthorizationAdministrationConfigurationIssue | null {
    if (grant.validation.status === "VALID") return null;

    return Object.freeze({
        source,
        code: grant.validation.code,
        capabilityKey: grant.capabilityKey,
        scope: grant.scope,
        ...identity,
    });
}

function issueForMembership(
    membership: AuthorizationAdministrationTeamMembershipRecord,
    teamId: number,
): AuthorizationAdministrationConfigurationIssue | null {
    const role = membership.role;
    const hasTeamMismatch = membership.teamId !== teamId;
    const hasRoleMismatch = role === null
        ? membership.teamRoleId !== null
        : role.teamId !== teamId
            || membership.teamRoleId !== role.id;

    if (!hasTeamMismatch && !hasRoleMismatch) return null;

    return Object.freeze({
        source: "MEMBERSHIP" as const,
        code: "TEAM_ROLE_MEMBERSHIP_MISMATCH" as const,
        teamId,
        teamRoleId: membership.teamRoleId ?? role?.id,
        userId: membership.userId,
    });
}

function projectTeamMembership(
    membership: AuthorizationAdministrationTeamMembershipRecord,
): AuthorizationAdministrationTeamMembership {
    return Object.freeze({
        teamId: membership.teamId,
        userId: membership.userId,
        teamRoleId: membership.teamRoleId,
        teamRole: membership.role === null
            ? null
            : projectTeamRoleReference(membership.role),
        user: projectAccountIdentity(membership.user),
    });
}

function projectUserMembership(
    membership: AuthorizationAdministrationUserRecord["teamMemberships"][number],
): AuthorizationAdministrationUserTeamMembership {
    return Object.freeze({
        teamId: membership.teamId,
        userId: membership.userId,
        teamRoleId: membership.teamRoleId,
        team: projectTeamReference(membership.team),
        teamRole: membership.role === null
            ? null
            : projectTeamRoleReference(membership.role),
    });
}

function issueForUserMembership(
    membership: AuthorizationAdministrationUserRecord["teamMemberships"][number],
): AuthorizationAdministrationConfigurationIssue | null {
    const role = membership.role;
    const hasTeamMismatch = membership.teamId !== membership.team.id;
    const hasRoleMismatch = role === null
        ? membership.teamRoleId !== null
        : role.teamId !== membership.team.id
            || membership.teamRoleId !== role.id;

    if (!hasTeamMismatch && !hasRoleMismatch) return null;

    return Object.freeze({
        source: "MEMBERSHIP" as const,
        code: "TEAM_ROLE_MEMBERSHIP_MISMATCH" as const,
        teamId: membership.team.id,
        teamRoleId: membership.teamRoleId ?? role?.id,
        userId: membership.userId,
    });
}

function buildTeamDetail(
    team: AuthorizationAdministrationTeamDetailRecord,
    catalogByKey: ReadonlyMap<string, CapabilityAdministrationProjection>,
): AuthorizationAdministrationTeamDetail {
    const configurationIssues: AuthorizationAdministrationConfigurationIssue[] = [];
    const teamGrants: AuthorizationAdministrationTeamGrant[] = team.grants.map(
        (rawGrant) => {
            const grant = projectPersistedGrant(rawGrant, "TEAM", catalogByKey);
            const issue = issueFromGrant("TEAM_GRANT", grant, {
                teamId: team.id,
            });
            if (issue !== null) configurationIssues.push(issue);
            return Object.freeze({ ...grant, teamId: team.id });
        },
    );

    const roles: AuthorizationAdministrationTeamRole[] = team.roles.map(
        (role) => projectTeamRole(role),
    );
    const teamRoleGrants: AuthorizationAdministrationTeamRoleGrant[] = [];

    for (const role of team.roles) {
        if (role.teamId !== team.id) {
            configurationIssues.push(Object.freeze({
                source: "TEAM_ROLE_GRANT" as const,
                code: "TEAM_ROLE_GRANT_ORIGIN_MISMATCH" as const,
                teamId: team.id,
                teamRoleId: role.id,
            }));
        }

        const roleReference = projectTeamRoleReference(role);
        for (const rawGrant of role.grants) {
            const grant = projectPersistedGrant(
                rawGrant,
                "TEAM_ROLE",
                catalogByKey,
            );
            const issue = issueFromGrant("TEAM_ROLE_GRANT", grant, {
                teamId: role.teamId,
                teamRoleId: role.id,
            });
            if (issue !== null) configurationIssues.push(issue);
            if (role.teamId !== team.id) {
                configurationIssues.push(Object.freeze({
                    source: "TEAM_ROLE_GRANT" as const,
                    code: "TEAM_ROLE_GRANT_ORIGIN_MISMATCH" as const,
                    capabilityKey: rawGrant.capabilityKey,
                    scope: rawGrant.scope,
                    teamId: role.teamId,
                    teamRoleId: role.id,
                }));
            }
            teamRoleGrants.push(Object.freeze({
                ...grant,
                teamId: role.teamId,
                teamRoleId: role.id,
                teamRole: roleReference,
            }));
        }
    }

    const memberships = team.memberships.map((membership) => {
        const issue = issueForMembership(membership, team.id);
        if (issue !== null) configurationIssues.push(issue);
        return projectTeamMembership(membership);
    });

    return Object.freeze({
        ...projectTeamSummary(team),
        roles: freezeArray(roles),
        memberships: freezeArray(memberships),
        teamGrants: freezeArray(teamGrants),
        teamRoleGrants: freezeArray(teamRoleGrants),
        configurationIssues: freezeArray(configurationIssues),
    });
}

function buildSourceExplanation(
    source: AuthorizationGrantSource,
    memberships: readonly AuthorizationAdministrationUserTeamMembership[],
): AuthorizationAdministrationSourceExplanation {
    switch (source.type) {
        case "SYSTEM_ROLE":
            return Object.freeze({
                type: "SYSTEM_ROLE",
                role: source.role,
            });
        case "USER":
            return Object.freeze({
                type: "USER",
                userId: source.userId,
            });
        case "TEAM": {
            const membership = memberships.find(
                (candidate) => candidate.teamId === source.teamId,
            );
            return Object.freeze({
                type: "TEAM",
                teamId: source.teamId,
                team: membership?.team ?? null,
            });
        }
        case "TEAM_ROLE": {
            const membership = memberships.find(
                (candidate) => candidate.teamId === source.teamId
                    && candidate.teamRoleId === source.teamRoleId,
            );
            return Object.freeze({
                type: "TEAM_ROLE",
                teamId: source.teamId,
                team: membership?.team ?? null,
                teamRoleId: source.teamRoleId,
                teamRole: membership?.teamRole ?? null,
            });
        }
    }
}

function cloneGrantSource(source: AuthorizationGrantSource): AuthorizationGrantSource {
    switch (source.type) {
        case "SYSTEM_ROLE":
            return Object.freeze({ type: "SYSTEM_ROLE", role: source.role });
        case "TEAM":
            return Object.freeze({ type: "TEAM", teamId: source.teamId });
        case "TEAM_ROLE":
            return Object.freeze({
                type: "TEAM_ROLE",
                teamId: source.teamId,
                teamRoleId: source.teamRoleId,
            });
        case "USER":
            return Object.freeze({ type: "USER", userId: source.userId });
    }
}

function projectResolverEffectiveGrant(
    grant: EffectiveAuthorizationGrant,
    memberships: readonly AuthorizationAdministrationUserTeamMembership[],
): AuthorizationAdministrationResolverEffectiveGrant {
    if (!CAPABILITY_REGISTRY.has(grant.capability)) {
        throw new Error(
            `Resolver returned an unregistered capability: ${grant.capability}`,
        );
    }

    const base = {
        capability: grant.capability,
        scope: grant.scope,
        source: cloneGrantSource(grant.source),
        origin: buildSourceExplanation(grant.source, memberships),
    };

    if (!grant.constraint) return Object.freeze(base);

    return Object.freeze({
        ...base,
        constraint: Object.freeze({ teamId: grant.constraint.teamId }),
    });
}

function projectResolverEffectivePermissions(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    catalogByKey: ReadonlyMap<string, CapabilityAdministrationProjection>,
    memberships: readonly AuthorizationAdministrationUserTeamMembership[],
): readonly AuthorizationAdministrationResolverEffectivePermission[] {
    const permissions: AuthorizationAdministrationResolverEffectivePermission[] = [];

    for (const definition of CAPABILITY_REGISTRY.definitions) {
        const decision = decisions.get(definition.key);
        const capability = catalogByKey.get(definition.key);
        if (!decision || !capability || decision.capability !== definition.key) {
            throw new Error(
                `Authorization resolver omitted capability: ${definition.key}`,
            );
        }

        const grants = decision.grants.map((grant) =>
            projectResolverEffectiveGrant(grant, memberships),
        );
        permissions.push(Object.freeze({
            capability,
            allowed: decision.allowed,
            scopes: freezeArray(decision.scopes),
            grants: freezeArray(grants),
            ...(decision.reason === undefined
                ? {}
                : { reason: decision.reason }),
        }));
    }

    return freezeArray(permissions);
}

function haveSameScopes(
    left: readonly string[],
    right: readonly string[],
): boolean {
    return left.length === right.length
        && left.every((scope, index) => scope === right[index]);
}

function projectEffectiveAccessRows(
    inspections: readonly AuthorizationAdministrationEffectiveAccessInspection[],
    catalogByKey: ReadonlyMap<string, CapabilityAdministrationProjection>,
    memberships: readonly AuthorizationAdministrationUserTeamMembership[],
): readonly AuthorizationAdministrationEffectiveAccessRow[] {
    return freezeArray(inspections.map((inspection) => {
        const capability = catalogByKey.get(inspection.capability);
        if (!capability) {
            throw new Error(
                `Effective-access provider returned an unregistered capability: ${inspection.capability}`,
            );
        }

        const configuredDecision = inspection.configuredDecision;
        const grants = configuredDecision === null
            ? []
            : configuredDecision.grants.map((grant) =>
                projectResolverEffectiveGrant(grant, memberships),
            );
        const additionalScopes = configuredDecision?.allowed === true
            ? configuredDecision.scopes
            : [];
        const redundant = inspection.state === "AVAILABLE"
            && grants.length > 0
            && haveSameScopes(
                inspection.composedScopes,
                inspection.defaultScopes,
            );

        return Object.freeze({
            capability,
            context: Object.freeze({ ...inspection.context }),
            defaultAuthority: Object.freeze({
                scopes: freezeArray(inspection.defaultScopes),
            }),
            additionalAuthority: Object.freeze({
                scopes: freezeArray(additionalScopes),
                grants: freezeArray(grants),
                ...(configuredDecision?.reason === undefined
                    ? {}
                    : { reason: configuredDecision.reason }),
            }),
            effectiveAuthority: Object.freeze({
                state: inspection.state,
                scopes: freezeArray(inspection.effectiveScopes),
                redundant,
            }),
            limitations: freezeArray(inspection.limitations),
        });
    }));
}

function buildEffectiveAccessSummary(
    rows: readonly AuthorizationAdministrationEffectiveAccessRow[],
    configurationIssueCount: number,
): AuthorizationAdministrationEffectiveAccessSummary {
    const deferredCapabilities = new Set(
        rows
            .filter(({ effectiveAuthority }) => effectiveAuthority.state === "DEFERRED")
            .map(({ capability }) => capability.key),
    );

    return Object.freeze({
        inspectedContextCount: rows.length,
        availableContextCount: rows.filter(({ effectiveAuthority }) =>
            effectiveAuthority.state === "AVAILABLE",
        ).length,
        defaultBackedContextCount: rows.filter(({ defaultAuthority }) =>
            defaultAuthority.scopes.length > 0,
        ).length,
        additionalAuthorityContextCount: rows.filter(({ additionalAuthority }) =>
            additionalAuthority.grants.length > 0,
        ).length,
        unsupportedContextCount: rows.filter(({ effectiveAuthority }) =>
            effectiveAuthority.state === "UNSUPPORTED",
        ).length,
        deferredCapabilityCount: deferredCapabilities.size,
        configurationIssueCount,
    });
}

function projectResolutionError(
    error: AuthorizationConfigurationError,
): AuthorizationAdministrationResolutionError {
    return Object.freeze({
        code: error.code,
        ...error.details,
    });
}

function issueFromResolutionError(
    error: AuthorizationConfigurationError,
    userId: number,
): AuthorizationAdministrationConfigurationIssue {
    return Object.freeze({
        source: "EFFECTIVE_RESOLUTION",
        code: error.code,
        ...error.details,
        userId,
    });
}

function projectResolverEffectivePermissionStatus(
    error: AuthorizationConfigurationError | null,
): AuthorizationAdministrationResolverEffectivePermissionStatus {
    return error === null
        ? Object.freeze({ status: "RESOLVED" as const })
        : Object.freeze({
            status: "INVALID_CONFIGURATION" as const,
            error: projectResolutionError(error),
        });
}

function getRepository(
    dependencies: AuthorizationAdministrationQueryDependencies = {},
): AuthorizationAdministrationRepository {
    return dependencies.repository ?? authorizationAdministrationRepository;
}

function parseUserDirectoryQuery(query: unknown): string {
    if (
        typeof query !== "string"
        || query.length > AUTHORIZATION_ADMINISTRATION_USER_SEARCH_MAX_LENGTH
    ) {
        throw new AuthorizationAdministrationInputError("INVALID_INPUT");
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) {
        throw new AuthorizationAdministrationInputError("INVALID_INPUT");
    }

    return normalizedQuery;
}

export function getAuthorizationAdministrationCapabilityCatalog(
    principal: AuthorizationAdministrationPrincipal,
): readonly CapabilityAdministrationProjection[] {
    assertAuthorizationAdministrationAccess(principal);
    return buildCapabilityAdministrationCatalog();
}

/**
 * Return a bounded, lifecycle-aware identity directory for administration
 * selection. This is deliberately not a general User query API.
 */
export async function searchAuthorizationAdministrationUsers(
    principal: AuthorizationAdministrationPrincipal,
    query: unknown,
    dependencies: AuthorizationAdministrationQueryDependencies = {},
): Promise<readonly AuthorizationAdministrationUserSummary[]> {
    assertAuthorizationAdministrationAccess(principal);
    const normalizedQuery = parseUserDirectoryQuery(query);
    const users = await getRepository(dependencies).searchUsers(normalizedQuery);
    return freezeArray(users.map(projectAccountIdentity));
}

export async function listAuthorizationAdministrationTeams(
    principal: AuthorizationAdministrationPrincipal,
    dependencies: AuthorizationAdministrationQueryDependencies = {},
): Promise<readonly AuthorizationAdministrationTeamSummary[]> {
    assertAuthorizationAdministrationAccess(principal);
    const teams = await getRepository(dependencies).listTeams();
    return freezeArray(teams.map(projectTeamSummary));
}

export async function getAuthorizationAdministrationOverview(
    principal: AuthorizationAdministrationPrincipal,
    dependencies: AuthorizationAdministrationQueryDependencies = {},
): Promise<AuthorizationAdministrationOverview> {
    assertAuthorizationAdministrationAccess(principal);
    const capabilities = buildCapabilityAdministrationCatalog();
    const teams = await listAuthorizationAdministrationTeams(
        principal,
        dependencies,
    );

    const administrativelyGrantableCapabilityCount = capabilities.filter(
        (capability) => capability.administrativelyGrantable,
    ).length;
    const policyActivationRequiredCapabilityCount = capabilities.filter(
        (capability) => capability.administrativeStatus
            === "POLICY_ACTIVATION_REQUIRED",
    ).length;
    const deferredCapabilityCount = capabilities.filter(
        (capability) => capability.administrativeStatus === "DEFERRED",
    ).length;

    return Object.freeze({
        capabilities,
        teams,
        summary: Object.freeze({
            registeredCapabilityCount: capabilities.length,
            administrativelyGrantableCapabilityCount,
            policyActivationRequiredCapabilityCount,
            deferredCapabilityCount,
            teamCount: teams.length,
            activeTeamCount: teams.filter((team) => team.isActive).length,
        }),
    });
}

export async function getAuthorizationAdministrationTeam(
    principal: AuthorizationAdministrationPrincipal,
    teamId: number,
    dependencies: AuthorizationAdministrationQueryDependencies = {},
): Promise<AuthorizationAdministrationTeamDetail | null> {
    assertAuthorizationAdministrationAccess(principal);
    assertValidTargetId(teamId);
    const team = await getRepository(dependencies).findTeamById(teamId);
    if (team === null) return null;

    const catalog = buildCapabilityAdministrationCatalog();
    const catalogByKey = new Map(
        catalog.map((capability) => [capability.key, capability] as const),
    );
    return buildTeamDetail(team, catalogByKey);
}

export async function getAuthorizationAdministrationUser(
    principal: AuthorizationAdministrationPrincipal,
    userId: number,
    dependencies: AuthorizationAdministrationUserQueryDependencies,
): Promise<AuthorizationAdministrationUserDetail | null> {
    assertAuthorizationAdministrationAccess(principal);
    assertValidTargetId(userId);

    const user = await getRepository(dependencies).findUserById(userId);
    if (user === null) return null;

    const catalog = buildCapabilityAdministrationCatalog();
    const catalogByKey = new Map(
        catalog.map((capability) => [capability.key, capability] as const),
    );
    const userIdentity = projectAccountIdentity({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        deletedAt: user.deletedAt,
        employee: user.employee,
    });
    const teamMemberships = freezeArray(
        user.teamMemberships.map(projectUserMembership),
    );
    const configurationIssues: AuthorizationAdministrationConfigurationIssue[] = [];
    for (const membership of user.teamMemberships) {
        const issue = issueForUserMembership(membership);
        if (issue !== null) configurationIssues.push(issue);
    }
    const directGrants = user.userCapabilityGrants.map((rawGrant) =>
        projectPersistedGrant(rawGrant, "USER", catalogByKey),
    );
    for (const grant of directGrants) {
        const issue = issueFromGrant("USER_GRANT", grant, {
            userId: user.id,
        });
        if (issue !== null) configurationIssues.push(issue);
    }

    const targetActor: AuthorizationActor = {
        userId: user.id,
        employeeId: user.employee?.id ?? null,
        systemRole: parsePersistedUserRole(user.role),
        channel: "DASHBOARD",
    };
    const capabilityKeys = CAPABILITY_REGISTRY.definitions.map(
        (definition) => definition.key,
    );
    const resolver: Pick<AuthorizationResolver, "resolveMany"> =
        dependencies.resolver ?? authorization;

    let resolverEffectivePermissionStatus: AuthorizationAdministrationResolverEffectivePermissionStatus;
    let resolverEffectivePermissions: readonly AuthorizationAdministrationResolverEffectivePermission[];
    let effectiveAccessStatus: AuthorizationAdministrationEffectiveAccessStatus;
    let effectiveAccess: readonly AuthorizationAdministrationEffectiveAccessRow[];
    try {
        const decisions = await resolver.resolveMany(targetActor, capabilityKeys);
        resolverEffectivePermissions = projectResolverEffectivePermissions(
            decisions,
            catalogByKey,
            teamMemberships,
        );
        resolverEffectivePermissionStatus =
            projectResolverEffectivePermissionStatus(null);

        try {
            const inspections = await dependencies.effectiveAccessProvider.inspect({
                actor: targetActor,
                dashboardDecisions: decisions,
                resolver,
            });
            effectiveAccess = projectEffectiveAccessRows(
                inspections,
                catalogByKey,
                teamMemberships,
            );
            effectiveAccessStatus = Object.freeze({ status: "RESOLVED" as const });
        } catch (error) {
            if (!(error instanceof AuthorizationConfigurationError)) throw error;
            configurationIssues.push(issueFromResolutionError(error, user.id));
            effectiveAccess = [];
            effectiveAccessStatus = projectResolverEffectivePermissionStatus(error);
        }
    } catch (error) {
        if (!(error instanceof AuthorizationConfigurationError)) throw error;
        configurationIssues.push(issueFromResolutionError(error, user.id));
        resolverEffectivePermissions = [];
        resolverEffectivePermissionStatus =
            projectResolverEffectivePermissionStatus(error);
        effectiveAccess = [];
        effectiveAccessStatus = projectResolverEffectivePermissionStatus(error);
    }

    const effectiveAccessSummary = buildEffectiveAccessSummary(
        effectiveAccess,
        configurationIssues.length,
    );

    return Object.freeze({
        user: userIdentity,
        systemRole: userIdentity.role,
        teamMemberships,
        directGrants: freezeArray(directGrants),
        resolverEffectivePermissionStatus,
        resolverEffectivePermissions,
        effectiveAccessStatus,
        effectiveAccess,
        effectiveAccessSummary,
        configurationIssues: freezeArray(configurationIssues),
    });
}
