import { describe, expect, it, vi } from "vitest";

import {
    AuthorizationConfigurationError,
    AuthorizationDeniedError,
    createAuthorizationResolver,
    createCapabilityRegistry,
} from "@/modules/authorization";
import {
    evaluateAuthorization,
    normalizeAuthorizationScopes,
} from "./evaluator";
import type {
    AuthorizationActor,
    AuthorizationPersistenceContext,
    AuthorizationMembershipResolution,
    AuthorizationPersistedTeamGrant,
    AuthorizationPersistedTeamRoleGrant,
    AuthorizationPersistedUserGrant,
    AuthorizationResolutionData,
    AuthorizationResolutionRepository,
    CapabilityDefinition,
} from "@/modules/authorization";

const CAPABILITY = "routine.task.read";
const USER_ID = 7;

type ActiveTeamRole = NonNullable<AuthorizationMembershipResolution["teamRole"]>;

function actor(
    overrides: Partial<AuthorizationActor> = {},
): AuthorizationActor {
    return {
        userId: USER_ID,
        employeeId: null,
        systemRole: "USER",
        channel: "DASHBOARD",
        ...overrides,
    };
}

function userGrant(
    scope: string,
    capabilityKey: string = CAPABILITY,
    userId: number = USER_ID,
): AuthorizationPersistedUserGrant {
    return { userId, capabilityKey, scope };
}

function teamGrant(
    teamId: number,
    scope: string,
    capabilityKey: string = CAPABILITY,
): AuthorizationPersistedTeamGrant {
    return { teamId, capabilityKey, scope };
}

function teamRoleGrant(
    teamId: number,
    teamRoleId: number,
    scope: string,
    capabilityKey: string = CAPABILITY,
): AuthorizationPersistedTeamRoleGrant {
    return { teamId, teamRoleId, capabilityKey, scope };
}

function membership(
    teamId: number,
    options: {
        userId?: number;
        isTeamActive?: boolean;
        teamRole?: ActiveTeamRole | null;
        teamGrants?: readonly AuthorizationPersistedTeamGrant[];
    } = {},
): AuthorizationMembershipResolution {
    return {
        userId: options.userId ?? USER_ID,
        teamId,
        isTeamActive: options.isTeamActive ?? true,
        teamRoleId: options.teamRole?.id ?? null,
        teamRole: options.teamRole ?? null,
        teamGrants: options.teamGrants ?? [],
    };
}

function resolution(
    options: {
        userGrants?: readonly AuthorizationPersistedUserGrant[];
        memberships?: readonly AuthorizationMembershipResolution[];
        teamRoleGrants?: readonly AuthorizationPersistedTeamRoleGrant[];
    } = {},
): AuthorizationResolutionData {
    return {
        userGrants: options.userGrants ?? [],
        memberships: options.memberships ?? [],
        teamRoleGrants: options.teamRoleGrants ?? [],
    };
}

function teamRegistry(
    scopes: CapabilityDefinition["scopes"] = ["TEAM", "CREATED"],
): ReturnType<typeof createCapabilityRegistry> {
    const definition: CapabilityDefinition = {
        key: CAPABILITY,
        domain: "routine",
        description: "Synthetic Team-capable Routine task capability.",
        scopes,
        channels: ["DASHBOARD"],
    };
    return createCapabilityRegistry([definition]);
}

describe("authorization evaluator", () => {
    it("denies an unknown capability without loading persistence", () => {
        const decision = evaluateAuthorization(
            actor(),
            "routine.task.unknown",
        );

        expect(decision).toEqual({
            capability: "routine.task.unknown",
            allowed: false,
            scopes: [],
            grants: [],
            reason: "UNKNOWN_CAPABILITY",
        });
    });

    it("denies a capability that does not support the actor channel", () => {
        const decision = evaluateAuthorization(
            actor({ systemRole: "ADMIN", channel: "LIFF_SELF_SERVICE" }),
            "employee.read",
        );

        expect(decision).toMatchObject({
            capability: "employee.read",
            allowed: false,
            scopes: [],
            grants: [],
            reason: "CHANNEL_NOT_SUPPORTED",
        });
    });

    it("denies a USER with no applicable grants", () => {
        const decision = evaluateAuthorization(actor(), CAPABILITY);

        expect(decision).toMatchObject({
            capability: CAPABILITY,
            allowed: false,
            scopes: [],
            grants: [],
            reason: "NO_APPLICABLE_GRANT",
        });
    });

    it("allows a direct User grant without requiring membership", () => {
        const decision = evaluateAuthorization(
            actor(),
            "stock.request.create",
            resolution({
                userGrants: [userGrant("OWN", "stock.request.create")],
            }),
        );

        expect(decision).toMatchObject({
            capability: "stock.request.create",
            allowed: true,
            scopes: ["OWN"],
            grants: [{
                capability: "stock.request.create",
                scope: "OWN",
                source: { type: "USER", userId: USER_ID },
            }],
        });
    });

    it("allows a Team grant through an active membership", () => {
        const decision = evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                memberships: [
                    membership(10, { teamGrants: [teamGrant(10, "CREATED")] }),
                ],
            }),
        );

        expect(decision).toMatchObject({
            allowed: true,
            scopes: ["CREATED"],
            grants: [{
                source: { type: "TEAM", teamId: 10 },
            }],
        });
    });

    it("allows a registered Routine capability through LIFF when granted", () => {
        const decision = evaluateAuthorization(
            actor({ channel: "LIFF_SELF_SERVICE" }),
            CAPABILITY,
            resolution({
                userGrants: [userGrant("ASSIGNED")],
            }),
        );

        expect(decision).toMatchObject({
            allowed: true,
            scopes: ["ASSIGNED"],
        });
    });

    it("allows a TeamRole grant through an active membership and role", () => {
        const decision = evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                memberships: [
                    membership(10, {
                        teamRole: { id: 20, isActive: true },
                    }),
                ],
                teamRoleGrants: [teamRoleGrant(10, 20, "ASSIGNED")],
            }),
        );

        expect(decision).toMatchObject({
            allowed: true,
            scopes: ["ASSIGNED"],
            grants: [{
                source: { type: "TEAM_ROLE", teamId: 10, teamRoleId: 20 },
            }],
        });
    });

    it("unions Team, TeamRole, and direct User grants", () => {
        const decision = evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                userGrants: [userGrant("ALL")],
                memberships: [
                    membership(10, {
                        teamRole: { id: 20, isActive: true },
                        teamGrants: [teamGrant(10, "CREATED")],
                    }),
                ],
                teamRoleGrants: [teamRoleGrant(10, 20, "ASSIGNED")],
            }),
        );

        expect(decision.allowed).toBe(true);
        expect(decision.scopes).toEqual(["ALL"]);
        expect(decision.grants).toEqual([
            {
                capability: CAPABILITY,
                scope: "CREATED",
                source: { type: "TEAM", teamId: 10 },
            },
            {
                capability: CAPABILITY,
                scope: "ASSIGNED",
                source: { type: "TEAM_ROLE", teamId: 10, teamRoleId: 20 },
            },
            {
                capability: CAPABILITY,
                scope: "ALL",
                source: { type: "USER", userId: USER_ID },
            },
        ]);
    });

    it("unions grants across multiple active Team memberships", () => {
        const decision = evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                memberships: [
                    membership(20, {
                        teamGrants: [teamGrant(20, "ASSIGNED")],
                    }),
                    membership(10, {
                        teamGrants: [teamGrant(10, "CREATED")],
                    }),
                ],
            }),
        );

        expect(decision.scopes).toEqual(["CREATED", "ASSIGNED"]);
        expect(decision.grants.map((grant) => grant.source)).toEqual([
            { type: "TEAM", teamId: 10 },
            { type: "TEAM", teamId: 20 },
        ]);
    });

    it("does not use a membership belonging to another User", () => {
        const decision = evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                memberships: [
                    membership(10, {
                        userId: USER_ID + 1,
                        teamGrants: [teamGrant(10, "ALL")],
                    }),
                ],
            }),
        );

        expect(decision.allowed).toBe(false);
        expect(decision.grants).toEqual([]);
    });

    it("does not use grants from an inactive Team", () => {
        const decision = evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                memberships: [
                    membership(10, {
                        isTeamActive: false,
                        teamGrants: [teamGrant(10, "ALL")],
                        teamRole: { id: 20, isActive: true },
                    }),
                ],
                teamRoleGrants: [teamRoleGrant(10, 20, "ALL")],
            }),
        );

        expect(decision.allowed).toBe(false);
        expect(decision.grants).toEqual([]);
    });

    it("does not use TeamRole grants from an inactive role", () => {
        const decision = evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                memberships: [
                    membership(10, {
                        teamRole: { id: 20, isActive: false },
                        teamGrants: [teamGrant(10, "CREATED")],
                    }),
                ],
                teamRoleGrants: [teamRoleGrant(10, 20, "ASSIGNED")],
            }),
        );

        expect(decision.allowed).toBe(true);
        expect(decision.scopes).toEqual(["CREATED"]);
        expect(decision.grants).toHaveLength(1);
        expect(decision.grants[0]?.source).toEqual({
            type: "TEAM",
            teamId: 10,
        });
    });

    it("normalizes duplicate scopes in deterministic contract order", () => {
        const decision = evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                userGrants: [userGrant("ASSIGNED")],
                memberships: [
                    membership(10, {
                        teamGrants: [teamGrant(10, "CREATED")],
                    }),
                    membership(20, {
                        teamGrants: [teamGrant(20, "CREATED")],
                    }),
                ],
            }),
        );

        expect(decision.scopes).toEqual(["CREATED", "ASSIGNED"]);
        expect(decision.grants).toHaveLength(3);
        expect(normalizeAuthorizationScopes([
            "ASSIGNED",
            "CREATED",
            "ASSIGNED",
        ])).toEqual(["CREATED", "ASSIGNED"]);
    });

    it("lets ALL subsume narrower normalized scopes without losing grants", () => {
        const decision = evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                userGrants: [userGrant("CREATED")],
                memberships: [
                    membership(10, {
                        teamGrants: [teamGrant(10, "ALL")],
                    }),
                ],
            }),
        );

        expect(decision.scopes).toEqual(["ALL"]);
        expect(decision.grants).toHaveLength(2);
        expect(decision.grants.map((grant) => grant.source)).toEqual([
            { type: "TEAM", teamId: 10 },
            { type: "USER", userId: USER_ID },
        ]);
    });

    it("uses ADMIN semantics without persisted grants", () => {
        const decision = evaluateAuthorization(
            actor({ systemRole: "ADMIN" }),
            CAPABILITY,
            resolution({
                userGrants: [userGrant("CREATED")],
            }),
        );

        expect(decision).toMatchObject({
            allowed: true,
            scopes: ["ALL"],
            grants: [{
                capability: CAPABILITY,
                scope: "ALL",
                source: { type: "SYSTEM_ROLE", role: "ADMIN" },
            }],
        });
    });

    it("returns valid non-Team scopes for ADMIN when ALL is unavailable", () => {
        const definition: CapabilityDefinition = {
            key: "leave.request.approve",
            domain: "leave",
            description: "Synthetic approval capability.",
            scopes: ["ASSIGNED"],
            channels: ["DASHBOARD"],
        };
        const registry = createCapabilityRegistry([definition]);
        const decision = evaluateAuthorization(
            actor({ systemRole: "ADMIN" }),
            definition.key,
            resolution(),
            registry,
        );

        expect(decision).toMatchObject({
            allowed: true,
            scopes: ["ASSIGNED"],
            grants: [{
                scope: "ASSIGNED",
                source: { type: "SYSTEM_ROLE", role: "ADMIN" },
            }],
        });
    });

    it("fails closed for an ADMIN-only origin-bound TEAM capability", () => {
        expect(() => evaluateAuthorization(
            actor({ systemRole: "ADMIN" }),
            CAPABILITY,
            resolution(),
            teamRegistry(["TEAM"]),
        )).toThrowError(
            expect.objectContaining({
                name: "AuthorizationConfigurationError",
                code: "UNSUPPORTED_ADMIN_TEAM_SCOPE",
            }),
        );
    });

    it("does not give a role authority without a persisted role grant", () => {
        const decision = evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                memberships: [
                    membership(10, { teamRole: { id: 20, isActive: true } }),
                ],
            }),
        );

        expect(decision.allowed).toBe(false);
    });

    it("rejects an invalid persisted scope instead of authorizing", () => {
        expect(() => evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                memberships: [
                    membership(10, {
                        teamGrants: [teamGrant(10, "OWN")],
                    }),
                ],
            }),
        )).toThrowError(
            expect.objectContaining({
                name: "AuthorizationConfigurationError",
                code: "UNSUPPORTED_PERSISTED_SCOPE",
            }),
        );
    });

    it("rejects an unknown persisted capability instead of authorizing", () => {
        expect(() => evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                userGrants: [userGrant("ALL", "routine.task.unknown")],
            }),
        )).toThrowError(
            expect.objectContaining({
                name: "AuthorizationConfigurationError",
                code: "UNKNOWN_PERSISTED_CAPABILITY",
            }),
        );
    });

    it("rejects a direct User TEAM grant because it has no origin", () => {
        expect(() => evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                userGrants: [userGrant("TEAM")],
            }),
            teamRegistry(),
        )).toThrowError(
            expect.objectContaining({
                name: "AuthorizationConfigurationError",
                code: "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN",
            }),
        );
    });

    it("preserves each TEAM origin for Team and TeamRole grants", () => {
        const decision = evaluateAuthorization(
            actor(),
            CAPABILITY,
            resolution({
                memberships: [
                    membership(10, {
                        teamRole: { id: 20, isActive: true },
                        teamGrants: [teamGrant(10, "TEAM")],
                    }),
                    membership(30, {
                        teamGrants: [teamGrant(30, "TEAM")],
                    }),
                ],
                teamRoleGrants: [teamRoleGrant(10, 20, "TEAM")],
            }),
            teamRegistry(),
        );

        expect(decision.scopes).toEqual(["TEAM"]);
        expect(decision.grants).toEqual([
            {
                capability: CAPABILITY,
                scope: "TEAM",
                source: { type: "TEAM", teamId: 10 },
                constraint: { teamId: 10 },
            },
            {
                capability: CAPABILITY,
                scope: "TEAM",
                source: { type: "TEAM", teamId: 30 },
                constraint: { teamId: 30 },
            },
            {
                capability: CAPABILITY,
                scope: "TEAM",
                source: { type: "TEAM_ROLE", teamId: 10, teamRoleId: 20 },
                constraint: { teamId: 10 },
            },
        ]);
    });
});

describe("authorization public resolver API", () => {
    it("backs can, require, and getScopes with the same detailed resolver", async () => {
        const load = vi.fn<AuthorizationResolutionRepository["load"]>(
            async () => resolution({
                userGrants: [userGrant("OWN", "stock.request.create")],
            }),
        );
        const loadMany = vi.fn<AuthorizationResolutionRepository["loadMany"]>(
            async () => resolution({
                userGrants: [userGrant("OWN", "stock.request.create")],
            }),
        );
        const resolver = createAuthorizationResolver({
            repository: { load, loadMany },
        });
        const currentActor = actor();

        await expect(
            resolver.can(currentActor, "stock.request.create"),
        ).resolves.toBe(true);
        await expect(
            resolver.getScopes(currentActor, "stock.request.create"),
        ).resolves.toEqual(["OWN"]);
        await expect(
            resolver.require(currentActor, "stock.request.create"),
        ).resolves.toMatchObject({
            allowed: true,
            scopes: ["OWN"],
        });
        expect(load).toHaveBeenCalledTimes(3);
    });

    it("loads USER resolution data once for multiple capability decisions", async () => {
        const load = vi.fn<AuthorizationResolutionRepository["load"]>(
            async () => resolution(),
        );
        const loadMany = vi.fn<AuthorizationResolutionRepository["loadMany"]>(
            async () => resolution({
                userGrants: [
                    userGrant("CREATED", "routine.task.read"),
                    userGrant("OWN", "routine.task.create"),
                ],
            }),
        );
        const resolver = createAuthorizationResolver({
            repository: { load, loadMany },
        });

        const decisions = await resolver.resolveMany(
            actor(),
            ["routine.task.read", "routine.task.create"],
        );

        expect(decisions.get("routine.task.read")).toMatchObject({
            allowed: true,
            scopes: ["CREATED"],
        });
        expect(decisions.get("routine.task.create")).toMatchObject({
            allowed: true,
            scopes: ["OWN"],
        });
        expect(loadMany).toHaveBeenCalledTimes(1);
        expect(loadMany).toHaveBeenCalledWith({
            userId: USER_ID,
            capabilityKeys: ["routine.task.read", "routine.task.create"],
        });
        expect(load).not.toHaveBeenCalled();
    });

    it("does not query persistence for ADMIN or rejected batch capabilities", async () => {
        const loadMany = vi.fn<AuthorizationResolutionRepository["loadMany"]>(
            async () => resolution(),
        );
        const resolver = createAuthorizationResolver({
            repository: {
                load: async () => resolution(),
                loadMany,
            },
        });

        const adminDecisions = await resolver.resolveMany(
            actor({ systemRole: "ADMIN" }),
            ["routine.task.read", "routine.occurrence.override"],
        );
        expect(adminDecisions.get("routine.task.read")?.allowed).toBe(true);
        expect(adminDecisions.get("routine.occurrence.override")?.allowed)
            .toBe(true);

        const rejectedDecisions = await resolver.resolveMany(
            actor({ channel: "LIFF_SELF_SERVICE" }),
            ["routine.task.unknown", "employee.read"],
        );
        expect(rejectedDecisions.get("routine.task.unknown")?.reason)
            .toBe("UNKNOWN_CAPABILITY");
        expect(rejectedDecisions.get("employee.read")?.reason)
            .toBe("CHANNEL_NOT_SUPPORTED");
        expect(loadMany).not.toHaveBeenCalled();
    });

    it("isolates evaluator validation to each requested capability", async () => {
        const loadMany = vi.fn<AuthorizationResolutionRepository["loadMany"]>(
            async () => resolution({
                userGrants: [
                    userGrant("CREATED", "routine.task.read"),
                    userGrant("CREATED", "routine.task.create"),
                ],
            }),
        );
        const resolver = createAuthorizationResolver({
            repository: {
                load: async () => resolution(),
                loadMany,
            },
        });

        const decisions = await resolver.resolveMany(
            actor(),
            ["routine.task.read"],
        );

        expect(decisions.get("routine.task.read")).toMatchObject({
            allowed: true,
            scopes: ["CREATED"],
        });
    });

    it("throws a framework-neutral denial error from require", async () => {
        const resolver = createAuthorizationResolver({
            repository: {
                load: async () => resolution(),
                loadMany: async () => resolution(),
            },
        });

        await expect(
            resolver.require(actor(), CAPABILITY),
        ).rejects.toBeInstanceOf(AuthorizationDeniedError);
        await expect(
            resolver.require(actor(), CAPABILITY),
        ).rejects.toMatchObject({
            capability: CAPABILITY,
            reason: "NO_APPLICABLE_GRANT",
            decision: { allowed: false },
        });
    });

    it("does not load persistence for ADMIN or rejected requests", async () => {
        const load = vi.fn<AuthorizationResolutionRepository["load"]>(
            async () => resolution(),
        );
        const loadMany = vi.fn<AuthorizationResolutionRepository["loadMany"]>(
            async () => resolution(),
        );
        const resolver = createAuthorizationResolver({
            repository: { load, loadMany },
        });

        await expect(
            resolver.can(actor({ systemRole: "ADMIN" }), CAPABILITY),
        ).resolves.toBe(true);
        await expect(
            resolver.can(actor(), "routine.task.unknown"),
        ).resolves.toBe(false);
        await expect(
            resolver.can(
                actor({ channel: "LIFF_SELF_SERVICE" }),
                "employee.read",
            ),
        ).resolves.toBe(false);
        expect(load).not.toHaveBeenCalled();
    });

    it("resolves USER grants through the supplied transaction context", async () => {
        const userGrantFindMany = vi.fn().mockResolvedValue([
            userGrant("CREATED"),
        ]);
        const teamMembershipFindMany = vi.fn().mockResolvedValue([]);
        const persistenceContext = {
            userCapabilityGrant: { findMany: userGrantFindMany },
            teamMembership: { findMany: teamMembershipFindMany },
        } as unknown as AuthorizationPersistenceContext;
        const resolver = createAuthorizationResolver();

        await expect(
            resolver.resolveInTransaction(actor(), CAPABILITY, persistenceContext),
        ).resolves.toMatchObject({
            allowed: true,
            scopes: ["CREATED"],
        });
        expect(userGrantFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { userId: USER_ID, capabilityKey: CAPABILITY },
        }));
        expect(teamMembershipFindMany).toHaveBeenCalled();
    });
});

describe("authorization error contracts", () => {
    it("exposes typed configuration errors without HTTP transport fields", () => {
        const error = new AuthorizationConfigurationError(
            "UNSUPPORTED_PERSISTED_SCOPE",
            "invalid test configuration",
            { capabilityKey: CAPABILITY, scope: "OWN" },
        );

        expect(error).toMatchObject({
            name: "AuthorizationConfigurationError",
            code: "UNSUPPORTED_PERSISTED_SCOPE",
            details: { capabilityKey: CAPABILITY, scope: "OWN" },
        });
        expect("status" in error).toBe(false);
    });
});
