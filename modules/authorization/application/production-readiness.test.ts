import { describe, expect, it } from "vitest";

import {
    AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS,
    determineAuthorizationProductionReadinessExitCode,
    evaluateAuthorizationProductionReadiness,
    projectAuthorizationProductionReadinessReport,
    runAuthorizationProductionPreflight,
    validateAuthorizationProductionCanaryPlan,
    type AuthorizationProductionInventorySnapshot,
    type AuthorizationProductionCanaryPlan,
} from "./production-readiness";

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
        effectiveAccessBefore: {
            observerUserId: 10,
            capabilityKey: "employee.create",
            channel: "DASHBOARD",
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

describe("authorization production readiness", () => {
    it("passes for a clean empty configuration with applied migration evidence", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot());

        expect(result.status).toBe("PASS");
        expect(result.summary).toMatchObject({
            teamCount: 0,
            activeTeamCount: 0,
            teamRoleCount: 0,
            membershipCount: 0,
            teamGrantCount: 0,
            teamRoleGrantCount: 0,
            directUserGrantCount: 0,
            invalidConfigurationCount: 0,
            warningCount: 0,
            blockerCount: 0,
        });
        expect(result.findings).toHaveLength(0);
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
    });

    it("does not treat a persisted grant on ADMIN as the source of ADMIN authority", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            users: [{ id: 10, role: "ADMIN", isActive: true, deletedAt: null, employeeId: null }],
            userGrants: [{
                userId: 10,
                capabilityKey: "employee.create",
                scope: "ALL",
            }],
        }));

        expect(result.status).toBe("WARNING");
        expect(result.summary.blockerCount).toBe(0);
        expect(result.findings).toContainEqual(expect.objectContaining({
            code: "ADMIN_PERSISTED_GRANT_REDUNDANT",
            severity: "WARNING",
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

    it("blocks a direct User TEAM grant", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
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

    it("blocks an active persisted grant for a non-administratively-deployable capability", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
            userGrants: [{
                userId: 10,
                capabilityKey: "email.request.read",
                scope: "OWN",
            }],
        }));

        expect(result.status).toBe("BLOCKED");
        expect(result.findings).toContainEqual(expect.objectContaining({
            code: "NON_ADMINISTRATIVELY_GRANTABLE",
            severity: "BLOCKER",
        }));
    });

    it("blocks a non-grantable capability on an active Team even with zero members", () => {
        const result = evaluateAuthorizationProductionReadiness(createSnapshot({
            teams: [{ id: 1, isActive: true }],
            teamGrants: [{
                teamId: 1,
                capabilityKey: "email.request.read",
                scope: "OWN",
            }],
        }));

        expect(result.status).toBe("BLOCKED");
        expect(result.findings).toContainEqual(expect.objectContaining({
            code: "NON_ADMINISTRATIVELY_GRANTABLE",
            source: "TEAM_GRANT",
            severity: "BLOCKER",
        }));
    });

    it("blocks a non-grantable capability on an active TeamRole even with zero members", () => {
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

        expect(result.status).toBe("BLOCKED");
        expect(result.findings).toContainEqual(expect.objectContaining({
            code: "NON_ADMINISTRATIVELY_GRANTABLE",
            source: "TEAM_ROLE_GRANT",
            severity: "BLOCKER",
        }));
    });

    it("keeps inactive Team non-grantable history as a warning", () => {
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
            code: "NON_ADMINISTRATIVELY_GRANTABLE",
            source: "TEAM_GRANT",
            severity: "WARNING",
        }));
    });

    it("keeps inactive TeamRole non-grantable history as a warning", () => {
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
            code: "NON_ADMINISTRATIVELY_GRANTABLE",
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
    });

    it("validates an explicit canary plan without choosing its business target", () => {
        const snapshot = createSnapshot({
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
            employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
        });

        expect(validateAuthorizationProductionCanaryPlan(
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
    ] as const)("accepts a valid %s canary with a workforce-eligible observer", (_label, plan, sourceSnapshot) => {
        const result = validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(plan),
            createSnapshot({
                ...sourceSnapshot,
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result).toMatchObject({ status: "PASS", issues: [] });
    });

    it("blocks a normal User canary without a linked Employee", () => {
        const result = validateAuthorizationProductionCanaryPlan(
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
    ])("blocks a normal User canary with an %s Employee", (_label, employee) => {
        const result = validateAuthorizationProductionCanaryPlan(
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

    it("does not treat an unusable workforce member as a Team canary observer", () => {
        const result = validateAuthorizationProductionCanaryPlan(
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

    it("does not allow a Team canary to select an unusable observer when another member is eligible", () => {
        const result = validateAuthorizationProductionCanaryPlan(
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

    it("does not treat an unusable workforce member as a TeamRole canary observer", () => {
        const result = validateAuthorizationProductionCanaryPlan(
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

    it("blocks a direct User canary when a Team already supplies equal effective authority", () => {
        const result = validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "employee.create",
                    channel: "DASHBOARD",
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

    it("blocks a direct User canary when a TeamRole already supplies equal effective authority", () => {
        const result = validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "employee.create",
                    channel: "DASHBOARD",
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

    it("blocks a Team canary when its observer already has equal direct User authority", () => {
        const result = validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                source: "TEAM",
                targetId: 1,
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "employee.create",
                    channel: "DASHBOARD",
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

    it("blocks a first canary when Default Domain Policy already supplies the authority", () => {
        const result = validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                capabilityKey: "employee.read",
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "employee.read",
                    channel: "DASHBOARD",
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

    it("does not qualify an ADMIN target when a grant cannot change SYSTEM_ROLE authority", () => {
        const result = validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({
                effectiveAccessBefore: {
                    observerUserId: 10,
                    capabilityKey: "employee.create",
                    channel: "DASHBOARD",
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
            code: "ADMIN_PERSISTED_GRANT_REDUNDANT",
        }));
    });

    it("passes a canary that adds genuinely new effective authority", () => {
        const result = validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(),
            createSnapshot({
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result).toMatchObject({ status: "PASS", issues: [] });
    });

    it("does not mutate the inventory while evaluating a hypothetical canary", () => {
        const snapshot = createSnapshot({
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
            employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
        });
        const before = structuredClone(snapshot);

        validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(),
            snapshot,
        );

        expect(snapshot).toEqual(before);
    });

    it("blocks a WARNING readiness canary without warning review", () => {
        const result = validateAuthorizationProductionCanaryPlan(
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

    it("blocks WARNING readiness with only a partial warning review", () => {
        const result = validateAuthorizationProductionCanaryPlan(
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

    it("allows WARNING readiness after every current warning has a matching substantive review", () => {
        const result = validateAuthorizationProductionCanaryPlan(
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

    it("rejects a stale warning review that does not match the current snapshot", () => {
        const result = validateAuthorizationProductionCanaryPlan(
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

    it("does not require warning review for PASS readiness", () => {
        const result = validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan(),
            createSnapshot({
                users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: 100 }],
                employees: [{ id: 100, status: "ACTIVE", deletedAt: null }],
            }),
        );

        expect(result).toMatchObject({ status: "PASS", issues: [] });
    });

    it("blocks canary plans with invalid source/scope, deferred capability, or existing exact grant", () => {
        const snapshot = createSnapshot({
            teams: [{ id: 1, isActive: true }],
            users: [{ id: 10, role: "USER", isActive: true, deletedAt: null, employeeId: null }],
            memberships: [{ teamId: 1, userId: 10, teamRoleId: null }],
            teamGrants: [{ teamId: 1, capabilityKey: "employee.create", scope: "ALL" }],
        });

        const invalidUserTeam = validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({ scope: "TEAM" }),
            snapshot,
        );
        expect(invalidUserTeam.status).toBe("BLOCKED");
        expect(invalidUserTeam.issues).toContainEqual(expect.objectContaining({
            code: "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN",
        }));

        const existingGrant = validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({ source: "TEAM", targetId: 1 }),
            snapshot,
        );
        expect(existingGrant.status).toBe("BLOCKED");
        expect(existingGrant.issues).toContainEqual(expect.objectContaining({
            code: "CANARY_GRANT_ALREADY_EXISTS",
        }));

        const deferred = validateAuthorizationProductionCanaryPlan(
            createValidCanaryPlan({ capabilityKey: "email.request.read", scope: "OWN" }),
            snapshot,
        );
        expect(deferred.status).toBe("BLOCKED");
        expect(deferred.issues).toContainEqual(expect.objectContaining({
            code: "NON_ADMINISTRATIVELY_GRANTABLE",
        }));
    });
});
