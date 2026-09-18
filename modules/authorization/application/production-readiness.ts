import type {
    AuthorizationActor,
    AuthorizationChannel,
    AuthorizationScope,
    CapabilityDefinition,
} from "../contracts";
import { CAPABILITY_REGISTRY } from "../registry";
import {
    buildCapabilityAdministrationCatalog,
} from "./administration-catalog";
import type {
    AuthorizationAdministrationEffectiveAccessInspection,
    AuthorizationAdministrationEffectiveAccessProvider,
    AuthorizationAdministrationEffectiveAccessState,
    CapabilityAdministrationProjection,
} from "./administration-types";
import {
    createAuthorizationResolver,
} from "./resolver";
import { normalizeAuthorizationScopes } from "./evaluator";
import type {
    AuthorizationDecision,
    AuthorizationResolutionData,
    AuthorizationResolutionRepository,
} from "./types";

export const AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS = Object.freeze([
    "20260108060001_add_audit_log",
    "20260911100000_add_authorization_persistence",
    "20260914100000_add_authorization_audit_actions",
] as const);

export type AuthorizationProductionReadinessStatus =
    | "PASS"
    | "WARNING"
    | "BLOCKED"
    | "NOT_RUN";

export type AuthorizationProductionFindingSeverity = "WARNING" | "BLOCKER";

export type AuthorizationProductionFindingKind =
    | "CONFIGURATION"
    | "LIFECYCLE"
    | "MIGRATION"
    | "OPERATIONAL";

export type AuthorizationProductionFindingSource =
    | "TEAM"
    | "TEAM_ROLE"
    | "MEMBERSHIP"
    | "USER"
    | "EMPLOYEE"
    | "TEAM_GRANT"
    | "TEAM_ROLE_GRANT"
    | "USER_GRANT"
    | "REDUNDANCY"
    | "MIGRATION"
    | "REGISTRY"
    | "INVENTORY";

export type AuthorizationProductionFindingCode =
    | "UNKNOWN_PERSISTED_CAPABILITY"
    | "UNSUPPORTED_PERSISTED_SCOPE"
    | "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN"
    | "TEAM_GRANT_ORIGIN_MISMATCH"
    | "TEAM_ROLE_GRANT_ORIGIN_MISMATCH"
    | "TEAM_ROLE_MEMBERSHIP_MISMATCH"
    | "MISSING_TEAM_REFERENCE"
    | "MISSING_TEAM_ROLE_REFERENCE"
    | "MISSING_USER_REFERENCE"
    | "MISSING_EMPLOYEE_REFERENCE"
    | "INVALID_IDENTIFIER"
    | "MALFORMED_AUTHORIZATION_CONFIGURATION"
    | "INVALID_LIFECYCLE_STATE"
    | "INACTIVE_TEAM_CONFIGURATION"
    | "INACTIVE_TEAM_ROLE_CONFIGURATION"
    | "INACTIVE_USER_CONFIGURATION"
    | "INACTIVE_EMPLOYEE_CONFIGURATION"
    | "ADMIN_PERSISTED_GRANT_REDUNDANT"
    | "NON_ADMINISTRATIVELY_GRANTABLE"
    | "DUPLICATE_PERSISTED_AUTHORITY"
    | "REDUNDANT_CONFIGURED_AUTHORITY"
    | "REQUIRED_MIGRATION_NOT_APPLIED"
    | "REGISTRY_ADMINISTRATION_METADATA_INVALID"
    | "INVENTORY_READ_FAILED";

export type AuthorizationProductionMigrationEvidenceStatus =
    | "APPLIED"
    | "MISSING"
    | "INCOMPLETE"
    | "NOT_RUN";

export type AuthorizationProductionEmployeeStatus =
    | "ACTIVE"
    | "INACTIVE"
    | "SUSPENDED";

export type AuthorizationProductionUserRole = "USER" | "ADMIN";

export interface AuthorizationProductionTeamSnapshot {
    readonly id: number;
    readonly isActive: boolean;
}

export interface AuthorizationProductionTeamRoleSnapshot {
    readonly id: number;
    readonly teamId: number;
    readonly isActive: boolean;
}

export interface AuthorizationProductionMembershipSnapshot {
    readonly teamId: number;
    readonly userId: number;
    readonly teamRoleId: number | null;
}

export interface AuthorizationProductionTeamGrantSnapshot {
    readonly teamId: number;
    readonly capabilityKey: string;
    readonly scope: string;
}

export interface AuthorizationProductionTeamRoleGrantSnapshot {
    readonly teamRoleId: number;
    /** Null means the TeamRole relation could not be resolved. */
    readonly teamId: number | null;
    readonly capabilityKey: string;
    readonly scope: string;
}

export interface AuthorizationProductionUserGrantSnapshot {
    readonly userId: number;
    readonly capabilityKey: string;
    readonly scope: string;
}

export interface AuthorizationProductionUserSnapshot {
    readonly id: number;
    readonly role: AuthorizationProductionUserRole;
    readonly isActive: boolean;
    readonly deletedAt: Date | null;
    readonly employeeId: number | null;
}

export interface AuthorizationProductionEmployeeSnapshot {
    readonly id: number;
    readonly status: AuthorizationProductionEmployeeStatus;
    readonly deletedAt: Date | null;
}

export interface AuthorizationProductionMigrationSnapshot {
    readonly migrationName: string;
    readonly finishedAt: Date | null;
    readonly rolledBackAt: Date | null;
    readonly appliedStepsCount: number;
}

/**
 * A read-only snapshot of the persisted authorization boundary. It contains
 * identifiers and lifecycle flags only; it deliberately has no credentials,
 * session values, email addresses, or other account profile data.
 */
export interface AuthorizationProductionInventorySnapshot {
    readonly teams: readonly AuthorizationProductionTeamSnapshot[];
    readonly teamRoles: readonly AuthorizationProductionTeamRoleSnapshot[];
    readonly memberships: readonly AuthorizationProductionMembershipSnapshot[];
    readonly teamGrants: readonly AuthorizationProductionTeamGrantSnapshot[];
    readonly teamRoleGrants: readonly AuthorizationProductionTeamRoleGrantSnapshot[];
    readonly userGrants: readonly AuthorizationProductionUserGrantSnapshot[];
    readonly users: readonly AuthorizationProductionUserSnapshot[];
    readonly employees: readonly AuthorizationProductionEmployeeSnapshot[];
    readonly migrations: readonly AuthorizationProductionMigrationSnapshot[];
}

export interface AuthorizationProductionGroupedCount {
    readonly capabilityKey: string;
    readonly count: number;
}

export interface AuthorizationProductionSourceScopeCount {
    readonly source: "TEAM" | "TEAM_ROLE" | "USER";
    readonly scope: string;
    readonly count: number;
}

export interface AuthorizationProductionInventorySummary {
    readonly teamCount: number;
    readonly activeTeamCount: number;
    readonly inactiveTeamCount: number;
    readonly teamRoleCount: number;
    readonly activeTeamRoleCount: number;
    readonly inactiveTeamRoleCount: number;
    readonly membershipCount: number;
    readonly teamGrantCount: number;
    readonly teamRoleGrantCount: number;
    readonly directUserGrantCount: number;
    readonly grantsByCapability: readonly AuthorizationProductionGroupedCount[];
    readonly grantsBySourceAndScope: readonly AuthorizationProductionSourceScopeCount[];
    readonly redundantAuthorityCount: number;
    readonly invalidConfigurationCount: number;
    readonly warningCount: number;
    readonly blockerCount: number;
}

export interface AuthorizationProductionFinding {
    readonly severity: AuthorizationProductionFindingSeverity;
    readonly kind: AuthorizationProductionFindingKind;
    readonly source: AuthorizationProductionFindingSource;
    readonly code: AuthorizationProductionFindingCode;
    readonly reason: string;
    readonly capabilityKey?: string;
    readonly scope?: string;
    readonly teamId?: number;
    readonly teamRoleId?: number;
    readonly userId?: number;
    readonly employeeId?: number;
    readonly migrationName?: string;
}

export interface AuthorizationProductionMigrationCheck {
    readonly migrationName: string;
    readonly status: AuthorizationProductionMigrationEvidenceStatus;
}

export interface AuthorizationProductionReadinessEvaluation {
    readonly status: AuthorizationProductionReadinessStatus;
    readonly summary: AuthorizationProductionInventorySummary;
    readonly migrationChecks: readonly AuthorizationProductionMigrationCheck[];
    readonly findings: readonly AuthorizationProductionFinding[];
    readonly failureCode?: "INVENTORY_READ_FAILED";
    readonly notRunReason?: string;
}

export interface AuthorizationProductionFindingCount {
    readonly severity: AuthorizationProductionFindingSeverity;
    readonly code: AuthorizationProductionFindingCode;
    readonly count: number;
}

export interface AuthorizationProductionReadinessReport {
    readonly status: AuthorizationProductionReadinessStatus;
    readonly summary: AuthorizationProductionInventorySummary;
    readonly migrationChecks: readonly AuthorizationProductionMigrationCheck[];
    readonly findingCounts: readonly AuthorizationProductionFindingCount[];
    readonly failureCode?: "INVENTORY_READ_FAILED";
    readonly notRunReason?: string;
    readonly findings?: readonly AuthorizationProductionFinding[];
}

export interface AuthorizationProductionReadinessRepository {
    load(): Promise<AuthorizationProductionInventorySnapshot>;
}

export interface AuthorizationProductionCanaryEffectiveAccessBefore {
    readonly observerUserId: number;
    readonly capabilityKey: string;
    readonly channel: AuthorizationChannel;
    readonly contextKey: string;
    readonly state: AuthorizationAdministrationEffectiveAccessState;
    readonly defaultScopes: readonly AuthorizationScope[];
    readonly effectiveScopes: readonly AuthorizationScope[];
}

export type AuthorizationProductionWarningFindingReference = Pick<
    AuthorizationProductionFinding,
    | "kind"
    | "source"
    | "code"
    | "capabilityKey"
    | "scope"
    | "teamId"
    | "teamRoleId"
    | "userId"
    | "employeeId"
    | "migrationName"
>;

export interface AuthorizationProductionWarningReview {
    readonly finding: AuthorizationProductionWarningFindingReference;
    readonly disposition: string;
    readonly reviewedBy: string;
}

export interface AuthorizationProductionCanaryPlan {
    readonly source: "TEAM" | "TEAM_ROLE" | "USER";
    /** Team id, TeamRole id, or User id according to source. */
    readonly targetId: number;
    /** The actual User who will exercise the canary protected path. */
    readonly observerUserId: number;
    readonly capabilityKey: string;
    readonly scope: string;
    readonly channel: AuthorizationChannel;
    /** Identifies the exact domain-owned effective-access context to verify. */
    readonly contextKey: string;
    /** Captured from the authoritative Administration effective-access read model before mutation. */
    readonly effectiveAccessBefore: AuthorizationProductionCanaryEffectiveAccessBefore;
    /** Explicit operator review for every WARNING in the inspected snapshot. */
    readonly reviewedWarnings: readonly AuthorizationProductionWarningReview[];
    readonly businessReason: string;
    readonly expectedAuthorityBefore: string;
    readonly expectedAuthorityAfter: string;
    readonly expectedResourceDomainLimitation: string;
    readonly operator: string;
    readonly plannedTimeWindow: string;
    readonly rollbackAction: string;
}

export type AuthorizationProductionCanaryIssueCode =
    | AuthorizationProductionFindingCode
    | "CANARY_REQUIRED_FIELD"
    | "CANARY_TARGET_NOT_FOUND"
    | "CANARY_TARGET_INACTIVE"
    | "CANARY_TARGET_NOT_WORKFORCE_ELIGIBLE"
    | "CANARY_NO_ACTIVE_MEMBER"
    | "CANARY_GRANT_ALREADY_EXISTS"
    | "CANARY_EFFECTIVE_ACCESS_EVIDENCE_INVALID"
    | "CANARY_NO_EFFECTIVE_AUTHORITY_CHANGE"
    | "CANARY_WARNING_REVIEW_REQUIRED"
    | "CANARY_WARNING_REVIEW_STALE"
    | "CANARY_CHANNEL_UNSUPPORTED"
    | "CANARY_READINESS_BLOCKED";

export interface AuthorizationProductionCanaryIssue {
    readonly code: AuthorizationProductionCanaryIssueCode;
    readonly reason: string;
}

export interface AuthorizationProductionCanaryValidation {
    readonly status: "PASS" | "BLOCKED";
    readonly issues: readonly AuthorizationProductionCanaryIssue[];
}

export interface AuthorizationProductionCanaryValidationDependencies {
    /**
     * The outer server composition's authoritative domain effective-access
     * provider. Readiness must not recreate domain policy locally.
     */
    readonly effectiveAccessProvider: AuthorizationAdministrationEffectiveAccessProvider;
}

interface PersistedGrantReference {
    readonly source: "TEAM" | "TEAM_ROLE" | "USER";
    readonly teamId?: number;
    readonly teamRoleId?: number;
    readonly userId?: number;
    readonly capabilityKey: string;
    readonly scope: string;
}

interface ConfiguredAuthorityEntry {
    readonly userId: number;
    readonly capabilityKey: string;
    readonly scope: string;
    readonly sources: Set<string>;
}

function isValidIdentifier(value: number): boolean {
    return Number.isSafeInteger(value) && value > 0;
}

function compareStrings(left: string, right: string): number {
    return left.localeCompare(right);
}

function findingSortKey(finding: AuthorizationProductionFinding): string {
    return [
        finding.severity === "BLOCKER" ? "0" : "1",
        finding.kind,
        finding.source,
        finding.code,
        finding.capabilityKey ?? "",
        finding.scope ?? "",
        finding.teamId ?? 0,
        finding.teamRoleId ?? 0,
        finding.userId ?? 0,
        finding.employeeId ?? 0,
        finding.migrationName ?? "",
        finding.reason,
    ].join("\u0000");
}

function addFinding(
    findings: AuthorizationProductionFinding[],
    finding: AuthorizationProductionFinding,
): void {
    findings.push(Object.freeze(finding));
}

function addFindingOnce(
    findings: AuthorizationProductionFinding[],
    emitted: Set<string>,
    key: string,
    finding: AuthorizationProductionFinding,
): void {
    if (emitted.has(key)) return;
    emitted.add(key);
    addFinding(findings, finding);
}

function buildMap<T extends { readonly id: number }>(
    rows: readonly T[],
    findings: AuthorizationProductionFinding[],
    source: AuthorizationProductionFindingSource,
): Map<number, T> {
    const map = new Map<number, T>();
    for (const row of rows) {
        if (!isValidIdentifier(row.id)) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "CONFIGURATION",
                source,
                code: "INVALID_IDENTIFIER",
                reason: "Persisted authorization identity has an invalid identifier.",
            });
            continue;
        }
        if (map.has(row.id)) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "CONFIGURATION",
                source,
                code: "MALFORMED_AUTHORIZATION_CONFIGURATION",
                reason: "Persisted authorization inventory contains a duplicate identity row.",
                ...(source === "TEAM" ? { teamId: row.id } : {}),
                ...(source === "TEAM_ROLE" ? { teamRoleId: row.id } : {}),
                ...(source === "USER" ? { userId: row.id } : {}),
            });
            continue;
        }
        map.set(row.id, row);
    }
    return map;
}

function checkDuplicateGrantRows(
    references: readonly PersistedGrantReference[],
    findings: AuthorizationProductionFinding[],
): void {
    const seen = new Set<string>();
    for (const reference of references) {
        const key = [
            reference.source,
            reference.teamId ?? "",
            reference.teamRoleId ?? "",
            reference.userId ?? "",
            reference.capabilityKey,
            reference.scope,
        ].join("\u0000");
        if (seen.has(key)) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "CONFIGURATION",
                source: "INVENTORY",
                code: "DUPLICATE_PERSISTED_AUTHORITY",
                reason: "The persisted authorization inventory contains duplicate grant authority.",
                capabilityKey: reference.capabilityKey,
                scope: reference.scope,
                teamId: reference.teamId,
                teamRoleId: reference.teamRoleId,
                userId: reference.userId,
            });
        }
        seen.add(key);
    }
}

function getCapabilityDefinition(
    capabilityKey: string,
    scope: string,
    source: AuthorizationProductionFindingSource,
    target: Pick<AuthorizationProductionFinding, "teamId" | "teamRoleId" | "userId">,
    findings: AuthorizationProductionFinding[],
): CapabilityDefinition | null {
    const definition = CAPABILITY_REGISTRY.get(capabilityKey);
    if (definition === undefined) {
        addFinding(findings, {
            severity: "BLOCKER",
            kind: "CONFIGURATION",
            source,
            code: "UNKNOWN_PERSISTED_CAPABILITY",
            reason: "Persisted capability key is not present in the code-owned Capability Registry.",
            capabilityKey,
            scope,
            ...target,
        });
        return null;
    }

    if (!definition.scopes.some((supportedScope) => supportedScope === scope)) {
        addFinding(findings, {
            severity: "BLOCKER",
            kind: "CONFIGURATION",
            source,
            code: "UNSUPPORTED_PERSISTED_SCOPE",
            reason: "Persisted scope is not supported by the registered capability.",
            capabilityKey,
            scope,
            ...target,
        });
        return null;
    }

    return definition;
}

function isActiveUser(user: AuthorizationProductionUserSnapshot): boolean {
    return user.isActive && user.deletedAt === null;
}

function isEffectiveConfiguredUser(user: AuthorizationProductionUserSnapshot): boolean {
    return user.role === "USER" && isActiveUser(user);
}

function isActiveEmployee(employee: AuthorizationProductionEmployeeSnapshot): boolean {
    return employee.status === "ACTIVE" && employee.deletedAt === null;
}

function checkUserLifecycle(
    user: AuthorizationProductionUserSnapshot,
    employees: ReadonlyMap<number, AuthorizationProductionEmployeeSnapshot>,
    findings: AuthorizationProductionFinding[],
    emitted: Set<string>,
): void {
    if (user.isActive && user.deletedAt !== null) {
        addFindingOnce(findings, emitted, `user-invalid:${user.id}`, {
            severity: "BLOCKER",
            kind: "LIFECYCLE",
            source: "USER",
            code: "INVALID_LIFECYCLE_STATE",
            reason: "User is marked active while also carrying a deletion timestamp.",
            userId: user.id,
        });
    } else if (!isActiveUser(user)) {
        addFindingOnce(findings, emitted, `user-inactive:${user.id}`, {
            severity: "WARNING",
            kind: "LIFECYCLE",
            source: "USER",
            code: "INACTIVE_USER_CONFIGURATION",
            reason: "Authorization configuration references an inactive or deleted User; stored history is not treated as effective authority.",
            userId: user.id,
        });
    }

    if (user.employeeId === null) return;

    const employee = employees.get(user.employeeId);
    if (employee === undefined) {
        addFindingOnce(findings, emitted, `employee-missing:${user.employeeId}`, {
            severity: "BLOCKER",
            kind: "LIFECYCLE",
            source: "EMPLOYEE",
            code: "MISSING_EMPLOYEE_REFERENCE",
            reason: "User authorization configuration references an Employee row that is not present.",
            userId: user.id,
            employeeId: user.employeeId,
        });
        return;
    }

    if (employee.status === "ACTIVE" && employee.deletedAt !== null) {
        addFindingOnce(findings, emitted, `employee-invalid:${employee.id}`, {
            severity: "BLOCKER",
            kind: "LIFECYCLE",
            source: "EMPLOYEE",
            code: "INVALID_LIFECYCLE_STATE",
            reason: "Employee is marked active while also carrying a deletion timestamp.",
            userId: user.id,
            employeeId: employee.id,
        });
    } else if (!isActiveEmployee(employee)) {
        addFindingOnce(findings, emitted, `employee-inactive:${employee.id}`, {
            severity: "WARNING",
            kind: "LIFECYCLE",
            source: "EMPLOYEE",
            code: "INACTIVE_EMPLOYEE_CONFIGURATION",
            reason: "Authorization configuration references an inactive or deleted Employee; stored history is not treated as effective authority.",
            userId: user.id,
            employeeId: employee.id,
        });
    }
}

function addInactiveTeamFinding(
    findings: AuthorizationProductionFinding[],
    teamId: number,
    source: AuthorizationProductionFindingSource,
    capabilityKey?: string,
    scope?: string,
): void {
    addFinding(findings, {
        severity: "WARNING",
        kind: "LIFECYCLE",
        source,
        code: "INACTIVE_TEAM_CONFIGURATION",
        reason: "An inactive Team retains authorization configuration; it is not treated as effective authority.",
        teamId,
        capabilityKey,
        scope,
    });
}

function addInactiveTeamRoleFinding(
    findings: AuthorizationProductionFinding[],
    teamId: number,
    teamRoleId: number,
    source: AuthorizationProductionFindingSource,
    capabilityKey?: string,
    scope?: string,
): void {
    addFinding(findings, {
        severity: "WARNING",
        kind: "LIFECYCLE",
        source,
        code: "INACTIVE_TEAM_ROLE_CONFIGURATION",
        reason: "An inactive TeamRole retains authorization configuration; it is not treated as effective authority.",
        teamId,
        teamRoleId,
        capabilityKey,
        scope,
    });
}

function isEffectiveMembership(
    membership: AuthorizationProductionMembershipSnapshot,
    teams: ReadonlyMap<number, AuthorizationProductionTeamSnapshot>,
    roles: ReadonlyMap<number, AuthorizationProductionTeamRoleSnapshot>,
    users: ReadonlyMap<number, AuthorizationProductionUserSnapshot>,
): boolean {
    const team = teams.get(membership.teamId);
    const user = users.get(membership.userId);
    if (team === undefined || !team.isActive || user === undefined || !isEffectiveConfiguredUser(user)) {
        return false;
    }
    if (membership.teamRoleId === null) return true;
    const role = roles.get(membership.teamRoleId);
    return role !== undefined
        && role.teamId === membership.teamId
        && role.isActive;
}

function addNonGrantableFinding(
    findings: AuthorizationProductionFinding[],
    definition: CapabilityAdministrationProjection,
    reference: PersistedGrantReference,
    sourceIsActive: boolean,
): void {
    addFinding(findings, {
        severity: sourceIsActive ? "BLOCKER" : "WARNING",
        kind: "CONFIGURATION",
        source: reference.source === "TEAM"
            ? "TEAM_GRANT"
            : reference.source === "TEAM_ROLE"
                ? "TEAM_ROLE_GRANT"
                : "USER_GRANT",
        code: "NON_ADMINISTRATIVELY_GRANTABLE",
        reason: sourceIsActive
            ? `Persisted grant targets a capability whose administration status is ${definition.administrativeStatus}; it cannot be used for a controlled first deployment.`
            : `Persisted grant targets a capability whose administration status is ${definition.administrativeStatus}; the source is inactive and is not treated as effective authority.`,
        capabilityKey: reference.capabilityKey,
        scope: reference.scope,
        teamId: reference.teamId,
        teamRoleId: reference.teamRoleId,
        userId: reference.userId,
    });
}

function addConfiguredAuthority(
    authority: Map<string, ConfiguredAuthorityEntry>,
    reference: PersistedGrantReference,
    userId: number,
    sourceIdentity: string,
): void {
    const key = [userId, reference.capabilityKey, reference.scope].join("\u0000");
    const current = authority.get(key);
    if (current === undefined) {
        authority.set(key, {
            userId,
            capabilityKey: reference.capabilityKey,
            scope: reference.scope,
            sources: new Set([sourceIdentity]),
        });
        return;
    }
    current.sources.add(sourceIdentity);
}

function buildSummary(
    snapshot: AuthorizationProductionInventorySnapshot,
    findings: readonly AuthorizationProductionFinding[],
    redundantAuthorityCount: number,
): AuthorizationProductionInventorySummary {
    const capabilityCounts = new Map<string, number>();
    const sourceScopeCounts = new Map<string, AuthorizationProductionSourceScopeCount>();
    const addGrantCount = (
        source: "TEAM" | "TEAM_ROLE" | "USER",
        capabilityKey: string,
        scope: string,
    ): void => {
        capabilityCounts.set(
            capabilityKey,
            (capabilityCounts.get(capabilityKey) ?? 0) + 1,
        );
        const sourceScopeKey = `${source}\u0000${scope}`;
        const current = sourceScopeCounts.get(sourceScopeKey);
        sourceScopeCounts.set(sourceScopeKey, {
            source,
            scope,
            count: (current?.count ?? 0) + 1,
        });
    };

    for (const grant of snapshot.teamGrants) {
        addGrantCount("TEAM", grant.capabilityKey, grant.scope);
    }
    for (const grant of snapshot.teamRoleGrants) {
        addGrantCount("TEAM_ROLE", grant.capabilityKey, grant.scope);
    }
    for (const grant of snapshot.userGrants) {
        addGrantCount("USER", grant.capabilityKey, grant.scope);
    }

    const grantsByCapability = [...capabilityCounts.entries()]
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([capabilityKey, count]) => ({ capabilityKey, count }));
    const grantsBySourceAndScope = [...sourceScopeCounts.values()]
        .sort((left, right) =>
            compareStrings(left.source, right.source)
            || compareStrings(left.scope, right.scope),
        );
    const activeTeamCount = snapshot.teams.filter((team) => team.isActive).length;
    const activeTeamRoleCount = snapshot.teamRoles.filter((role) => role.isActive).length;

    return Object.freeze({
        teamCount: snapshot.teams.length,
        activeTeamCount,
        inactiveTeamCount: snapshot.teams.length - activeTeamCount,
        teamRoleCount: snapshot.teamRoles.length,
        activeTeamRoleCount,
        inactiveTeamRoleCount: snapshot.teamRoles.length - activeTeamRoleCount,
        membershipCount: snapshot.memberships.length,
        teamGrantCount: snapshot.teamGrants.length,
        teamRoleGrantCount: snapshot.teamRoleGrants.length,
        directUserGrantCount: snapshot.userGrants.length,
        grantsByCapability: Object.freeze(grantsByCapability),
        grantsBySourceAndScope: Object.freeze(grantsBySourceAndScope),
        redundantAuthorityCount,
        invalidConfigurationCount: findings.filter(
            (finding) => finding.kind === "CONFIGURATION"
                && finding.code !== "REDUNDANT_CONFIGURED_AUTHORITY",
        ).length,
        warningCount: findings.filter(
            (finding) => finding.severity === "WARNING",
        ).length,
        blockerCount: findings.filter(
            (finding) => finding.severity === "BLOCKER",
        ).length,
    });
}

function buildMigrationChecks(
    snapshot: AuthorizationProductionInventorySnapshot,
    findings: AuthorizationProductionFinding[],
): readonly AuthorizationProductionMigrationCheck[] {
    const rows = new Map<string, AuthorizationProductionMigrationSnapshot>();
    for (const row of snapshot.migrations) {
        if (rows.has(row.migrationName)) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "MIGRATION",
                source: "MIGRATION",
                code: "MALFORMED_AUTHORIZATION_CONFIGURATION",
                reason: "Migration evidence contains duplicate migration rows.",
                migrationName: row.migrationName,
            });
            continue;
        }
        rows.set(row.migrationName, row);
    }

    const checks = AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS.map(
        (migrationName): AuthorizationProductionMigrationCheck => {
            const row = rows.get(migrationName);
            if (row === undefined) {
                addFinding(findings, {
                    severity: "BLOCKER",
                    kind: "MIGRATION",
                    source: "MIGRATION",
                    code: "REQUIRED_MIGRATION_NOT_APPLIED",
                    reason: "Required production migration is not recorded as applied in the inspected database.",
                    migrationName,
                });
                return { migrationName, status: "MISSING" };
            }

            const applied = row.finishedAt !== null
                && row.rolledBackAt === null
                && Number.isSafeInteger(row.appliedStepsCount)
                && row.appliedStepsCount > 0;
            if (!applied) {
                addFinding(findings, {
                    severity: "BLOCKER",
                    kind: "MIGRATION",
                    source: "MIGRATION",
                    code: "REQUIRED_MIGRATION_NOT_APPLIED",
                    reason: "Required production migration is present but incomplete or rolled back.",
                    migrationName,
                });
                return { migrationName, status: "INCOMPLETE" };
            }
            return { migrationName, status: "APPLIED" };
        },
    );
    return Object.freeze(checks);
}

function getCatalogByKey(
    findings: AuthorizationProductionFinding[],
): ReadonlyMap<string, CapabilityAdministrationProjection> {
    try {
        return new Map(
            buildCapabilityAdministrationCatalog().map((capability) => [
                capability.key,
                capability,
            ] as const),
        );
    } catch {
        addFinding(findings, {
            severity: "BLOCKER",
            kind: "CONFIGURATION",
            source: "REGISTRY",
            code: "REGISTRY_ADMINISTRATION_METADATA_INVALID",
            reason: "Capability administration metadata cannot be built from the code-owned registry.",
        });
        return new Map();
    }
}

function addRedundancyFindings(
    authority: ReadonlyMap<string, ConfiguredAuthorityEntry>,
    findings: AuthorizationProductionFinding[],
): number {
    let redundantAuthorityCount = 0;
    for (const entry of authority.values()) {
        if (entry.sources.size < 2) continue;
        redundantAuthorityCount += 1;
        addFinding(findings, {
            severity: "WARNING",
            kind: "CONFIGURATION",
            source: "REDUNDANCY",
            code: "REDUNDANT_CONFIGURED_AUTHORITY",
            reason: "More than one active configured source supplies the same capability and scope to a User; additive authority remains separate and is not collapsed.",
            capabilityKey: entry.capabilityKey,
            scope: entry.scope,
            userId: entry.userId,
        });
    }
    return redundantAuthorityCount;
}

export function evaluateAuthorizationProductionReadiness(
    snapshot: AuthorizationProductionInventorySnapshot,
): AuthorizationProductionReadinessEvaluation {
    const findings: AuthorizationProductionFinding[] = [];
    const emitted = new Set<string>();
    const teams = buildMap(snapshot.teams, findings, "TEAM");
    const roles = buildMap(snapshot.teamRoles, findings, "TEAM_ROLE");
    const users = buildMap(snapshot.users, findings, "USER");
    const employees = new Map<number, AuthorizationProductionEmployeeSnapshot>();

    for (const employee of snapshot.employees) {
        if (!isValidIdentifier(employee.id)) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "LIFECYCLE",
                source: "EMPLOYEE",
                code: "INVALID_IDENTIFIER",
                reason: "Persisted Employee identity has an invalid identifier.",
            });
            continue;
        }
        if (employees.has(employee.id)) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "LIFECYCLE",
                source: "EMPLOYEE",
                code: "MALFORMED_AUTHORIZATION_CONFIGURATION",
                reason: "Employee inventory contains a duplicate identity row.",
                employeeId: employee.id,
            });
            continue;
        }
        employees.set(employee.id, employee);
    }

    const teamGrantReferences: PersistedGrantReference[] = snapshot.teamGrants.map(
        (grant) => ({ ...grant, source: "TEAM" as const }),
    );
    const teamRoleGrantReferences: PersistedGrantReference[] = snapshot.teamRoleGrants.map(
        (grant) => ({
            ...grant,
            teamId: grant.teamId ?? undefined,
            source: "TEAM_ROLE" as const,
        }),
    );
    const userGrantReferences: PersistedGrantReference[] = snapshot.userGrants.map(
        (grant) => ({ ...grant, source: "USER" as const }),
    );
    checkDuplicateGrantRows(
        [...teamGrantReferences, ...teamRoleGrantReferences, ...userGrantReferences],
        findings,
    );

    for (const role of snapshot.teamRoles) {
        if (!teams.has(role.teamId)) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "CONFIGURATION",
                source: "TEAM_ROLE",
                code: "MISSING_TEAM_REFERENCE",
                reason: "TeamRole references a Team row that is not present in the inspected inventory.",
                teamId: role.teamId,
                teamRoleId: role.id,
            });
        }
    }

    const validMemberships: AuthorizationProductionMembershipSnapshot[] = [];
    const seenMemberships = new Set<string>();
    for (const membership of snapshot.memberships) {
        const membershipKey = `${membership.teamId}\u0000${membership.userId}`;
        if (seenMemberships.has(membershipKey)) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "CONFIGURATION",
                source: "MEMBERSHIP",
                code: "MALFORMED_AUTHORIZATION_CONFIGURATION",
                reason: "Persisted authorization inventory contains duplicate TeamMembership rows.",
                teamId: membership.teamId,
                userId: membership.userId,
                ...(membership.teamRoleId === null
                    ? {}
                    : { teamRoleId: membership.teamRoleId }),
            });
        }
        seenMemberships.add(membershipKey);

        const team = teams.get(membership.teamId);
        const user = users.get(membership.userId);
        if (team === undefined) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "CONFIGURATION",
                source: "MEMBERSHIP",
                code: "MISSING_TEAM_REFERENCE",
                reason: "TeamMembership references a Team row that is not present in the inspected inventory.",
                teamId: membership.teamId,
                userId: membership.userId,
            });
        }
        if (user === undefined) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "LIFECYCLE",
                source: "MEMBERSHIP",
                code: "MISSING_USER_REFERENCE",
                reason: "TeamMembership references a User row that is not present in the inspected inventory.",
                teamId: membership.teamId,
                userId: membership.userId,
            });
        } else {
            checkUserLifecycle(user, employees, findings, emitted);
        }

        let roleIsValid = membership.teamRoleId === null;
        if (membership.teamRoleId !== null) {
            const role = roles.get(membership.teamRoleId);
            roleIsValid = role !== undefined && role.teamId === membership.teamId;
            if (role === undefined) {
                addFinding(findings, {
                    severity: "BLOCKER",
                    kind: "CONFIGURATION",
                    source: "MEMBERSHIP",
                    code: "MISSING_TEAM_ROLE_REFERENCE",
                    reason: "TeamMembership references a TeamRole row that is not present in the inspected inventory.",
                    teamId: membership.teamId,
                    teamRoleId: membership.teamRoleId,
                    userId: membership.userId,
                });
            } else if (role.teamId !== membership.teamId) {
                addFinding(findings, {
                    severity: "BLOCKER",
                    kind: "CONFIGURATION",
                    source: "MEMBERSHIP",
                    code: "TEAM_ROLE_MEMBERSHIP_MISMATCH",
                    reason: "TeamMembership TeamRole does not belong to the same Team.",
                    teamId: membership.teamId,
                    teamRoleId: membership.teamRoleId,
                    userId: membership.userId,
                });
            }
            if (role !== undefined && !role.isActive) {
                addInactiveTeamRoleFinding(
                    findings,
                    role.teamId,
                    role.id,
                    "MEMBERSHIP",
                    undefined,
                    undefined,
                );
            }
        }
        if (team !== undefined && !team.isActive) {
            addInactiveTeamFinding(findings, team.id, "MEMBERSHIP");
        }
        if (roleIsValid) validMemberships.push(membership);
    }

    const catalogByKey = getCatalogByKey(findings);
    const authority = new Map<string, ConfiguredAuthorityEntry>();

    for (const grant of snapshot.teamGrants) {
        const team = teams.get(grant.teamId);
        const definition = getCapabilityDefinition(
            grant.capabilityKey,
            grant.scope,
            "TEAM_GRANT",
            { teamId: grant.teamId },
            findings,
        );
        if (team === undefined) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "CONFIGURATION",
                source: "TEAM_GRANT",
                code: "MISSING_TEAM_REFERENCE",
                reason: "Team capability grant references a Team row that is not present in the inspected inventory.",
                teamId: grant.teamId,
                capabilityKey: grant.capabilityKey,
                scope: grant.scope,
            });
        } else {
            if (!team.isActive) {
                addInactiveTeamFinding(
                    findings,
                    team.id,
                    "TEAM_GRANT",
                    grant.capabilityKey,
                    grant.scope,
                );
            }
            if (definition !== null) {
                const administration = catalogByKey.get(definition.key);
                if (administration !== undefined && !administration.administrativelyGrantable) {
                    addNonGrantableFinding(
                        findings,
                        administration,
                        { ...grant, source: "TEAM" },
                        team.isActive,
                    );
                }
            }
        }

        if (
            definition !== null
            && team !== undefined
            && team.isActive
        ) {
            for (const membership of validMemberships) {
                if (
                    membership.teamId === team.id
                    && isEffectiveMembership(membership, teams, roles, users)
                ) {
                    const user = users.get(membership.userId);
                    if (user !== undefined && isEffectiveConfiguredUser(user)) {
                        addConfiguredAuthority(
                            authority,
                            { ...grant, source: "TEAM" },
                            user.id,
                            `TEAM:${team.id}`,
                        );
                    }
                }
            }
        }
    }

    for (const grant of snapshot.teamRoleGrants) {
        const role = roles.get(grant.teamRoleId);
        const definition = getCapabilityDefinition(
            grant.capabilityKey,
            grant.scope,
            "TEAM_ROLE_GRANT",
            {
                teamId: grant.teamId ?? undefined,
                teamRoleId: grant.teamRoleId,
            },
            findings,
        );
        if (role === undefined) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "CONFIGURATION",
                source: "TEAM_ROLE_GRANT",
                code: "MISSING_TEAM_ROLE_REFERENCE",
                reason: "TeamRole capability grant references a TeamRole row that is not present in the inspected inventory.",
                teamId: grant.teamId ?? undefined,
                teamRoleId: grant.teamRoleId,
                capabilityKey: grant.capabilityKey,
                scope: grant.scope,
            });
        } else {
            if (grant.teamId !== role.teamId) {
                addFinding(findings, {
                    severity: "BLOCKER",
                    kind: "CONFIGURATION",
                    source: "TEAM_ROLE_GRANT",
                    code: "TEAM_ROLE_GRANT_ORIGIN_MISMATCH",
                    reason: "TeamRole capability grant origin does not match the Team owned by the TeamRole.",
                    teamId: grant.teamId ?? undefined,
                    teamRoleId: grant.teamRoleId,
                    capabilityKey: grant.capabilityKey,
                    scope: grant.scope,
                });
            }
            const team = teams.get(role.teamId);
            if (team !== undefined && !team.isActive) {
                addInactiveTeamFinding(
                    findings,
                    team.id,
                    "TEAM_ROLE_GRANT",
                    grant.capabilityKey,
                    grant.scope,
                );
            }
            if (!role.isActive) {
                addInactiveTeamRoleFinding(
                    findings,
                    role.teamId,
                    role.id,
                    "TEAM_ROLE_GRANT",
                    grant.capabilityKey,
                    grant.scope,
                );
            }
            if (definition !== null) {
                const administration = catalogByKey.get(definition.key);
                if (administration !== undefined && !administration.administrativelyGrantable) {
                    addNonGrantableFinding(
                        findings,
                        administration,
                        {
                            ...grant,
                            source: "TEAM_ROLE",
                            teamId: role.teamId,
                        },
                        role.isActive && team?.isActive === true,
                    );
                }
            }
        }

        if (definition !== null && role !== undefined && role.isActive) {
            for (const membership of validMemberships) {
                if (
                    membership.teamRoleId === role.id
                    && membership.teamId === role.teamId
                    && isEffectiveMembership(membership, teams, roles, users)
                ) {
                    const user = users.get(membership.userId);
                    const team = teams.get(role.teamId);
                    if (user !== undefined && team?.isActive === true && isEffectiveConfiguredUser(user)) {
                        addConfiguredAuthority(
                            authority,
                            {
                                ...grant,
                                source: "TEAM_ROLE",
                                teamId: role.teamId,
                            },
                            user.id,
                            `TEAM_ROLE:${role.id}`,
                        );
                    }
                }
            }
        }
    }

    for (const grant of snapshot.userGrants) {
        const user = users.get(grant.userId);
        const definition = getCapabilityDefinition(
            grant.capabilityKey,
            grant.scope,
            "USER_GRANT",
            { userId: grant.userId },
            findings,
        );
        if (user === undefined) {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "LIFECYCLE",
                source: "USER_GRANT",
                code: "MISSING_USER_REFERENCE",
                reason: "User capability grant references a User row that is not present in the inspected inventory.",
                userId: grant.userId,
                capabilityKey: grant.capabilityKey,
                scope: grant.scope,
            });
            continue;
        }
        checkUserLifecycle(user, employees, findings, emitted);
        if (grant.scope === "TEAM") {
            addFinding(findings, {
                severity: "BLOCKER",
                kind: "CONFIGURATION",
                source: "USER_GRANT",
                code: "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN",
                reason: "A direct User grant cannot carry TEAM scope without an originating Team.",
                userId: grant.userId,
                capabilityKey: grant.capabilityKey,
                scope: grant.scope,
            });
        }
        if (definition !== null && user.role === "ADMIN" && grant.scope !== "TEAM") {
            addFinding(findings, {
                severity: "WARNING",
                kind: "OPERATIONAL",
                source: "USER_GRANT",
                code: "ADMIN_PERSISTED_GRANT_REDUNDANT",
                reason: "ADMIN authority comes from SYSTEM_ROLE / ADMIN; this persisted direct User grant is not used as ADMIN authority.",
                userId: grant.userId,
                capabilityKey: grant.capabilityKey,
                scope: grant.scope,
            });
        }
        if (definition !== null) {
            const administration = catalogByKey.get(definition.key);
            if (administration !== undefined && !administration.administrativelyGrantable) {
                addNonGrantableFinding(
                    findings,
                    administration,
                    { ...grant, source: "USER" },
                    isEffectiveConfiguredUser(user),
                );
            }
        }
        if (definition !== null && isEffectiveConfiguredUser(user) && grant.scope !== "TEAM") {
            addConfiguredAuthority(
                authority,
                { ...grant, source: "USER" },
                user.id,
                `USER:${user.id}`,
            );
        }
    }

    const redundantAuthorityCount = addRedundancyFindings(authority, findings);
    const migrationChecks = buildMigrationChecks(snapshot, findings);
    const sortedFindings = Object.freeze(
        [...findings].sort((left, right) =>
            compareStrings(findingSortKey(left), findingSortKey(right)),
        ),
    );
    const summary = buildSummary(snapshot, sortedFindings, redundantAuthorityCount);
    const status: AuthorizationProductionReadinessStatus = summary.blockerCount > 0
        ? "BLOCKED"
        : summary.warningCount > 0
            ? "WARNING"
            : "PASS";

    return Object.freeze({
        status,
        summary,
        migrationChecks,
        findings: sortedFindings,
    });
}

function emptySummary(): AuthorizationProductionInventorySummary {
    return Object.freeze({
        teamCount: 0,
        activeTeamCount: 0,
        inactiveTeamCount: 0,
        teamRoleCount: 0,
        activeTeamRoleCount: 0,
        inactiveTeamRoleCount: 0,
        membershipCount: 0,
        teamGrantCount: 0,
        teamRoleGrantCount: 0,
        directUserGrantCount: 0,
        grantsByCapability: Object.freeze([]),
        grantsBySourceAndScope: Object.freeze([]),
        redundantAuthorityCount: 0,
        invalidConfigurationCount: 0,
        warningCount: 0,
        blockerCount: 0,
    });
}

export function createAuthorizationProductionReadinessNotRunReport(
    reason: string,
): AuthorizationProductionReadinessEvaluation {
    return Object.freeze({
        status: "NOT_RUN" as const,
        summary: emptySummary(),
        migrationChecks: Object.freeze(
            AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS.map((migrationName) => ({
                migrationName,
                status: "NOT_RUN" as const,
            })),
        ),
        findings: Object.freeze([]),
        notRunReason: reason,
    });
}

function createInventoryReadFailureReport(): AuthorizationProductionReadinessEvaluation {
    const finding: AuthorizationProductionFinding = Object.freeze({
        severity: "BLOCKER",
        kind: "OPERATIONAL",
        source: "INVENTORY",
        code: "INVENTORY_READ_FAILED",
        reason: "The authorization inventory could not be read; no rollout decision is trusted.",
    });
    const summary = Object.freeze({
        ...emptySummary(),
        blockerCount: 1,
    });
    return Object.freeze({
        status: "BLOCKED" as const,
        summary,
        migrationChecks: Object.freeze(
            AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS.map((migrationName) => ({
                migrationName,
                status: "NOT_RUN" as const,
            })),
        ),
        findings: Object.freeze([finding]),
        failureCode: "INVENTORY_READ_FAILED" as const,
    });
}

export async function runAuthorizationProductionPreflight(
    repository: AuthorizationProductionReadinessRepository,
): Promise<AuthorizationProductionReadinessEvaluation> {
    try {
        return evaluateAuthorizationProductionReadiness(await repository.load());
    } catch {
        return createInventoryReadFailureReport();
    }
}

export function projectAuthorizationProductionReadinessReport(
    evaluation: AuthorizationProductionReadinessEvaluation,
    options: { readonly includeDetails?: boolean } = {},
): AuthorizationProductionReadinessReport {
    const counts = new Map<string, AuthorizationProductionFindingCount>();
    for (const finding of evaluation.findings) {
        const key = `${finding.severity}\u0000${finding.code}`;
        const current = counts.get(key);
        counts.set(key, {
            severity: finding.severity,
            code: finding.code,
            count: (current?.count ?? 0) + 1,
        });
    }
    const findingCounts = Object.freeze(
        [...counts.values()].sort((left, right) =>
            left.severity.localeCompare(right.severity)
            || left.code.localeCompare(right.code),
        ),
    );
    const report: AuthorizationProductionReadinessReport = {
        status: evaluation.status,
        summary: evaluation.summary,
        migrationChecks: evaluation.migrationChecks,
        findingCounts,
        ...(evaluation.failureCode === undefined
            ? {}
            : { failureCode: evaluation.failureCode }),
        ...(evaluation.notRunReason === undefined
            ? {}
            : { notRunReason: evaluation.notRunReason }),
        ...(options.includeDetails === true
            ? { findings: evaluation.findings }
            : {}),
    };
    return Object.freeze(report);
}

export function determineAuthorizationProductionReadinessExitCode(
    result: Pick<AuthorizationProductionReadinessEvaluation, "status">
        | Pick<AuthorizationProductionReadinessReport, "status">,
): number {
    return result.status === "BLOCKED" || result.status === "NOT_RUN" ? 1 : 0;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isSubstantiveReviewText(value: unknown): boolean {
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return normalized.length >= 8
        && !new Set([
            "acknowledged",
            "no action",
            "none",
            "n/a",
            "ok",
            "reviewed",
        ]).has(normalized);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null;
}

function isWarningFindingReference(
    value: unknown,
): value is AuthorizationProductionWarningFindingReference {
    if (!isRecord(value)) return false;
    const requiredFields = ["kind", "source", "code"] as const;
    if (requiredFields.some((field) => typeof value[field] !== "string")) {
        return false;
    }

    const optionalNumericFields = [
        "teamId",
        "teamRoleId",
        "userId",
        "employeeId",
    ] as const;
    if (optionalNumericFields.some((field) =>
        value[field] !== undefined && typeof value[field] !== "number",
    )) {
        return false;
    }

    const optionalStringFields = [
        "capabilityKey",
        "scope",
        "migrationName",
    ] as const;
    return !optionalStringFields.some((field) =>
        value[field] !== undefined && typeof value[field] !== "string",
    );
}

function isWarningReview(value: unknown): value is AuthorizationProductionWarningReview {
    if (!isRecord(value) || !isWarningFindingReference(value.finding)) {
        return false;
    }
    return isSubstantiveReviewText(value.disposition)
        && isSubstantiveReviewText(value.reviewedBy);
}

function findingIdentityKey(
    finding: AuthorizationProductionWarningFindingReference,
): string {
    return [
        finding.kind,
        finding.source,
        finding.code,
        finding.capabilityKey ?? "",
        finding.scope ?? "",
        finding.teamId ?? "",
        finding.teamRoleId ?? "",
        finding.userId ?? "",
        finding.employeeId ?? "",
        finding.migrationName ?? "",
    ].join("\u0000");
}

function validateCanaryWarningReviews(
    plan: AuthorizationProductionCanaryPlan,
    readiness: AuthorizationProductionReadinessEvaluation,
    issues: AuthorizationProductionCanaryIssue[],
): void {
    const warnings = readiness.findings.filter(
        (finding) => finding.severity === "WARNING",
    );
    const required = new Map<string, number>();
    for (const finding of warnings) {
        const key = findingIdentityKey(finding);
        required.set(key, (required.get(key) ?? 0) + 1);
    }

    const reviewed = new Map<string, number>();
    for (const review of plan.reviewedWarnings ?? []) {
        const validReview = isWarningReview(review);
        const key = validReview
            ? findingIdentityKey(review.finding)
            : "";
        if (!validReview || !required.has(key)) {
            addCanaryIssue(
                issues,
                "CANARY_WARNING_REVIEW_STALE",
                "Warning review is missing substantive reviewer/disposition data or does not match a current readiness warning.",
            );
            continue;
        }
        reviewed.set(key, (reviewed.get(key) ?? 0) + 1);
    }

    for (const [key, count] of required) {
        if ((reviewed.get(key) ?? 0) < count) {
            addCanaryIssue(
                issues,
                "CANARY_WARNING_REVIEW_REQUIRED",
                "Every current readiness WARNING requires a matching operator review and disposition before canary mutation.",
            );
        }
    }
}

function buildCanaryResolutionData(
    snapshot: AuthorizationProductionInventorySnapshot,
    userId: number,
    capabilityKey?: string,
): AuthorizationResolutionData {
    const memberships = snapshot.memberships
        .filter((membership) => membership.userId === userId)
        .map((membership) => {
            const team = snapshot.teams.find((candidate) =>
                candidate.id === membership.teamId,
            );
            const role = membership.teamRoleId === null
                ? null
                : snapshot.teamRoles.find((candidate) =>
                    candidate.id === membership.teamRoleId,
                ) ?? null;
            return {
                userId,
                teamId: membership.teamId,
                isTeamActive: team?.isActive === true,
                teamRoleId: membership.teamRoleId,
                teamRole: role === null
                    ? null
                    : { id: role.id, isActive: role.isActive },
                teamGrants: snapshot.teamGrants.filter((grant) =>
                    grant.teamId === membership.teamId
                    && (
                        capabilityKey === undefined
                        || grant.capabilityKey === capabilityKey
                    ),
                ),
            };
        });

    return {
        userGrants: snapshot.userGrants.filter((grant) =>
            grant.userId === userId
            && (
                capabilityKey === undefined
                || grant.capabilityKey === capabilityKey
            ),
        ),
        memberships,
        teamRoleGrants: snapshot.teamRoleGrants
            .filter((grant) =>
                (
                    capabilityKey === undefined
                    || grant.capabilityKey === capabilityKey
                )
                && grant.teamId !== null,
            )
            .flatMap((grant) => grant.teamId === null
                ? []
                : [{
                    teamRoleId: grant.teamRoleId,
                    teamId: grant.teamId,
                    capabilityKey: grant.capabilityKey,
                    scope: grant.scope,
                }]),
    };
}

function createCanaryResolver(
    snapshot: AuthorizationProductionInventorySnapshot,
): ReturnType<typeof createAuthorizationResolver> {
    const repository: AuthorizationResolutionRepository = {
        async load({ userId, capabilityKey }): Promise<AuthorizationResolutionData> {
            return buildCanaryResolutionData(snapshot, userId, capabilityKey);
        },
        async loadMany({ userId }): Promise<AuthorizationResolutionData> {
            return buildCanaryResolutionData(snapshot, userId);
        },
    };
    return createAuthorizationResolver({ repository });
}

function appendCanaryGrant(
    snapshot: AuthorizationProductionInventorySnapshot,
    plan: AuthorizationProductionCanaryPlan,
): AuthorizationProductionInventorySnapshot {
    if (plan.source === "TEAM") {
        return {
            ...snapshot,
            teamGrants: [
                ...snapshot.teamGrants,
                {
                    teamId: plan.targetId,
                    capabilityKey: plan.capabilityKey,
                    scope: plan.scope,
                },
            ],
        };
    }
    if (plan.source === "USER") {
        return {
            ...snapshot,
            userGrants: [
                ...snapshot.userGrants,
                {
                    userId: plan.targetId,
                    capabilityKey: plan.capabilityKey,
                    scope: plan.scope,
                },
            ],
        };
    }

    const role = snapshot.teamRoles.find((candidate) =>
        candidate.id === plan.targetId,
    );
    if (role === undefined) return snapshot;
    return {
        ...snapshot,
        teamRoleGrants: [
            ...snapshot.teamRoleGrants,
            {
                teamRoleId: role.id,
                teamId: role.teamId,
                capabilityKey: plan.capabilityKey,
                scope: plan.scope,
            },
        ],
    };
}

function buildCanaryActor(
    user: AuthorizationProductionUserSnapshot,
    channel: AuthorizationChannel,
): AuthorizationActor {
    return {
        userId: user.id,
        employeeId: user.employeeId,
        systemRole: user.role,
        channel,
    };
}

function hasCanarySourceGrant(
    decision: AuthorizationDecision | null,
    plan: AuthorizationProductionCanaryPlan,
): boolean {
    if (decision === null) return false;
    return decision.grants.some((grant) => {
        if (plan.source === "TEAM") {
            return grant.source.type === "TEAM"
                && grant.source.teamId === plan.targetId
                && grant.scope === plan.scope;
        }
        if (plan.source === "TEAM_ROLE") {
            return grant.source.type === "TEAM_ROLE"
                && grant.source.teamRoleId === plan.targetId
                && grant.scope === plan.scope;
        }
        return grant.source.type === "USER"
            && grant.source.userId === plan.targetId
            && grant.scope === plan.scope;
    });
}

async function loadCanaryEffectiveAccess(
    dependencies: AuthorizationProductionCanaryValidationDependencies,
    snapshot: AuthorizationProductionInventorySnapshot,
    actor: AuthorizationActor,
    plan: AuthorizationProductionCanaryPlan,
): Promise<AuthorizationAdministrationEffectiveAccessInspection> {
    const resolver = createCanaryResolver(snapshot);
    const capabilityKeys = CAPABILITY_REGISTRY.definitions.map(
        (definition) => definition.key,
    );
    const dashboardDecisions = await resolver.resolveMany(
        Object.freeze({
            ...actor,
            channel: "DASHBOARD" as const,
        }),
        capabilityKeys,
    );
    const inspections = await dependencies.effectiveAccessProvider.inspect({
        actor,
        dashboardDecisions,
        resolver,
    });
    const matches = inspections.filter((inspection) =>
        inspection.capability === plan.capabilityKey
        && inspection.context.key === plan.contextKey
        && inspection.context.channel === plan.channel,
    );
    if (matches.length !== 1 || matches[0] === undefined) {
        throw new Error(
            "Canary effective-access context is not uniquely identifiable: "
            + plan.capabilityKey
            + "/"
            + plan.channel
            + "/"
            + plan.contextKey,
        );
    }
    return matches[0];
}

function areScopesEqual(
    left: readonly AuthorizationScope[],
    right: readonly AuthorizationScope[],
): boolean {
    return left.length === right.length
        && left.every((scope, index) => scope === right[index]);
}

async function validateCanaryEffectiveAuthority(
    plan: AuthorizationProductionCanaryPlan,
    snapshot: AuthorizationProductionInventorySnapshot,
    users: ReadonlyMap<number, AuthorizationProductionUserSnapshot>,
    employees: ReadonlyMap<number, AuthorizationProductionEmployeeSnapshot>,
    dependencies: AuthorizationProductionCanaryValidationDependencies,
    issues: AuthorizationProductionCanaryIssue[],
): Promise<void> {
    const evidence = plan.effectiveAccessBefore;
    const observer = users.get(plan.observerUserId);
    const definition = CAPABILITY_REGISTRY.get(plan.capabilityKey);
    if (
        evidence === undefined
        || observer === undefined
        || definition === undefined
        || evidence.observerUserId !== plan.observerUserId
        || evidence.capabilityKey !== plan.capabilityKey
        || evidence.channel !== plan.channel
        || !isNonEmptyString(plan.contextKey)
        || !isNonEmptyString(evidence.contextKey)
        || evidence.contextKey !== plan.contextKey
    ) {
        addCanaryIssue(
            issues,
            "CANARY_EFFECTIVE_ACCESS_EVIDENCE_INVALID",
            "Canary effective-access evidence must identify the same eligible observer, capability, channel, and context as the canary plan.",
        );
        return;
    }

    if (plan.source === "USER" && plan.observerUserId !== plan.targetId) {
        addCanaryIssue(
            issues,
            "CANARY_EFFECTIVE_ACCESS_EVIDENCE_INVALID",
            "A direct User canary must use the granted User as its runtime observer.",
        );
        return;
    }

    if (
        plan.source !== "USER"
        && !isCanaryObserverEligible(observer, employees)
    ) {
        addCanaryIssue(
            issues,
            "CANARY_TARGET_NOT_WORKFORCE_ELIGIBLE",
            "The selected Team or TeamRole canary observer cannot establish the normal active workforce session: an active linked Employee is required.",
        );
        return;
    }

    const sourceMembership = plan.source === "TEAM"
        ? snapshot.memberships.some((membership) =>
            membership.userId === plan.observerUserId
            && membership.teamId === plan.targetId,
        )
        : plan.source === "TEAM_ROLE"
            ? snapshot.memberships.some((membership) =>
                membership.userId === plan.observerUserId
                && membership.teamRoleId === plan.targetId,
            )
            : true;
    if (plan.source !== "USER" && !sourceMembership) {
        addCanaryIssue(
            issues,
            "CANARY_EFFECTIVE_ACCESS_EVIDENCE_INVALID",
            "Canary effective-access evidence observer is not a member of the selected Team or TeamRole target.",
        );
        return;
    }

    try {
        const supportedScopes = new Set(definition.scopes);
        const expectedDefaultScopes = normalizeAuthorizationScopes(
            evidence.defaultScopes,
        );
        const expectedEffectiveScopes = normalizeAuthorizationScopes(
            evidence.effectiveScopes,
        );
        if (
            !areScopesEqual(expectedDefaultScopes, evidence.defaultScopes)
            || !areScopesEqual(expectedEffectiveScopes, evidence.effectiveScopes)
            || expectedDefaultScopes.some((scope) => !supportedScopes.has(scope))
            || expectedEffectiveScopes.some((scope) => !supportedScopes.has(scope))
            || (
                evidence.state === "AVAILABLE"
                && expectedEffectiveScopes.length === 0
            )
            || (
                evidence.state !== "AVAILABLE"
                && expectedEffectiveScopes.length > 0
            )
        ) {
            addCanaryIssue(
                issues,
                "CANARY_EFFECTIVE_ACCESS_EVIDENCE_INVALID",
                "Canary effective-access evidence is not a normalized, registry-supported read-model state.",
            );
            return;
        }

        const actor = buildCanaryActor(observer, plan.channel);
        const beforeInspection = await loadCanaryEffectiveAccess(
            dependencies,
            snapshot,
            actor,
            plan,
        );
        const actualDefaultScopes = normalizeAuthorizationScopes(
            beforeInspection.defaultScopes,
        );
        const actualEffectiveScopes = normalizeAuthorizationScopes(
            beforeInspection.effectiveScopes,
        );
        if (
            beforeInspection.state !== evidence.state
            || !areScopesEqual(actualDefaultScopes, expectedDefaultScopes)
            || !areScopesEqual(actualEffectiveScopes, expectedEffectiveScopes)
        ) {
            addCanaryIssue(
                issues,
                "CANARY_EFFECTIVE_ACCESS_EVIDENCE_INVALID",
                "Canary effective-access evidence does not match the authoritative domain effective-access provider for the selected context.",
            );
            return;
        }

        const afterSnapshot = appendCanaryGrant(snapshot, plan);
        const afterInspection = await loadCanaryEffectiveAccess(
            dependencies,
            afterSnapshot,
            actor,
            plan,
        );
        if (!hasCanarySourceGrant(afterInspection.configuredDecision, plan)) {
            addCanaryIssue(
                issues,
                "CANARY_EFFECTIVE_ACCESS_EVIDENCE_INVALID",
                "The selected source does not appear in the authoritative resolver result for the observer after the proposed grant.",
            );
            return;
        }

        const afterEffectiveScopes = normalizeAuthorizationScopes(
            afterInspection.effectiveScopes,
        );
        const addsEffectiveAuthority = !expectedEffectiveScopes.includes("ALL")
            && afterEffectiveScopes.some((scope) =>
                !expectedEffectiveScopes.includes(scope),
            );
        if (!addsEffectiveAuthority) {
            addCanaryIssue(
                issues,
                "CANARY_NO_EFFECTIVE_AUTHORITY_CHANGE",
                "The proposed grant adds no effective scope beyond the authoritative domain effective-access state already observed for the canary observer and context.",
            );
        }
    } catch {
        addCanaryIssue(
            issues,
            "CANARY_EFFECTIVE_ACCESS_EVIDENCE_INVALID",
            "Canary effective-access evidence could not be reconciled with the authoritative domain effective-access provider.",
        );
    }
}

function addCanaryIssue(
    issues: AuthorizationProductionCanaryIssue[],
    code: AuthorizationProductionCanaryIssueCode,
    reason: string,
): void {
    issues.push(Object.freeze({ code, reason }));
}

function canaryTargetHasActiveMember(
    teamId: number,
    teamRoleId: number | null,
    snapshot: AuthorizationProductionInventorySnapshot,
    teams: ReadonlyMap<number, AuthorizationProductionTeamSnapshot>,
    roles: ReadonlyMap<number, AuthorizationProductionTeamRoleSnapshot>,
    users: ReadonlyMap<number, AuthorizationProductionUserSnapshot>,
    employees: ReadonlyMap<number, AuthorizationProductionEmployeeSnapshot>,
): boolean {
    return snapshot.memberships.some((membership) =>
        membership.teamId === teamId
        && (teamRoleId === null || membership.teamRoleId === teamRoleId)
        && isCanaryObserverEligible(
            users.get(membership.userId),
            employees,
        )
        && isEffectiveMembership(membership, teams, roles, users),
    );
}

function isCanaryObserverEligible(
    user: AuthorizationProductionUserSnapshot | undefined,
    employees: ReadonlyMap<number, AuthorizationProductionEmployeeSnapshot>,
): boolean {
    if (user === undefined || !isActiveUser(user)) return false;

    // ADMIN account-only compatibility paths do not require workforce identity.
    if (user.role === "ADMIN") return true;
    if (user.employeeId === null) return false;

    const employee = employees.get(user.employeeId);
    return employee !== undefined && isActiveEmployee(employee);
}

export async function validateAuthorizationProductionCanaryPlan(
    plan: AuthorizationProductionCanaryPlan,
    snapshot: AuthorizationProductionInventorySnapshot,
    dependencies: AuthorizationProductionCanaryValidationDependencies,
): Promise<AuthorizationProductionCanaryValidation> {
    const issues: AuthorizationProductionCanaryIssue[] = [];
    const readiness = evaluateAuthorizationProductionReadiness(snapshot);
    if (readiness.status === "BLOCKED") {
        addCanaryIssue(
            issues,
            "CANARY_READINESS_BLOCKED",
            "The persisted authorization inventory must have zero BLOCKED findings before a canary plan is executed.",
        );
    }
    validateCanaryWarningReviews(plan, readiness, issues);

    const requiredFields: readonly [string, unknown][] = [
        ["businessReason", plan.businessReason],
        ["expectedAuthorityBefore", plan.expectedAuthorityBefore],
        ["expectedAuthorityAfter", plan.expectedAuthorityAfter],
        ["expectedResourceDomainLimitation", plan.expectedResourceDomainLimitation],
        ["operator", plan.operator],
        ["plannedTimeWindow", plan.plannedTimeWindow],
        ["rollbackAction", plan.rollbackAction],
        ["contextKey", plan.contextKey],
    ];
    for (const [field, value] of requiredFields) {
        if (!isNonEmptyString(value)) {
            addCanaryIssue(
                issues,
                "CANARY_REQUIRED_FIELD",
                `Canary plan field ${field} is required.`,
            );
        }
    }
    if (!isValidIdentifier(plan.targetId)) {
        addCanaryIssue(
            issues,
            "INVALID_IDENTIFIER",
            "Canary target identifier must be a positive safe integer.",
        );
    }

    const definition = CAPABILITY_REGISTRY.get(plan.capabilityKey);
    if (definition === undefined) {
        addCanaryIssue(
            issues,
            "UNKNOWN_PERSISTED_CAPABILITY",
            "Canary capability must exist in the code-owned Capability Registry.",
        );
    } else {
        if (!definition.scopes.some((scope) => scope === plan.scope)) {
            addCanaryIssue(
                issues,
                "UNSUPPORTED_PERSISTED_SCOPE",
                "Canary scope is not supported by the selected registered capability.",
            );
        }
        if (!definition.channels.some((channel) => channel === plan.channel)) {
            addCanaryIssue(
                issues,
                "CANARY_CHANNEL_UNSUPPORTED",
                "The selected execution channel is not supported by the registered capability.",
            );
        }
        try {
            const administration = buildCapabilityAdministrationCatalog().find(
                (capability) => capability.key === definition.key,
            );
            if (administration === undefined || !administration.administrativelyGrantable) {
                addCanaryIssue(
                    issues,
                    "NON_ADMINISTRATIVELY_GRANTABLE",
                    "The selected capability is not administratively grantable through the existing Authorization Administration boundary.",
                );
            }
        } catch {
            addCanaryIssue(
                issues,
                "REGISTRY_ADMINISTRATION_METADATA_INVALID",
                "Capability administration metadata cannot be built from the code-owned registry.",
            );
        }
    }

    if (plan.source === "USER" && plan.scope === "TEAM") {
        addCanaryIssue(
            issues,
            "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN",
            "A direct User canary grant cannot use TEAM scope.",
        );
    }

    const teams = new Map(snapshot.teams.map((team) => [team.id, team] as const));
    const roles = new Map(snapshot.teamRoles.map((role) => [role.id, role] as const));
    const users = new Map(snapshot.users.map((user) => [user.id, user] as const));
    const employees = new Map(snapshot.employees.map((employee) => [employee.id, employee] as const));
    if (plan.source === "TEAM") {
        const team = teams.get(plan.targetId);
        if (team === undefined) {
            addCanaryIssue(issues, "CANARY_TARGET_NOT_FOUND", "Canary Team target is not present.");
        } else if (!team.isActive) {
            addCanaryIssue(issues, "CANARY_TARGET_INACTIVE", "Canary Team target is inactive.");
        } else if (!canaryTargetHasActiveMember(plan.targetId, null, snapshot, teams, roles, users, employees)) {
            addCanaryIssue(issues, "CANARY_NO_ACTIVE_MEMBER", "Canary Team has no active member who can observe the grant.");
        }
    } else if (plan.source === "TEAM_ROLE") {
        const role = roles.get(plan.targetId);
        if (role === undefined) {
            addCanaryIssue(issues, "CANARY_TARGET_NOT_FOUND", "Canary TeamRole target is not present.");
        } else if (!role.isActive || teams.get(role.teamId)?.isActive !== true) {
            addCanaryIssue(issues, "CANARY_TARGET_INACTIVE", "Canary TeamRole or its Team is inactive.");
        } else if (!canaryTargetHasActiveMember(role.teamId, role.id, snapshot, teams, roles, users, employees)) {
            addCanaryIssue(issues, "CANARY_NO_ACTIVE_MEMBER", "Canary TeamRole has no active member who can observe the grant.");
        }
    } else if (plan.source === "USER") {
        const user = users.get(plan.targetId);
        if (user === undefined) {
            addCanaryIssue(issues, "CANARY_TARGET_NOT_FOUND", "Canary User target is not present.");
        } else if (!isActiveUser(user)) {
            addCanaryIssue(issues, "CANARY_TARGET_INACTIVE", "Canary User target is inactive or deleted.");
        } else if (user.role === "ADMIN") {
            addCanaryIssue(issues, "ADMIN_PERSISTED_GRANT_REDUNDANT", "A direct User canary grant does not change ADMIN SYSTEM_ROLE authority.");
        } else if (!isCanaryObserverEligible(user, employees)) {
            addCanaryIssue(issues, "CANARY_TARGET_NOT_WORKFORCE_ELIGIBLE", "Canary User cannot establish the normal active workforce session: an active linked Employee is required.");
        }
    }

    const exactGrantExists = plan.source === "TEAM"
        ? snapshot.teamGrants.some((grant) =>
            grant.teamId === plan.targetId
            && grant.capabilityKey === plan.capabilityKey
            && grant.scope === plan.scope,
        )
        : plan.source === "TEAM_ROLE"
            ? snapshot.teamRoleGrants.some((grant) =>
                grant.teamRoleId === plan.targetId
                && grant.capabilityKey === plan.capabilityKey
                && grant.scope === plan.scope,
            )
            : snapshot.userGrants.some((grant) =>
                grant.userId === plan.targetId
                && grant.capabilityKey === plan.capabilityKey
                && grant.scope === plan.scope,
            );
    if (exactGrantExists) {
        addCanaryIssue(
            issues,
            "CANARY_GRANT_ALREADY_EXISTS",
            "The exact canary grant already exists; no new audited grant change is available to verify.",
        );
    }
    await validateCanaryEffectiveAuthority(
        plan,
        snapshot,
        users,
        employees,
        dependencies,
        issues,
    );

    return Object.freeze({
        status: issues.length === 0 ? "PASS" as const : "BLOCKED" as const,
        issues: Object.freeze(issues),
    });
}
