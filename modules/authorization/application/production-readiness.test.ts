import { describe, expect, it } from "vitest";

import {
    AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS,
    AUTHORIZATION_PRODUCTION_AUTHORITY_MODEL,
    AUTHORIZATION_PRODUCTION_AUTHORITY_MODEL_NOTICE,
    determineAuthorizationProductionReadinessExitCode,
    evaluateAuthorizationProductionReadiness,
    projectAuthorizationProductionReadinessReport,
    runAuthorizationProductionPreflight,
    validateAuthorizationProductionCanaryPlan as validateProductionCanaryPlan,
    type AuthorizationProductionCanaryValidationDependencies,
    type AuthorizationProductionInventorySnapshot,
    type AuthorizationProductionCanaryPlan,
} from "./production-readiness";
import { CAPABILITY_REGISTRY } from "../registry";
import { buildCapabilityAdministrationCatalog } from "./administration-catalog";
import { createAuthorizationResolver } from "./resolver";
import {
    authorizationAdministrationEffectiveAccessProvider,
} from "@/app/api/authorization/administration/_lib/effective-access";

const appliedMigrations = AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS.map(
    (migrationName) => ({
        migrationName,
        finishedAt: new Date("2026-09-18T00:00:00.000Z"),
        rolledBackAt: null,
        appliedStepsCount: 1,
    }),
);

function createSnapshot(
    overrides: Partial<AuthorizationProductionInventorySnapshot> = {},
): AuthorizationProductionInventorySnapshot {
    return {
        teams: [],
        teamRoles: [],
        memberships: [],
        teamGrants: [],
        teamRoleGrants: [],
        userGrants: [],
        users: [],
        employees: [],
        migrations: appliedMigrations,
        ...overrides,
    };
}

function createValidCanaryPlan(
    overrides: Partial<AuthorizationProductionCanaryPlan> = {},
): AuthorizationProductionCanaryPlan {
    return {
        source: "USER",
        targetId: 10,
        observerUserId: 10,
        capabilityKey: "employee.create",
        scope: "ALL",
        channel: "DASHBOARD",
        contextKey: "dashboard",
        effectiveAccessBefore: {
            observerUserId: 10,
            capabilityKey: "employee.create",
            channel: "DASHBOARD",
            contextKey: "dashboard",
            state: "UNAVAILABLE",
            defaultScopes: [],
            effectiveScopes: [],
        },
        reviewedWarnings: [],
        businessReason: "อนุมัติคำขอที่ได้รับมอบหมายตามหน้าที่งาน",
        expectedAuthorityBefore: "ไม่มี configured grant",
        expectedAuthorityAfter: "USER / employee.create / ALL",
        expectedResourceDomainLimitation: "เฉพาะขอบเขตทรัพยากรของ Employee ที่ endpoint อนุญาต",
        operator: "operator@example.invalid",
        plannedTimeWindow: "2026-09-18 21:00-21:15 Asia/Bangkok",
        rollbackAction: "ลบ grant USER 10 / employee.create / ALL ผ่าน Administration",
        ...overrides,
    };
}

async function validateAuthorizationProductionCanaryPlan(
    plan: AuthorizationProductionCanaryPlan,
    snapshot: AuthorizationProductionInventorySnapshot,
    effectiveAccessProvider: AuthorizationProductionCanaryValidationDependencies["effectiveAccessProvider"] = authorizationAdministrationEffectiveAccessProvider,
) {
    return validateProductionCanaryPlan(
        plan,
        snapshot,
        { effectiveAccessProvider },
    );
}

describe("authorization production readiness", () => {
    it("passes for a clean empty configuration with applied migration evidence", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot());

        expect(result.authorityModel).toBe(AUTHORIZATION_PRODUCTION_AUTHORITY_MODEL);
        expect(result.status).toBe("PASS");
        expect(result.summary).toMatchObject({
            teamCount: 0,
            activeTeamCount: 0,
            teamRoleCount: 0,
            membershipCount: 0,
            teamGrantCount: 0,
            teamRoleGrantCount: 0,
            directUserGrantCount: 0,
            effectiveConfiguredAuthorityCount: 0,
            invalidConfigurationCount: 0,
            warningCount: 0,
            blockerCount: 0,
        });
        expect(result.migrationChecks).toEqual(
            AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS.map((migrationName) => ({
                migrationName,
                status: "APPLIED",
            })),
        );
        expect(result.findings).toHaveLength(0);
    });

    it("treats completed migrations with zero applied steps as applied", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            migrations: appliedMigrations.map((migration) => ({
                ...migration,
                appliedStepsCount: 0,
            })),
        }));

        expect(result.migrationChecks).toEqual(
            AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS.map((migrationName) => ({
                migrationName,
                status: "APPLIED",
            })),
        );
        expect(result.findings).not.toContainEqual(expect.objectContaining({
            code: "REQUIRED_MIGRATION_NOT_APPLIED",
        }));
    });

    it.each([
        {
            name: "unfinished",
            migration: {
                finishedAt: null,
                rolledBackAt: null,
                appliedStepsCount: 0,
            },
        },
        {
            name: "rolled back",
            migration: {
                finishedAt: new Date("2026-09-18T00:00:00.000Z"),
                rolledBackAt: new Date("2026-09-18T00:01:00.000Z"),
                appliedStepsCount: 1,
            },
        },
    ])("keeps $name migrations blocked", ({ migration }) => {
        const migrationName = AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS[0];
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            migrations: appliedMigrations.map((appliedMigration) =>
                appliedMigration.migrationName === migrationName
                    ? { ...appliedMigration, ...migration }
                    : appliedMigration,
            ),
        }));

        expect(result.migrationChecks).toContainEqual({
            migrationName,
            status: "INCOMPLETE",
        });
        expect(result.findings).toContainEqual(expect.objectContaining({
            code: "REQUIRED_MIGRATION_NOT_APPLIED",
            migrationName,
        }));
    });

    it("accepts a valid Team grant", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [{ id: 1, isActive: true }],
            memberships: [{ teamId: 1, userId: 10, teamRoleId: null }],
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
            teamGrants: [{
                teamId: 1,
                capabilityKey: "employee.create",
                scope: "ALL",
            }],
        }));

        expect(result.status).toBe("PASS");
        expect(result.summary.grantsByCapability).toEqual([
            { capabilityKey: "employee.create", count: 1 },
        ]);
    });

    it("accepts a valid TeamRole grant with same-Team membership", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [{ id: 1, isActive: true }],
            teamRoles: [{ id: 20, teamId: 1, isActive: true }],
            memberships: [{ teamId: 1, userId: 10, teamRoleId: 20 }],
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
            teamRoleGrants: [{
                teamRoleId: 20,
                teamId: 1,
                capabilityKey: "employee.create",
                scope: "ALL",
            }],
        }));

        expect(result.status).toBe("PASS");
        expect(result.summary.grantsBySourceAndScope).toEqual([
            { source: "TEAM_ROLE", scope: "ALL", count: 1 },
        ]);
    });

    it.each(["USER", "ADMIN"] as const)(
        "reconciles %s Team membership and Team grant as configured authority",
        (role) => {
            const result = evaluateAuthorizationProductionReadiness(createSnapshot({
                teams: [{ id: 1, isActive: true }],
                memberships: [{ teamId: 1, userId: 10, teamRoleId: null }],
                users: [{ id: 10, role, isActive: true, deletedAt: null, employeeId: null }],
                teamGrants: [{
                    teamId: 1,
                    capabilityKey: "employee.create",
                    scope: "ALL",
                }],
            }));

            expect(result.status).toBe("PASS");
            expect(result.summary.effectiveConfiguredAuthorityCount).toBe(1);
        },
    );

    it.each(["USER", "ADMIN"] as const)(
        "reconciles %s TeamRole membership and TeamRole grant as configured authority",
        (role) => {
            const result = evaluateAuthorizationProductionReadiness(createSnapshot({
                teams: [{ id: 1, isActive: true }],
                teamRoles: [{ id: 20, teamId: 1, isActive: true }],
                memberships: [{ teamId: 1, userId: 10, teamRoleId: 20 }],
                users: [{ id: 10, role, isActive: true, deletedAt: null, employeeId: null }],
                teamRoleGrants: [{
                    teamRoleId: 20,
                    teamId: 1,
                    capabilityKey: "employee.create",
                    scope: "ALL",
                }],
            }));

            expect(result.status).toBe("PASS");
            expect(result.summary.effectiveConfiguredAuthorityCount).toBe(1);
        },
    );

    it.each(["USER", "ADMIN"] as const)(
        "detects duplicate configured authority across Team, TeamRole, and User sources for %s",
        (role) => {
            const result = evaluateAuthorizationProductionReadiness(createSnapshot({
                teams: [{ id: 1, isActive: true }],
                teamRoles: [{ id: 20, teamId: 1, isActive: true }],
                memberships: [{ teamId: 1, userId: 10, teamRoleId: 20 }],
                users: [{ id: 10, role, isActive: true, deletedAt: null, employeeId: null }],
                teamGrants: [{ teamId: 1, capabilityKey: "employee.create", scope: "ALL" }],
                teamRoleGrants: [{ teamRoleId: 20, teamId: 1, capabilityKey: "employee.create", scope: "ALL" }],
                userGrants: [{ userId: 10, capabilityKey: "employee.create", scope: "ALL" }],
            }));

            expect(result.status).toBe("WARNING");
            expect(result.summary.effectiveConfiguredAuthorityCount).toBe(1);
            expect(result.summary.redundantAuthorityCount).toBe(1);
            expect(result.findings).toContainEqual(expect.objectContaining({
                code: "REDUNDANT_CONFIGURED_AUTHORITY",
                userId: 10,
                capabilityKey: "employee.create",
                scope: "ALL",
            }));
        },
    );

    it("accepts a valid direct User grant without a TEAM scope", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
            userGrants: [{
                userId: 10,
                capabilityKey: "audit.read",
                scope: "ALL",
            }],
        }));

        expect(result.status).toBe("PASS");
        expect(result.summary.effectiveConfiguredAuthorityCount).toBe(1);
    });

    it("treats an ADMIN direct grant as effective configured target authority", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            users: [{ id: 10, role: "ADMIN", isActive: true, deletedAt: null, employeeId: null }],
            userGrants: [{
                userId: 10,
                capabilityKey: "employee.create",
                scope: "ALL",
            }],
        }));

        expect(result.status).toBe("PASS");
        expect(result.summary.blockerCount).toBe(0);
        expect(result.summary.effectiveConfiguredAuthorityCount).toBe(1);
        expect(result.findings).not.toContainEqual(expect.objectContaining({
            code: "REDUNDANT_CONFIGURED_AUTHORITY",
        }));
    });

    it.each([
        ["unknown capability", "does.not.exist", "ALL", "UNKNOWN_PERSISTED_CAPABILITY"],
        ["unsupported scope", "employee.read", "OWN", "UNSUPPORTED_PERSISTED_SCOPE"],
    ] as const)("blocks %s", (_label, capabilityKey, scope, code) => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
            userGrants: [{ userId: 10, capabilityKey, scope }],
        }));

        expect(result.status).toBe("BLOCKED");
        expect(result.findings.some((finding) => finding.code === code)).toBe(true);
        expect(determineAuthorizationProductionReadinessExitCode(result)).toBe(1);
    });

    it.each(["USER", "ADMIN"] as const)("blocks a direct User TEAM grant for %s", (role) => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            users: [{ id: 10, role, isActive: true, deletedAt: null, employeeId: null }],
            userGrants: [{
                userId: 10,
                capabilityKey: "routine.task.read",
                scope: "TEAM",
            }],
        }));

        expect(result.status).toBe("BLOCKED");
        expect(result.findings).toContainEqual(expect.objectContaining({
            code: "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN",
            severity: "BLOCKER",
        }));
    });

    it("blocks a TeamRole/Team mismatch", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [
                { id: 1, isActive: true },
                { id: 2, isActive: true },
            ],
            teamRoles: [{ id: 20, teamId: 2, isActive: true }],
            memberships: [{ teamId: 1, userId: 10, teamRoleId: 20 }],
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
        }));

        expect(result.status).toBe("BLOCKED");
        expect(result.findings).toContainEqual(expect.objectContaining({
            code: "TEAM_ROLE_MEMBERSHIP_MISMATCH",
            severity: "BLOCKER",
        }));
    });

    it("blocks a TeamRole grant whose persisted Team origin does not match the role", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [
                { id: 1, isActive: true },
                { id: 2, isActive: true },
            ],
            teamRoles: [{ id: 20, teamId: 2, isActive: true }],
            teamRoleGrants: [{
                teamRoleId: 20,
                teamId: 1,
                capabilityKey: "employee.create",
                scope: "ALL",
            }],
        }));

        expect(result.status).toBe("BLOCKED");
        expect(result.findings).toContainEqual(expect.objectContaining({
            code: "TEAM_ROLE_GRANT_ORIGIN_MISMATCH",
            severity: "BLOCKER",
        }));
    });

    it("blocks duplicate TeamMembership rows as malformed configuration", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [{ id: 1, isActive: true }],
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
            memberships: [
                { teamId: 1, userId: 10, teamRoleId: null },
                { teamId: 1, userId: 10, teamRoleId: null },
            ],
        }));

        expect(result.status).toBe("BLOCKED");
        expect(result.findings).toContainEqual(expect.objectContaining({
            code: "MALFORMED_AUTHORIZATION_CONFIGURATION",
            source: "MEMBERSHIP",
            severity: "BLOCKER",
        }));
    });

    it("classifies inactive Teams, Users, and Employees as warnings, not effective authority", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [{ id: 1, isActive: false }],
            memberships: [{ teamId: 1, userId: 10, teamRoleId: null }],
            teamGrants: [{
                teamId: 1,
                capabilityKey: "employee.create",
                scope: "ALL",
            }],
            users: [{ id: 10, role: "USER", isActive: false, deletedAt: new Date("2026-09-01T00:00:00.000Z"), employeeId: 100 }],
            employees: [{ id: 100, status: "INACTIVE", deletedAt: null }],
        }));

        expect(result.status).toBe("WARNING");
        expect(result.summary.blockerCount).toBe(0);
        expect(result.summary.warningCount).toBeGreaterThan(0);
        expect(result.findings.every((finding) => finding.severity === "WARNING")).toBe(true);
    });

    it.each(["USER", "ADMIN"] as const)(
        "applies the same inactive-user lifecycle treatment to %s direct grants",
        (role) => {
            const result = evaluateAuthorizationProductionReadiness(createSnapshot({
                users: [{
                    id: 10,
                    role,
                    isActive: false,
                    deletedAt: new Date("2026-09-01T00:00:00.000Z"),
                    employeeId: null,
                }],
                userGrants: [{
                    userId: 10,
                    capabilityKey: "employee.create",
                    scope: "ALL",
                }],
            }));

            expect(result.status).toBe("WARNING");
            expect(result.summary.effectiveConfiguredAuthorityCount).toBe(0);
            expect(result.findings).toContainEqual(expect.objectContaining({
                code: "INACTIVE_USER_CONFIGURATION",
                userId: 10,
                severity: "WARNING",
            }));
        },
    );

    it.each(["USER", "ADMIN"] as const)(
        "applies the same inactive-Employee lifecycle treatment to %s direct grants",
        (role) => {
            const result = evaluateAuthorizationProductionReadiness(createSnapshot({
                users: [{
                    id: 10,
                    role,
                    isActive: true,
                    deletedAt: null,
                    employeeId: 100,
                }],
                employees: [{
                    id: 100,
                    status: "INACTIVE",
                    deletedAt: null,
                }],
                userGrants: [{
                    userId: 10,
                    capabilityKey: "employee.create",
                    scope: "ALL",
                }],
            }));

            expect(result.status).toBe("WARNING");
            expect(result.summary.effectiveConfiguredAuthorityCount).toBe(1);
            expect(result.findings).toContainEqual(expect.objectContaining({
                code: "INACTIVE_EMPLOYEE_CONFIGURATION",
                userId: 10,
                employeeId: 100,
                severity: "WARNING",
            }));
        },
    );

    it("blocks missing lifecycle references instead of treating them as inactive history", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            userGrants: [{
                userId: 404,
                capabilityKey: "employee.create",
                scope: "ALL",
            }],
        }));

        expect(result.status).toBe("BLOCKED");
        expect(result.findings).toContainEqual(expect.objectContaining({
            code: "MISSING_USER_REFERENCE",
            severity: "BLOCKER",
        }));
    });

    it("accepts an active persisted grant for an administratively grantable Email capability", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
            userGrants: [{
                userId: 10,
                capabilityKey: "email.request.read",
                scope: "OWN",
            }],
        }));

        expect(result.status).toBe("PASS");
        expect(result.findings).not.toContainEqual(expect.objectContaining({
            code: "NON_ADMINISTRATIVELY_GRANTABLE",
        }));
    });

    it("accepts an Email capability on an active Team even with zero members", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [{ id: 1, isActive: true }],
            teamGrants: [{
                teamId: 1,
                capabilityKey: "email.request.read",
                scope: "OWN",
            }],
        }));

        expect(result.status).toBe("PASS");
        expect(result.findings).not.toContainEqual(expect.objectContaining({
            code: "NON_ADMINISTRATIVELY_GRANTABLE",
        }));
    });

    it("accepts an Email capability on an active TeamRole even with zero members", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [{ id: 1, isActive: true }],
            teamRoles: [{ id: 20, teamId: 1, isActive: true }],
            teamRoleGrants: [{
                teamRoleId: 20,
                teamId: 1,
                capabilityKey: "email.request.read",
                scope: "OWN",
            }],
        }));

        expect(result.status).toBe("PASS");
        expect(result.findings).not.toContainEqual(expect.objectContaining({
            code: "NON_ADMINISTRATIVELY_GRANTABLE",
        }));
    });

    it("keeps inactive Team Email configuration as a warning", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [{ id: 1, isActive: false }],
            teamGrants: [{
                teamId: 1,
                capabilityKey: "email.request.read",
                scope: "OWN",
            }],
        }));

        expect(result.status).toBe("WARNING");
        expect(result.findings).toContainEqual(expect.objectContaining({
            code: "INACTIVE_TEAM_CONFIGURATION",
            source: "TEAM_GRANT",
            severity: "WARNING",
        }));
    });

    it("keeps inactive TeamRole Email configuration as a warning", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [{ id: 1, isActive: true }],
            teamRoles: [{ id: 20, teamId: 1, isActive: false }],
            teamRoleGrants: [{
                teamRoleId: 20,
                teamId: 1,
                capabilityKey: "email.request.read",
                scope: "OWN",
            }],
        }));

        expect(result.status).toBe("WARNING");
        expect(result.findings).toContainEqual(expect.objectContaining({
            code: "INACTIVE_TEAM_ROLE_CONFIGURATION",
            source: "TEAM_ROLE_GRANT",
            severity: "WARNING",
        }));
    });

    it("reports missing required migrations as blockers", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            migrations: [],
        }));

        expect(result.status).toBe("BLOCKED");
        expect(result.findings.filter((finding) =>
            finding.code === "REQUIRED_MIGRATION_NOT_APPLIED",
        )).toHaveLength(AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS.length);
    });

    it("keeps all registered capabilities accounted for and grantable", () => {
        const catalog = buildCapabilityAdministrationCatalog();

        expect(CAPABILITY_REGISTRY.definitions).toHaveLength(40);
        expect(catalog).toHaveLength(CAPABILITY_REGISTRY.definitions.length);
        expect(catalog.map(({ key }) => key)).toEqual(
            CAPABILITY_REGISTRY.definitions.map(({ key }) => key),
        );
        expect(catalog.every(({ administrativeStatus }) =>
            administrativeStatus !== "DEFERRED",
        )).toBe(true);
    });

    it("returns a blocked result without exposing repository errors", async () => {
        const result = await runAuthorizationProductionPreflight({
            load: async () => {
                throw new Error("DATABASE_URL=mysql://secret:password@example.invalid/prod");
            },
        });

        expect(result.status).toBe("BLOCKED");
        expect(result.failureCode).toBe("INVENTORY_READ_FAILED");
        expect(JSON.stringify(projectAuthorizationProductionReadinessReport(result)))
            .not.toContain("password");
    });

    it("keeps warning-only readiness distinguishable from a blocking exit", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [{ id: 1, isActive: false }],
        }));

        expect(result.status).toBe("PASS");
        expect(determineAuthorizationProductionReadinessExitCode(result)).toBe(0);

        const warningResult = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [{ id: 1, isActive: false }],
            teamGrants: [{ teamId: 1, capabilityKey: "employee.create", scope: "ALL" }],
        }));
        expect(warningResult.status).toBe("WARNING");
        expect(determineAuthorizationProductionReadinessExitCode(warningResult)).toBe(0);
    });

    it("does not mutate the inventory and projects deterministically", () => {
        const snapshot = createSnapshot({
            teams: [{ id: 2, isActive: true }, { id: 1, isActive: true }],
            teamGrants: [
                { teamId: 2, capabilityKey: "employee.create", scope: "ALL" },
                { teamId: 1, capabilityKey: "employee.read", scope: "ALL" },
            ],
        });
        const before = structuredClone(snapshot);
        const first = projectAuthorizationProductionReadinessReport(
            evaluateAuthorizationProductionReadiness(snapshot),
        );
        const second = projectAuthorizationProductionReadinessReport(
            evaluateAuthorizationProductionReadiness(snapshot),
        );

        expect(snapshot).toEqual(before);
        expect(first).toEqual(second);
        expect(first.summary.grantsByCapability).toEqual([
            { capabilityKey: "employee.create", count: 1 },
            { capabilityKey: "employee.read", count: 1 },
        ]);
    });

    it("keeps default reports bounded and free of sensitive identity fields", () => {
        const report = projectAuthorizationProductionReadinessReport(
            evaluateAuthorizationProductionReadiness(createSnapshot({
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
                userGrants: [{ userId: 10, capabilityKey: "employee.create", scope: "ALL" }],
            })),
        );
        const serialized = JSON.stringify(report);

        expect(serialized).not.toContain("email");
        expect(serialized).not.toContain("password");
        expect(serialized).not.toContain("token");
        expect(serialized).not.toContain("DATABASE_URL");
        expect("findings" in report).toBe(false);
        expect(report.authorityModel).toBe(AUTHORIZATION_PRODUCTION_AUTHORITY_MODEL);
        expect(report.authorityModelNotice).toBe(
            AUTHORIZATION_PRODUCTION_AUTHORITY_MODEL_NOTICE,
        );
    });

    it("proves Default Domain Policy parity and central-only denial", async () => {
        const emptyResolution = {
            userGrants: [],
            memberships: [],
            teamRoleGrants: [],
        };
        const resolver = createAuthorizationResolver({
            repository: {
                load: async () => emptyResolution,
                loadMany: async () => emptyResolution,
            },
        });
        const capabilityKeys = CAPABILITY_REGISTRY.definitions.map(
            ({ key }) => key,
        );
        const centralOnlyCapabilityKeys = buildCapabilityAdministrationCatalog()
            .filter(({ runtimeAuthorizationMode }) => runtimeAuthorizationMode === "CENTRAL_ONLY")
            .map(({ key }) => key);

        const inspectRole = async (systemRole: "USER" | "ADMIN") => {
            const actor = {
                userId: 10,
                employeeId: 100,
                systemRole,
                channel: "DASHBOARD" as const,
            };
            const decisions = await resolver.resolveMany(actor, capabilityKeys);
            for (const capabilityKey of centralOnlyCapabilityKeys) {
                expect(decisions.get(capabilityKey)).toMatchObject({
                    allowed: false,
                    scopes: [],
                    reason: "NO_APPLICABLE_GRANT",
                });
            }

            const inspections = await authorizationAdministrationEffectiveAccessProvider.inspect({
                actor,
                dashboardDecisions: decisions,
                resolver,
            });
            return inspections
                .filter(({ capability }) => [
                    "employee.read",
                    "stock.catalog.read",
                    "leave.request.read",
                    "audit.read",
                    "leave.recovery.manage",
                    "email.request.read",
                ].includes(capability))
                .map((inspection) => ({
                    capability: inspection.capability,
                    context: inspection.context.key,
                    defaultScopes: inspection.defaultScopes,
                    effectiveScopes: inspection.effectiveScopes,
                    state: inspection.state,
                }));
        };

        const userAccess = await inspectRole("USER");
        const adminAccess = await inspectRole("ADMIN");

        expect(adminAccess).toEqual(userAccess);
        expect(adminAccess).toEqual(expect.arrayContaining([
            expect.objectContaining({
                capability: "employee.read",
                defaultScopes: ["ALL"],
                effectiveScopes: ["ALL"],
                state: "AVAILABLE",
            }),
            expect.objectContaining({
                capability: "stock.catalog.read",
                defaultScopes: ["ALL"],
                effectiveScopes: ["ALL"],
                state: "AVAILABLE",
            }),
            expect.objectContaining({
                capability: "leave.request.read",
                defaultScopes: ["OWN"],
                effectiveScopes: ["OWN"],
                state: "AVAILABLE",
            }),
            expect.objectContaining({
                capability: "audit.read",
                defaultScopes: [],
                effectiveScopes: [],
                state: "UNAVAILABLE",
            }),
            expect.objectContaining({
                capability: "leave.recovery.manage",
                defaultScopes: [],
                effectiveScopes: [],
                state: "UNAVAILABLE",
            }),
            expect.objectContaining({
                capability: "email.request.read",
                defaultScopes: [],
                effectiveScopes: [],
                state: "UNAVAILABLE",
            }),
        ]));
    });

    it("validates an explicit canary plan without choosing its business target", async () => {
        const snapshot = createSnapshot({
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
            employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
        });

        expect(await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(),
            snapshot,
        )).toMatchObject({ status: "PASS", issues: [] });
    });

    it.each([
        ["Team", { source: "TEAM" as const, targetId: 1 }, {
            teams: [{ id: 1, isActive: true }],
            memberships: [{ teamId: 1, userId: 10, teamRoleId: null }],
        }],
        ["TeamRole", { source: "TEAM_ROLE" as const, targetId: 20 }, {
            teams: [{ id: 1, isActive: true }],
            teamRoles: [{ id: 20, teamId: 1, isActive: true }],
            memberships: [{ teamId: 1, userId: 10, teamRoleId: 20 }],
        }],
    ] as const)("accepts a valid %s canary with a workforce-eligible observer", async (_label, plan, sourceSnapshot) => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(plan),
            createSnapshot({
                ...sourceSnapshot,
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result).toMatchObject({ status: "PASS", issues: [] });
    });

    it("blocks a normal User canary without a linked Employee", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(),
            createSnapshot({
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_TARGET_NOT_WORKFORCE_ELIGIBLE",
        }));
    });

    it.each([
        ["inactive", { id: 100, status: "INACTIVE" as const, deletedAt: null }],
        ["deleted", { id: 100, status: "ACTIVE" as const, deletedAt: new Date("2026-09-01T00:00:00.000Z") }],
    ])("blocks a normal User canary with an %s Employee", async (_label, employee) => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(),
            createSnapshot({
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [employee],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_TARGET_NOT_WORKFORCE_ELIGIBLE",
        }));
    });

    it("does not treat an unusable workforce member as a Team canary observer", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({ source: "TEAM", targetId: 1 }),
            createSnapshot({
                teams: [{ id: 1, isActive: true }],
                memberships: [{ teamId: 1, userId: 10, teamRoleId: null }],
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_NO_ACTIVE_MEMBER",
        }));
    });

    it("does not allow a Team canary to select an unusable observer when another member is eligible", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({ source: "TEAM", targetId: 1 }),
            createSnapshot({
                teams: [{ id: 1, isActive: true }],
                memberships: [
                    { teamId: 1, userId: 10, teamRoleId: null },
                    { teamId: 1, userId: 11, teamRoleId: null },
                ],
                users: [
                    { id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null },
                    { id: 11, role: "USER", isActive: true, deletedAt: null, employeeId: 101 },
                ],
                employees: [{ id: 101, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_TARGET_NOT_WORKFORCE_ELIGIBLE",
        }));
    });

    it("does not treat an unusable workforce member as a TeamRole canary observer", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({ source: "TEAM_ROLE", targetId: 20 }),
            createSnapshot({
                teams: [{ id: 1, isActive: true }],
                teamRoles: [{ id: 20, teamId: 1, isActive: true }],
                memberships: [{ teamId: 1, userId: 10, teamRoleId: 20 }],
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_NO_ACTIVE_MEMBER",
        }));
    });

    it("blocks a direct User canary when a Team already supplies equal effective authority", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "employee.create",
                    channel: "DASHBOARD",
                    contextKey: "dashboard",
                    state: "AVAILABLE",
                    defaultScopes: [],
                    effectiveScopes: ["ALL"],
                },
            }),
            createSnapshot({
                teams: [{ id: 1, isActive: true }],
                memberships: [{ teamId: 1, userId: 10, teamRoleId: null }],
                teamGrants: [{ teamId: 1, capabilityKey: "employee.create", scope: "ALL" }],
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_NO_EFFECTIVE_AUTHORITY_CHANGE",
        }));
    });

    it("blocks a direct User canary when a TeamRole already supplies equal effective authority", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "employee.create",
                    channel: "DASHBOARD",
                    contextKey: "dashboard",
                    state: "AVAILABLE",
                    defaultScopes: [],
                    effectiveScopes: ["ALL"],
                },
            }),
            createSnapshot({
                teams: [{ id: 1, isActive: true }],
                teamRoles: [{ id: 20, teamId: 1, isActive: true }],
                memberships: [{ teamId: 1, userId: 10, teamRoleId: 20 }],
                teamRoleGrants: [{ teamRoleId: 20, teamId: 1, capabilityKey: "employee.create", scope: "ALL" }],
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_NO_EFFECTIVE_AUTHORITY_CHANGE",
        }));
    });

    it("blocks a Team canary when its observer already has equal direct User authority", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                source: "TEAM",
                targetId: 1,
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "employee.create",
                    channel: "DASHBOARD",
                    contextKey: "dashboard",
                    state: "AVAILABLE",
                    defaultScopes: [],
                    effectiveScopes: ["ALL"],
                },
            }),
            createSnapshot({
                teams: [{ id: 1, isActive: true }],
                memberships: [{ teamId: 1, userId: 10, teamRoleId: null }],
                userGrants: [{ userId: 10, capabilityKey: "employee.create", scope: "ALL" }],
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_NO_EFFECTIVE_AUTHORITY_CHANGE",
        }));
    });

    it("blocks a first canary when Default Domain Policy already supplies the authority", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                capabilityKey: "employee.read",
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "employee.read",
                    channel: "DASHBOARD",
                    contextKey: "dashboard",
                    state: "AVAILABLE",
                    defaultScopes: ["ALL"],
                    effectiveScopes: ["ALL"],
                },
            }),
            createSnapshot({
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_NO_EFFECTIVE_AUTHORITY_CHANGE",
        }));
    });

    it("rejects before-state evidence that contradicts the domain effective-access provider", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                capabilityKey: "employee.read",
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "employee.read",
                    channel: "DASHBOARD",
                    contextKey: "dashboard",
                    state: "UNAVAILABLE",
                    defaultScopes: [],
                    effectiveScopes: [],
                },
            }),
            createSnapshot({
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_EFFECTIVE_ACCESS_EVIDENCE_INVALID",
        }));
    });

    it("blocks a Routine LIFF canary when domain policy clamps before and after to the same scope", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                capabilityKey: "routine.summary.read",
                scope: "ALL",
                channel: "LIFF_SELF_SERVICE",
                contextKey: "liff.self-service",
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "routine.summary.read",
                    channel: "LIFF_SELF_SERVICE",
                    contextKey: "liff.self-service",
                    state: "AVAILABLE",
                    defaultScopes: ["ASSIGNED"],
                    effectiveScopes: ["ASSIGNED"],
                },
            }),
            createSnapshot({
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_NO_EFFECTIVE_AUTHORITY_CHANGE",
        }));
    });

    it("does not generically qualify an account-only ADMIN as a business canary observer", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "employee.create",
                    channel: "DASHBOARD",
                    contextKey: "dashboard",
                    state: "AVAILABLE",
                    defaultScopes: [],
                    effectiveScopes: ["ALL"],
                },
            }),
            createSnapshot({
                users: [{ id: 10, role: "ADMIN", isActive: true, deletedAt: null, employeeId: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_TARGET_NOT_WORKFORCE_ELIGIBLE",
        }));
    });

    it("allows an active workforce ADMIN direct canary when it adds target authority", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(),
            createSnapshot({
                users: [{ id: 10, role: "ADMIN", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result).toMatchObject({ status: "PASS", issues: [] });
    });

    it("requires direct User canaries to observe the granted User for either system role", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                observerUserId: 11,
                effectiveAccessBefore: {
                    observerUserId: 11,
                    capabilityKey: "employee.create",
                    channel: "DASHBOARD",
                    contextKey: "dashboard",
                    state: "UNAVAILABLE",
                    defaultScopes: [],
                    effectiveScopes: [],
                },
            }),
            createSnapshot({
                users: [
                    { id: 10, role: "ADMIN", isActive: true, deletedAt: null, employeeId: 100 },
                    { id: 11, role: "USER", isActive: true, deletedAt: null, employeeId: 101 },
                ],
                employees: [
                    { id: 100, status: "ACTIVE", deletedAt: null },
                    { id: 101, status: "ACTIVE", deletedAt: null },
                ],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_EFFECTIVE_ACCESS_EVIDENCE_INVALID",
        }));
    });

    it("uses the configured authority resolver for canary validation", async () => {
        const effectiveAccessProvider: AuthorizationProductionCanaryValidationDependencies["effectiveAccessProvider"] = {
            async inspect(input) {
                return authorizationAdministrationEffectiveAccessProvider.inspect(input);
            },
        };

        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(),
            createSnapshot({
                users: [{ id: 10, role: "ADMIN", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
            effectiveAccessProvider,
        );

        expect(result).toMatchObject({ status: "PASS", issues: [] });
    });

    it("rejects an ADMIN direct canary when Default Domain Policy already supplies the target authority", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                capabilityKey: "employee.read",
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "employee.read",
                    channel: "DASHBOARD",
                    contextKey: "dashboard",
                    state: "AVAILABLE",
                    defaultScopes: ["ALL"],
                    effectiveScopes: ["ALL"],
                },
            }),
            createSnapshot({
                users: [{ id: 10, role: "ADMIN", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_NO_EFFECTIVE_AUTHORITY_CHANGE",
        }));
    });

    it("passes a canary that adds genuinely new effective authority", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(),
            createSnapshot({
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result).toMatchObject({ status: "PASS", issues: [] });
    });

    it("does not mutate the inventory while evaluating a hypothetical canary", async () => {
        const snapshot = createSnapshot({
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
            employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
        });
        const before = structuredClone(snapshot);

        await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(),
            snapshot,
        );

        expect(snapshot).toEqual(before);
    });

    it("blocks a WARNING readiness canary without warning review", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(),
            createSnapshot({
                teams: [{ id: 2, isActive: false }],
                teamGrants: [{ teamId: 2, capabilityKey: "employee.create", scope: "ALL" }],
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_WARNING_REVIEW_REQUIRED",
        }));
    });

    it("blocks WARNING readiness with only a partial warning review", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                reviewedWarnings: [{
                    finding: {
                        kind: "LIFECYCLE",
                        source: "TEAM_GRANT",
                        code: "INACTIVE_TEAM_CONFIGURATION",
                        capabilityKey: "employee.create",
                        scope: "ALL",
                        teamId: 2,
                    },
                    disposition: "Historical Team configuration reviewed; no remediation is planned.",
                    reviewedBy: "operator@example.invalid",
                }],
            }),
            createSnapshot({
                teams: [
                    { id: 2, isActive: false },
                    { id: 3, isActive: false },
                ],
                teamGrants: [
                    { teamId: 2, capabilityKey: "employee.create", scope: "ALL" },
                    { teamId: 3, capabilityKey: "employee.create", scope: "ALL" },
                ],
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_WARNING_REVIEW_REQUIRED",
        }));
    });

    it("allows WARNING readiness after every current warning has a matching substantive review", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                reviewedWarnings: [{
                    finding: {
                        kind: "LIFECYCLE",
                        source: "TEAM_GRANT",
                        code: "INACTIVE_TEAM_CONFIGURATION",
                        capabilityKey: "employee.create",
                        scope: "ALL",
                        teamId: 2,
                    },
                    disposition: "Historical Team configuration reviewed; no remediation is planned.",
                    reviewedBy: "operator@example.invalid",
                }],
            }),
            createSnapshot({
                teams: [{ id: 2, isActive: false }],
                teamGrants: [{ teamId: 2, capabilityKey: "employee.create", scope: "ALL" }],
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result).toMatchObject({ status: "PASS", issues: [] });
    });

    it("rejects a stale warning review that does not match the current snapshot", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                reviewedWarnings: [{
                    finding: {
                        kind: "LIFECYCLE",
                        source: "TEAM_GRANT",
                        code: "INACTIVE_TEAM_CONFIGURATION",
                        capabilityKey: "employee.create",
                        scope: "ALL",
                        teamId: 99,
                    },
                    disposition: "Historical Team configuration reviewed; no remediation is planned.",
                    reviewedBy: "operator@example.invalid",
                }],
            }),
            createSnapshot({
                teams: [{ id: 2, isActive: false }],
                teamGrants: [{ teamId: 2, capabilityKey: "employee.create", scope: "ALL" }],
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result.status).toBe("BLOCKED");
        expect(result.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_WARNING_REVIEW_STALE",
        }));
    });

    it("does not require warning review for PASS readiness", async () => {
        const result = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(),
            createSnapshot({
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result).toMatchObject({ status: "PASS", issues: [] });
    });

    it("blocks canary plans with invalid source/scope or existing exact grant and accepts activated Email", async () => {
        const snapshot = createSnapshot({
            teams: [{ id: 1, isActive: true }],
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
            memberships: [{ teamId: 1, userId: 10, teamRoleId: null }],
            teamGrants: [{ teamId: 1, capabilityKey: "employee.create", scope: "ALL" }],
        });

        const invalidUserTeam = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({ scope: "TEAM" }),
            snapshot,
        );
        expect(invalidUserTeam.status).toBe("BLOCKED");
        expect(invalidUserTeam.issues).toContainEqual(expect.objectContaining({
            code: "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN",
        }));

        const existingGrant = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({ source: "TEAM", targetId: 1 }),
            snapshot,
        );
        expect(existingGrant.status).toBe("BLOCKED");
        expect(existingGrant.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_GRANT_ALREADY_EXISTS",
        }));

        const activatedEmail = await validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                capabilityKey: "email.request.read",
                scope: "OWN",
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "email.request.read",
                    channel: "DASHBOARD",
                    contextKey: "dashboard",
                    state: "UNAVAILABLE",
                    defaultScopes: [],
                    effectiveScopes: [],
                },
            }),
            createSnapshot({
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );
        expect(activatedEmail).toMatchObject({ status: "PASS", issues: [] });
    });
});
