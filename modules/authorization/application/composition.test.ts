import { describe, expect, it } from "vitest";

import {
    composeAuthorizationAuthority,
    createCapabilityRegistry,
} from "@/modules/authorization";
import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationDecisionReason,
    AuthorizationMembershipResolution,
    AuthorizationPersistedTeamGrant,
    AuthorizationPersistedTeamRoleGrant,
    AuthorizationPersistedUserGrant,
    AuthorizationResolutionData,
    CapabilityDefinition,
    CapabilityRegistry,
} from "@/modules/authorization";
import { CAPABILITY_REGISTRY } from "../registry";
import { evaluateConfiguredAuthorization } from "./evaluator";

const evaluateAuthorization = evaluateConfiguredAuthorization;

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
        teamRole?: ActiveTeamRole | null;
        teamGrants?: readonly AuthorizationPersistedTeamGrant[];
    } = {},
): AuthorizationMembershipResolution {
    return {
        userId: USER_ID,
        teamId,
        isTeamActive: true,
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
    scopes: CapabilityDefinition["scopes"] = [
        "OWN",
        "CREATED",
        "ASSIGNED",
        "TEAM",
        "ALL",
    ],
): CapabilityRegistry {
    const definition: CapabilityDefinition = {
        key: CAPABILITY,
        domain: "routine",
        description: "Synthetic Team-capable Routine task capability.",
        scopes,
        channels: ["DASHBOARD"],
    };
    return createCapabilityRegistry([definition]);
}

function resolveConfigured(
    currentActor: AuthorizationActor,
    capability: string = CAPABILITY,
    data: AuthorizationResolutionData = resolution(),
    registry: CapabilityRegistry = CAPABILITY_REGISTRY,
): AuthorizationDecision {
    return evaluateAuthorization(currentActor, capability, data, registry);
}

function deniedDecision(
    capability: string,
    reason: AuthorizationDecisionReason,
): AuthorizationDecision {
    return {
        capability,
        allowed: false,
        scopes: [],
        grants: [],
        reason,
    };
}

describe("composeAuthorizationAuthority", () => {
    it("denies a USER when both default and configured authority are empty", () => {
        const configuredDecision = resolveConfigured(actor());

        const composed = composeAuthorizationAuthority(
            actor(),
            CAPABILITY,
            [],
            configuredDecision,
        );

        expect(composed).toMatchObject({
            capability: CAPABILITY,
            allowed: false,
            scopes: [],
            defaultScopes: [],
            configuredDecision,
            configuredGrants: [],
        });
        expect(composed.configuredDecision).toBe(configuredDecision);
    });

    it("allows a USER default scope without manufacturing a configured grant", () => {
        const currentActor = actor();
        const configuredDecision = resolveConfigured(
            currentActor,
            "stock.request.create",
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            "stock.request.create",
            ["OWN"],
            configuredDecision,
        );

        expect(composed.allowed).toBe(true);
        expect(composed.scopes).toEqual(["OWN"]);
        expect(composed.defaultScopes).toEqual(["OWN"]);
        expect(composed.configuredGrants).toEqual([]);
    });

    it("uses configured authority when no default authority exists", () => {
        const currentActor = actor();
        const configuredDecision = resolveConfigured(
            currentActor,
            CAPABILITY,
            resolution({ userGrants: [userGrant("ALL")] }),
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            CAPABILITY,
            [],
            configuredDecision,
        );

        expect(composed.allowed).toBe(true);
        expect(composed.scopes).toEqual(["ALL"]);
        expect(composed.configuredGrants).toEqual(configuredDecision.grants);
    });

    it("does not let a narrower configured grant narrow the default", () => {
        const currentActor = actor();
        const configuredDecision = resolveConfigured(
            currentActor,
            CAPABILITY,
            resolution({ userGrants: [userGrant("CREATED")] }),
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            CAPABILITY,
            ["CREATED", "ASSIGNED"],
            configuredDecision,
        );

        expect(composed.scopes).toEqual(["CREATED", "ASSIGNED"]);
        expect(composed.defaultScopes).toEqual(["CREATED", "ASSIGNED"]);
    });

    it("unions partially additive default and configured scopes", () => {
        const currentActor = actor();
        const configuredDecision = resolveConfigured(
            currentActor,
            CAPABILITY,
            resolution({ userGrants: [userGrant("ASSIGNED")] }),
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            CAPABILITY,
            ["CREATED"],
            configuredDecision,
        );

        expect(composed.scopes).toEqual(["CREATED", "ASSIGNED"]);
    });

    it("lets a broader configured grant expand the default", () => {
        const currentActor = actor();
        const configuredDecision = resolveConfigured(
            currentActor,
            "stock.request.read",
            resolution({
                userGrants: [userGrant("ALL", "stock.request.read")],
            }),
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            "stock.request.read",
            ["OWN"],
            configuredDecision,
        );

        expect(composed.scopes).toEqual(["ALL"]);
    });

    it("keeps a broader default when the configured grant is narrower", () => {
        const currentActor = actor();
        const configuredDecision = resolveConfigured(
            currentActor,
            CAPABILITY,
            resolution({ userGrants: [userGrant("CREATED")] }),
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            CAPABILITY,
            ["ALL"],
            configuredDecision,
        );

        expect(composed.scopes).toEqual(["ALL"]);
    });

    it("unions Team, TeamRole, and direct User grants", () => {
        const currentActor = actor();
        const registry = teamRegistry();
        const configuredDecision = resolveConfigured(
            currentActor,
            CAPABILITY,
            resolution({
                userGrants: [userGrant("OWN")],
                memberships: [
                    membership(10, {
                        teamRole: { id: 20, isActive: true },
                        teamGrants: [teamGrant(10, "CREATED")],
                    }),
                ],
                teamRoleGrants: [teamRoleGrant(10, 20, "ASSIGNED")],
            }),
            registry,
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            CAPABILITY,
            [],
            configuredDecision,
            registry,
        );

        expect(composed.scopes).toEqual(["OWN", "CREATED", "ASSIGNED"]);
        expect(composed.configuredGrants).toEqual(configuredDecision.grants);
        expect(composed.configuredGrants.map((grant) => grant.source)).toEqual([
            { type: "TEAM", teamId: 10 },
            { type: "TEAM_ROLE", teamId: 10, teamRoleId: 20 },
            { type: "USER", userId: USER_ID },
        ]);
    });

    it("retains each TEAM origin while normalizing TEAM only once", () => {
        const currentActor = actor();
        const registry = teamRegistry();
        const configuredDecision = resolveConfigured(
            currentActor,
            CAPABILITY,
            resolution({
                memberships: [
                    membership(10, {
                        teamRole: { id: 30, isActive: true },
                        teamGrants: [teamGrant(10, "TEAM")],
                    }),
                    membership(20, {
                        teamGrants: [teamGrant(20, "TEAM")],
                    }),
                ],
                teamRoleGrants: [teamRoleGrant(10, 30, "TEAM")],
            }),
            registry,
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            CAPABILITY,
            ["OWN"],
            configuredDecision,
            registry,
        );

        expect(composed.scopes).toEqual(["OWN", "TEAM"]);
        expect(composed.configuredGrants.map((grant) => grant.constraint)).toEqual([
            { teamId: 10 },
            { teamId: 20 },
            { teamId: 10 },
        ]);
        expect(composed.configuredGrants.map((grant) => grant.source)).toEqual([
            { type: "TEAM", teamId: 10 },
            { type: "TEAM", teamId: 20 },
            { type: "TEAM_ROLE", teamId: 10, teamRoleId: 30 },
        ]);
    });

    it("does not add Team constraints to non-TEAM Team or TeamRole grants", () => {
        const currentActor = actor();
        const registry = teamRegistry();
        const configuredDecision = resolveConfigured(
            currentActor,
            CAPABILITY,
            resolution({
                memberships: [
                    membership(10, {
                        teamRole: { id: 20, isActive: true },
                        teamGrants: [teamGrant(10, "ALL")],
                    }),
                ],
                teamRoleGrants: [teamRoleGrant(10, 20, "CREATED")],
            }),
            registry,
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            CAPABILITY,
            [],
            configuredDecision,
            registry,
        );

        expect(composed.configuredGrants).toEqual([
            {
                capability: CAPABILITY,
                scope: "ALL",
                source: { type: "TEAM", teamId: 10 },
            },
            {
                capability: CAPABILITY,
                scope: "CREATED",
                source: { type: "TEAM_ROLE", teamId: 10, teamRoleId: 20 },
            },
        ]);
        expect(composed.configuredGrants.every((grant) => grant.constraint === undefined))
            .toBe(true);
    });

    it("normalizes ALL without deleting configured grant provenance", () => {
        const currentActor = actor();
        const registry = teamRegistry();
        const configuredDecision = resolveConfigured(
            currentActor,
            CAPABILITY,
            resolution({
                userGrants: [userGrant("ASSIGNED")],
                memberships: [
                    membership(10, {
                        teamGrants: [teamGrant(10, "ALL")],
                    }),
                ],
            }),
            registry,
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            CAPABILITY,
            ["OWN"],
            configuredDecision,
            registry,
        );

        expect(composed.scopes).toEqual(["ALL"]);
        expect(composed.configuredGrants).toHaveLength(2);
        expect(composed.configuredGrants.map((grant) => grant.source)).toEqual([
            { type: "TEAM", teamId: 10 },
            { type: "USER", userId: USER_ID },
        ]);
    });

    it("does not use default authority for CHANNEL_NOT_SUPPORTED", () => {
        const currentActor = actor({ channel: "LIFF_SELF_SERVICE" });
        const configuredDecision = resolveConfigured(
            currentActor,
            "employee.read",
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            "employee.read",
            ["ALL"],
            configuredDecision,
        );

        expect(composed.allowed).toBe(false);
        expect(composed.scopes).toEqual([]);
        expect(composed.defaultScopes).toEqual([]);
    });

    it("does not use default authority for UNKNOWN_CAPABILITY", () => {
        const currentActor = actor();
        const unknownCapability = "routine.task.unknown";
        const configuredDecision = resolveConfigured(
            currentActor,
            unknownCapability,
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            unknownCapability,
            ["ALL"],
            configuredDecision,
        );

        expect(composed.allowed).toBe(false);
        expect(composed.scopes).toEqual([]);
    });

    it("does not treat every false decision as NO_APPLICABLE_GRANT", () => {
        const currentActor = actor();
        const configuredDecision: AuthorizationDecision = {
            capability: CAPABILITY,
            allowed: false,
            scopes: [],
            grants: [],
        };

        const composed = composeAuthorizationAuthority(
            currentActor,
            CAPABILITY,
            ["ALL"],
            configuredDecision,
        );

        expect(composed.allowed).toBe(false);
        expect(composed.scopes).toEqual([]);
    });

    it("does not swallow evaluator configuration errors before composition", () => {
        expect(() => {
            const configuredDecision = resolveConfigured(
                actor(),
                CAPABILITY,
                resolution({
                    memberships: [
                        membership(10, {
                            teamGrants: [teamGrant(10, "OWN")],
                        }),
                    ],
                }),
            );

            return composeAuthorizationAuthority(
                actor(),
                CAPABILITY,
                ["ALL"],
                configuredDecision,
            );
        }).toThrowError(
            expect.objectContaining({
                name: "AuthorizationConfigurationError",
                code: "UNSUPPORTED_PERSISTED_SCOPE",
            }),
        );
    });

    it("fails closed when the configured decision has another capability", () => {
        expect(() => composeAuthorizationAuthority(
            actor(),
            CAPABILITY,
            [],
            deniedDecision("stock.request.read", "NO_APPLICABLE_GRANT"),
        )).toThrowError(
            expect.objectContaining({
                name: "AuthorizationConfigurationError",
                code: "CAPABILITY_MISMATCH",
            }),
        );
    });

    it("rejects a default scope that the registered capability does not support", () => {
        const currentActor = actor();
        const capability = "stock.request.create";
        const configuredDecision = resolveConfigured(currentActor, capability);

        expect(() => composeAuthorizationAuthority(
            currentActor,
            capability,
            ["ALL"],
            configuredDecision,
        )).toThrowError(
            expect.objectContaining({
                name: "AuthorizationConfigurationError",
                code: "UNSUPPORTED_DEFAULT_SCOPE",
            }),
        );
    });

    it("rejects an originless default TEAM scope", () => {
        const currentActor = actor();
        const registry = teamRegistry();
        const configuredDecision = resolveConfigured(
            currentActor,
            CAPABILITY,
            resolution(),
            registry,
        );

        expect(() => composeAuthorizationAuthority(
            currentActor,
            CAPABILITY,
            ["TEAM"],
            configuredDecision,
            registry,
        )).toThrowError(
            expect.objectContaining({
                name: "AuthorizationConfigurationError",
                code: "DEFAULT_TEAM_SCOPE_REQUIRES_ORIGIN",
            }),
        );
    });

    it("composes ADMIN default and configured authority without a role branch", () => {
        const adminActor = actor({ systemRole: "ADMIN" });
        const registry = teamRegistry();
        const configuredDecision = resolveConfigured(
            adminActor,
            CAPABILITY,
            resolution({
                userGrants: [userGrant("CREATED")],
                memberships: [
                    membership(10, {
                        teamGrants: [teamGrant(10, "TEAM")],
                    }),
                ],
            }),
            registry,
        );

        const composed = composeAuthorizationAuthority(
            adminActor,
            CAPABILITY,
            ["OWN"],
            configuredDecision,
            registry,
        );

        expect(composed.allowed).toBe(true);
        expect(composed.scopes).toEqual(["OWN", "CREATED", "TEAM"]);
        expect(composed.defaultScopes).toEqual(["OWN"]);
        expect(composed.configuredGrants).toEqual([
            {
                capability: CAPABILITY,
                scope: "TEAM",
                source: { type: "TEAM", teamId: 10 },
                constraint: { teamId: 10 },
            },
            {
                capability: CAPABILITY,
                scope: "CREATED",
                source: { type: "USER", userId: USER_ID },
            },
        ]);

        const userDecision = resolveConfigured(
            actor({ systemRole: "USER" }),
            CAPABILITY,
            resolution({
                userGrants: [userGrant("CREATED")],
                memberships: [
                    membership(10, {
                        teamGrants: [teamGrant(10, "TEAM")],
                    }),
                ],
            }),
            registry,
        );
        expect(composed).toEqual(composeAuthorizationAuthority(
            actor({ systemRole: "USER" }),
            CAPABILITY,
            ["OWN"],
            userDecision,
            registry,
        ));
    });

    it("validates an ADMIN default TEAM scope like a USER default", () => {
        const adminActor = actor({ systemRole: "ADMIN" });
        const registry = teamRegistry();
        const configuredDecision = resolveConfigured(
            adminActor,
            CAPABILITY,
            resolution(),
            registry,
        );

        expect(() => composeAuthorizationAuthority(
            adminActor,
            CAPABILITY,
            ["TEAM"],
            configuredDecision,
            registry,
        )).toThrowError(
            expect.objectContaining({
                name: "AuthorizationConfigurationError",
                code: "DEFAULT_TEAM_SCOPE_REQUIRES_ORIGIN",
            }),
        );
    });

    it("validates an unsupported ADMIN default scope like a USER default", () => {
        const adminActor = actor({ systemRole: "ADMIN" });
        const capability = "stock.request.create";
        const configuredDecision = resolveConfigured(adminActor, capability);

        expect(() => composeAuthorizationAuthority(
            adminActor,
            capability,
            ["ALL"],
            configuredDecision,
        )).toThrowError(
            expect.objectContaining({
                name: "AuthorizationConfigurationError",
                code: "UNSUPPORTED_DEFAULT_SCOPE",
            }),
        );
    });

    it("keeps ADMIN structural channel denial denied", () => {
        const adminActor = actor({
            systemRole: "ADMIN",
            channel: "LIFF_SELF_SERVICE",
        });
        const capability = "employee.read";
        const configuredDecision = resolveConfigured(adminActor, capability);

        const composed = composeAuthorizationAuthority(
            adminActor,
            capability,
            ["ALL"],
            configuredDecision,
        );

        expect(composed.allowed).toBe(false);
        expect(composed.scopes).toEqual([]);
    });

    it("returns immutable composition collections and result", () => {
        const currentActor = actor();
        const configuredDecision = resolveConfigured(
            currentActor,
            CAPABILITY,
            resolution({ userGrants: [userGrant("CREATED")] }),
        );

        const composed = composeAuthorizationAuthority(
            currentActor,
            CAPABILITY,
            ["ASSIGNED"],
            configuredDecision,
        );

        expect(Object.isFrozen(composed)).toBe(true);
        expect(Object.isFrozen(composed.scopes)).toBe(true);
        expect(Object.isFrozen(composed.defaultScopes)).toBe(true);
        expect(Object.isFrozen(composed.configuredGrants)).toBe(true);
        expect(Object.isFrozen(composed.configuredDecision)).toBe(true);
    });
});
