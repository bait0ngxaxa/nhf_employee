import { EmployeeStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
    assertAuthorizationAdministrationAccess,
    AuthorizationAdministrationAccessError,
    buildCapabilityAdministrationCatalog,
    CAPABILITY_REGISTRY,
    createAuthorizationResolver,
    getAuthorizationAdministrationOverview,
    getAuthorizationAdministrationTeam,
    getAuthorizationAdministrationUser,
} from "@/modules/authorization";
import type {
    AuthorizationResolutionData,
    AuthorizationResolutionRepository,
} from "@/modules/authorization";
import type {
    AuthorizationAdministrationTeamDetailRecord,
    AuthorizationAdministrationPrincipal,
    AuthorizationAdministrationRawUserIdentity,
    AuthorizationAdministrationRepository,
    AuthorizationAdministrationTeamRecord,
    AuthorizationAdministrationTeamReference,
    AuthorizationAdministrationTeamRoleRecord,
    AuthorizationAdministrationTeamRoleReference,
    AuthorizationAdministrationUserRecord,
} from "./administration-types";

const ADMIN_PRINCIPAL: AuthorizationAdministrationPrincipal = Object.freeze({
    userId: 99,
    systemRole: "ADMIN",
});

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");
const UPDATED_AT = new Date("2026-01-02T00:00:00.000Z");

describe("Authorization Administration system boundary", () => {
    it("accepts only a trusted ADMIN-shaped principal", () => {
        expect(assertAuthorizationAdministrationAccess({
            userId: 41,
            systemRole: "ADMIN",
        })).toEqual({ userId: 41, systemRole: "ADMIN" });
    });

    it.each([
        { userId: 41, systemRole: "USER" },
        { userId: "41", systemRole: "ADMIN" },
        { userId: Number.NaN, systemRole: "ADMIN" },
        { userId: 0, systemRole: "ADMIN" },
    ])("rejects an untrusted or malformed actor: $systemRole/$userId", (input) => {
        expect(() => assertAuthorizationAdministrationAccess(input)).toThrowError(
            AuthorizationAdministrationAccessError,
        );
    });
});

function teamReference(
    id: number,
    isActive = true,
): AuthorizationAdministrationTeamReference {
    return {
        id,
        key: `team-${id}`,
        name: `Team ${id}`,
        isActive,
    };
}

function roleReference(
    teamId: number,
    id: number,
    isActive = true,
): AuthorizationAdministrationTeamRoleReference {
    return {
        id,
        teamId,
        key: `role-${id}`,
        name: `Role ${id}`,
        isActive,
    };
}

function rawUser(
    id: number,
    overrides: Partial<AuthorizationAdministrationRawUserIdentity> = {},
): AuthorizationAdministrationRawUserIdentity {
    return {
        id,
        name: `User ${id}`,
        email: `user-${id}@example.com`,
        role: "USER",
        isActive: true,
        deletedAt: null,
        employee: {
            id: id + 1000,
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: "ชาย",
            status: EmployeeStatus.ACTIVE,
            deletedAt: null,
        },
        ...overrides,
    };
}

function teamSummary(
    id: number,
    isActive = true,
): AuthorizationAdministrationTeamRecord {
    return {
        id,
        key: `team-${id}`,
        name: `Team ${id}`,
        description: null,
        isActive,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        roleCount: 1,
        membershipCount: 1,
        teamGrantCount: 1,
    };
}

function teamDetail(): AuthorizationAdministrationTeamDetailRecord {
    const inactiveRole = roleReference(10, 20, false);
    const member = rawUser(7, {
        isActive: false,
        deletedAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    const role: AuthorizationAdministrationTeamRoleRecord = {
        ...inactiveRole,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        membershipCount: 1,
        grantCount: 2,
        grants: [
            { capabilityKey: "routine.task.read", scope: "ASSIGNED" },
            { capabilityKey: "unknown.capability", scope: "ALL" },
        ],
    };

    return {
        ...teamSummary(10, false),
        roles: [role],
        memberships: [{
            teamId: 10,
            userId: member.id,
            teamRoleId: role.id,
            role: inactiveRole,
            user: member,
        }],
        grants: [
            { capabilityKey: "routine.task.read", scope: "CREATED" },
            { capabilityKey: "stock.request.create", scope: "ALL" },
        ],
    };
}

function userRecord(): AuthorizationAdministrationUserRecord {
    const user = rawUser(7, {
        isActive: false,
        deletedAt: new Date("2026-03-01T00:00:00.000Z"),
        employee: {
            id: 1007,
            firstName: "สมหญิง",
            lastName: "ใจดี",
            nickname: null,
            status: EmployeeStatus.SUSPENDED,
            deletedAt: new Date("2026-03-02T00:00:00.000Z"),
        },
    });

    return {
        ...user,
        teamMemberships: [
            {
                teamId: 10,
                userId: 7,
                teamRoleId: 20,
                team: teamReference(10),
                role: roleReference(10, 20),
            },
            {
                teamId: 20,
                userId: 7,
                teamRoleId: null,
                team: teamReference(20),
                role: null,
            },
        ],
        userCapabilityGrants: [
            { capabilityKey: "stock.request.create", scope: "OWN" },
            { capabilityKey: "unknown.capability", scope: "ALL" },
        ],
    };
}

function resolutionData(): AuthorizationResolutionData {
    return {
        userGrants: [
            {
                userId: 7,
                capabilityKey: "routine.task.read",
                scope: "CREATED",
            },
            {
                userId: 7,
                capabilityKey: "stock.request.create",
                scope: "OWN",
            },
        ],
        memberships: [
            {
                userId: 7,
                teamId: 10,
                isTeamActive: true,
                teamRoleId: 20,
                teamRole: { id: 20, isActive: true },
                teamGrants: [{
                    teamId: 10,
                    capabilityKey: "routine.task.read",
                    scope: "ASSIGNED",
                }],
            },
            {
                userId: 7,
                teamId: 20,
                isTeamActive: true,
                teamRoleId: null,
                teamRole: null,
                teamGrants: [{
                    teamId: 20,
                    capabilityKey: "routine.task.read",
                    scope: "ALL",
                }],
            },
        ],
        teamRoleGrants: [{
            teamId: 10,
            teamRoleId: 20,
            capabilityKey: "routine.task.read",
            scope: "ALL",
        }],
    };
}

function emptyRepository(
    overrides: Partial<AuthorizationAdministrationRepository> = {},
): AuthorizationAdministrationRepository {
    return {
        listTeams: vi.fn(async () => []),
        findTeamById: vi.fn(async () => null),
        findUserById: vi.fn(async () => null),
        ...overrides,
    };
}

describe("Authorization Administration capability catalog", () => {
    it("projects the registry deterministically and marks deferred entries non-grantable", () => {
        const first = buildCapabilityAdministrationCatalog();
        const second = buildCapabilityAdministrationCatalog();

        expect(first).toEqual(second);
        expect(first.map(({ key }) => key)).toEqual(
            CAPABILITY_REGISTRY.definitions.map(({ key }) => key),
        );
        expect(first.find(({ key }) => key === "routine.task.read")).toMatchObject({
            supportedScopes: CAPABILITY_REGISTRY.get("routine.task.read")?.scopes,
            supportedChannels: CAPABILITY_REGISTRY.get("routine.task.read")?.channels,
        });
        expect(first.every(({ registered }) => registered)).toBe(true);
        expect(first.find(({ key }) => key === "routine.task.export")).toMatchObject({
            administrativeStatus: "DEFERRED",
            administrativelyGrantable: false,
        });
        expect(first.find(({ key }) => key === "email.request.create")).toMatchObject({
            administrativeStatus: "DEFERRED",
            administrativelyGrantable: false,
        });
        expect(first.some(({ key }) => String(key) === "routine.task.archive")).toBe(false);
    });
});

describe("Authorization Administration read models", () => {
    it("keeps inactive Teams inspectable and returns accurate overview counts", async () => {
        const repository = emptyRepository({
            listTeams: vi.fn(async () => [teamSummary(10, false), teamSummary(20)]),
        });

        const overview = await getAuthorizationAdministrationOverview(
            ADMIN_PRINCIPAL,
            { repository },
        );

        expect(overview.teams.map(({ id, isActive }) => ({ id, isActive }))).toEqual([
            { id: 10, isActive: false },
            { id: 20, isActive: true },
        ]);
        expect(overview.summary).toMatchObject({
            registeredCapabilityCount: CAPABILITY_REGISTRY.definitions.length,
            teamCount: 2,
            activeTeamCount: 1,
        });
    });

    it("preserves TeamRole ownership, lifecycle state, memberships, and invalid grants", async () => {
        const repository = emptyRepository({
            findTeamById: vi.fn(async () => teamDetail()),
        });

        const detail = await getAuthorizationAdministrationTeam(
            ADMIN_PRINCIPAL,
            10,
            { repository },
        );

        expect(detail).not.toBeNull();
        expect(detail?.isActive).toBe(false);
        expect(detail?.roles[0]).toMatchObject({
            id: 20,
            teamId: 10,
            isActive: false,
        });
        expect(detail?.memberships[0]).toMatchObject({
            teamId: 10,
            userId: 7,
            teamRoleId: 20,
            teamRole: { teamId: 10, id: 20 },
            user: { id: 7, isActive: false, employee: { status: EmployeeStatus.ACTIVE } },
        });
        expect(detail?.teamGrants.map(({ capabilityKey, validation }) => ({
            capabilityKey,
            validation: validation.status,
        }))).toEqual([
            { capabilityKey: "routine.task.read", validation: "VALID" },
            { capabilityKey: "stock.request.create", validation: "INVALID" },
        ]);
        expect(detail?.teamRoleGrants[0]).toMatchObject({
            teamId: 10,
            teamRoleId: 20,
            teamRole: { teamId: 10, id: 20 },
        });
        expect(detail?.configurationIssues.map(({ code }) => code)).toEqual([
            "UNSUPPORTED_PERSISTED_SCOPE",
            "UNKNOWN_PERSISTED_CAPABILITY",
        ]);
    });
});

describe("Authorization Administration effective permission inspector", () => {
    it("uses the central resolver and preserves Team, TeamRole, and User sources", async () => {
        const resolution = resolutionData();
        const load = vi.fn<AuthorizationResolutionRepository["load"]>(
            async () => resolution,
        );
        const loadMany = vi.fn<AuthorizationResolutionRepository["loadMany"]>(
            async () => resolution,
        );
        const resolver = createAuthorizationResolver({
            repository: { load, loadMany },
        });
        const repository = emptyRepository({
            findUserById: vi.fn(async () => userRecord()),
        });

        const detail = await getAuthorizationAdministrationUser(
            ADMIN_PRINCIPAL,
            7,
            { repository, resolver },
        );

        const routineRead = detail?.effectivePermissions.find(
            ({ capability }) => capability.key === "routine.task.read",
        );
        expect(routineRead).toMatchObject({
            allowed: true,
            scopes: ["ALL"],
        });
        expect(routineRead?.grants.map(({ source, origin }) => ({ source, origin }))).toEqual([
            {
                source: { type: "TEAM", teamId: 10 },
                origin: {
                    type: "TEAM",
                    teamId: 10,
                    team: teamReference(10),
                },
            },
            {
                source: { type: "TEAM", teamId: 20 },
                origin: {
                    type: "TEAM",
                    teamId: 20,
                    team: teamReference(20),
                },
            },
            {
                source: { type: "TEAM_ROLE", teamId: 10, teamRoleId: 20 },
                origin: {
                    type: "TEAM_ROLE",
                    teamId: 10,
                    team: teamReference(10),
                    teamRoleId: 20,
                    teamRole: roleReference(10, 20),
                },
            },
            {
                source: { type: "USER", userId: 7 },
                origin: { type: "USER", userId: 7 },
            },
        ]);

        const noGrant = detail?.effectivePermissions.find(
            ({ capability }) => capability.key === "audit.read",
        );
        expect(noGrant).toMatchObject({
            allowed: false,
            scopes: [],
            grants: [],
            reason: "NO_APPLICABLE_GRANT",
        });
        expect(detail?.teamMemberships).toHaveLength(2);
        expect(detail?.user).toMatchObject({
            id: 7,
            isActive: false,
            deletedAt: expect.any(Date),
            employee: {
                status: EmployeeStatus.SUSPENDED,
                deletedAt: expect.any(Date),
            },
        });
        expect(detail?.directGrants[1]).toMatchObject({
            capabilityKey: "unknown.capability",
            scope: "ALL",
            validation: {
                status: "INVALID",
                code: "UNKNOWN_PERSISTED_CAPABILITY",
            },
        });
        expect(loadMany).toHaveBeenCalledTimes(1);
        expect(load).not.toHaveBeenCalled();
    });

    it("uses the central ADMIN resolver source without consulting persisted grants", async () => {
        const repository = emptyRepository({
            findUserById: vi.fn(async () => ({
                ...userRecord(),
                role: "ADMIN",
                isActive: true,
            })),
        });

        const detail = await getAuthorizationAdministrationUser(
            ADMIN_PRINCIPAL,
            7,
            { repository, resolver: createAuthorizationResolver() },
        );
        const employeeRead = detail?.effectivePermissions.find(
            ({ capability }) => capability.key === "employee.read",
        );

        expect(employeeRead).toMatchObject({
            allowed: true,
            scopes: ["ALL"],
            grants: [{
                source: { type: "SYSTEM_ROLE", role: "ADMIN" },
                origin: { type: "SYSTEM_ROLE", role: "ADMIN" },
            }],
        });
    });

    it("returns an explicit invalid-configuration status instead of allowing a resolver failure", async () => {
        const repository = emptyRepository({
            findUserById: vi.fn(async () => userRecord()),
        });
        const resolution = resolutionData();
        const load = vi.fn<AuthorizationResolutionRepository["load"]>(
            async () => resolution,
        );
        const loadMany = vi.fn<AuthorizationResolutionRepository["loadMany"]>(
            async () => ({
                ...resolution,
                userGrants: [{
                    userId: 7,
                    capabilityKey: "routine.task.read",
                    scope: "OWN",
                }],
            }),
        );
        const resolver = createAuthorizationResolver({
            repository: { load, loadMany },
        });

        const detail = await getAuthorizationAdministrationUser(
            ADMIN_PRINCIPAL,
            7,
            { repository, resolver },
        );

        expect(detail?.effectivePermissions).toEqual([]);
        expect(detail?.effectivePermissionStatus).toMatchObject({
            status: "INVALID_CONFIGURATION",
            error: { code: "UNSUPPORTED_PERSISTED_SCOPE" },
        });
        expect(detail?.configurationIssues).toContainEqual(
            expect.objectContaining({
                source: "EFFECTIVE_RESOLUTION",
                code: "UNSUPPORTED_PERSISTED_SCOPE",
            }),
        );
    });
});
