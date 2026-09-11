import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationPersistenceContext,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";

import {
    buildRoutineAuthorizationActor,
    buildRoutineOccurrenceScope,
    buildRoutineTaskScope,
    resolveRoutineCapabilityForMigration,
    resolveRoutineCapabilityInTransaction,
    type RoutineMigratedCapability,
} from "./authorization";
import type { RoutineCommandActor } from "./types";

const mocks = vi.hoisted(() => ({
    resolve: vi.fn(),
    resolveInTransaction: vi.fn(),
}));

vi.mock("@/modules/authorization", () => ({
    authorization: {
        resolve: mocks.resolve,
        resolveInTransaction: mocks.resolveInTransaction,
    },
}));

function actor(
    overrides: Partial<RoutineCommandActor> = {},
): RoutineCommandActor {
    return {
        id: 7,
        role: "USER",
        email: "user@example.com",
        ...overrides,
    };
}

function decision(
    capability: RoutineMigratedCapability,
    allowed: boolean,
    scopes: readonly AuthorizationScope[] = [],
    reason?: AuthorizationDecision["reason"],
    grants: readonly EffectiveAuthorizationGrant[] = [],
): AuthorizationDecision {
    return {
        capability,
        allowed,
        scopes,
        grants,
        ...(reason ? { reason } : {}),
    };
}

function userGrant(
    capability: RoutineMigratedCapability,
    scope: AuthorizationScope,
): EffectiveAuthorizationGrant {
    return {
        capability,
        scope,
        source: { type: "USER", userId: 7 },
    };
}

function systemRoleGrant(
    capability: RoutineMigratedCapability,
): EffectiveAuthorizationGrant {
    return {
        capability,
        scope: "ALL",
        source: { type: "SYSTEM_ROLE", role: "ADMIN" },
    };
}

describe("Routine authorization migration adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
        mocks.resolveInTransaction.mockReset();
    });

    it("maps Dashboard and LIFF actors without changing the server-derived identity", () => {
        expect(buildRoutineAuthorizationActor(actor(), 21)).toEqual({
            userId: 7,
            employeeId: 21,
            systemRole: "USER",
            channel: "DASHBOARD",
        } satisfies AuthorizationActor);
        expect(buildRoutineAuthorizationActor(
            actor({ id: 8, role: "ADMIN", mode: "LIFF_SELF_SERVICE" }),
            42,
        )).toEqual({
            userId: 8,
            employeeId: 42,
            systemRole: "ADMIN",
            channel: "LIFF_SELF_SERVICE",
        } satisfies AuthorizationActor);
    });

    it("uses the public resolver and applies only the frozen USER task bridge when no grant exists", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.task.update",
                false,
                [],
                "NO_APPLICABLE_GRANT",
            ),
        );

        const result = await resolveRoutineCapabilityForMigration(
            actor(),
            21,
            "routine.task.update",
        );

        expect(mocks.resolve).toHaveBeenCalledWith(
            {
                userId: 7,
                employeeId: 21,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            "routine.task.update",
        );
        expect(result.scopes).toEqual(["CREATED", "ASSIGNED"]);
        expect(result.usedMigrationCompatibility).toBe(true);
        expect(result.isAdministrative).toBe(false);
    });

    it("does not replace a configured grant with compatibility scopes", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.task.update",
                true,
                ["CREATED"],
                undefined,
                [userGrant("routine.task.update", "CREATED")],
            ),
        );

        const result = await resolveRoutineCapabilityForMigration(
            actor(),
            21,
            "routine.task.update",
        );

        expect(result.scopes).toEqual(["CREATED"]);
        expect(result.usedMigrationCompatibility).toBe(false);
        expect(result.decision.grants).toEqual([
            userGrant("routine.task.update", "CREATED"),
        ]);
    });

    it("never converts a structural channel denial into migration access", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.occurrence.read",
                false,
                [],
                "CHANNEL_NOT_SUPPORTED",
            ),
        );

        await expect(
            resolveRoutineCapabilityForMigration(
                actor({ mode: "LIFF_SELF_SERVICE" }),
                21,
                "routine.occurrence.read",
            ),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("does not provide USER compatibility for occurrence administration or import", async () => {
        for (const capability of [
            "routine.occurrence.override",
            "routine.occurrence.reassign",
            "routine.occurrence.change_due_date",
            "routine.import.manage",
        ] as const) {
            mocks.resolve.mockResolvedValueOnce(
                decision(capability, false, [], "NO_APPLICABLE_GRANT"),
            );

            await expect(
                resolveRoutineCapabilityForMigration(actor(), 21, capability),
            ).rejects.toMatchObject({ statusCode: 403 });
        }
    });

    it("accepts a configured import grant without using the compatibility bridge", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.import.manage",
                true,
                ["ALL"],
                undefined,
                [userGrant("routine.import.manage", "ALL")],
            ),
        );

        const result = await resolveRoutineCapabilityForMigration(
            actor(),
            null,
            "routine.import.manage",
        );

        expect(result.scopes).toEqual(["ALL"]);
        expect(result.usedMigrationCompatibility).toBe(false);
        expect(result.isAdministrative).toBe(false);
    });

    it("clamps a LIFF ADMIN system-role result to Routine self-service scopes", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.task.update",
                true,
                ["ALL"],
                undefined,
                [systemRoleGrant("routine.task.update")],
            ),
        );

        const result = await resolveRoutineCapabilityForMigration(
            actor({ role: "ADMIN", mode: "LIFF_SELF_SERVICE" }),
            42,
            "routine.task.update",
        );

        expect(result.actor.channel).toBe("LIFF_SELF_SERVICE");
        expect(result.scopes).toEqual(["CREATED", "ASSIGNED"]);
        expect(result.isAdministrative).toBe(false);
        expect(result.usedLiffSelfServiceCompatibility).toBe(true);
    });

    it("keeps Dashboard ADMIN system-role authorization administrative", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.occurrence.override",
                true,
                ["ALL"],
                undefined,
                [systemRoleGrant("routine.occurrence.override")],
            ),
        );

        const result = await resolveRoutineCapabilityForMigration(
            actor({ id: 99, role: "ADMIN" }),
            null,
            "routine.occurrence.override",
        );

        expect(result.isAdministrative).toBe(true);
        expect(result.scopes).toEqual(["ALL"]);
    });

    it("does not convert authorization configuration errors into compatibility access", async () => {
        const configurationError = new Error("invalid persisted capability");
        mocks.resolve.mockRejectedValue(configurationError);

        await expect(
            resolveRoutineCapabilityForMigration(
                actor(),
                21,
                "routine.task.read",
            ),
        ).rejects.toBe(configurationError);
    });

    it("passes the transaction persistence context through the public resolver seam", async () => {
        const persistenceContext = {} as AuthorizationPersistenceContext;
        const activeActor = {
            authorizationActor: {
                userId: 7,
                employeeId: 21,
                systemRole: "USER",
                channel: "DASHBOARD",
            } satisfies AuthorizationActor,
            employeeId: 21,
        };
        mocks.resolveInTransaction.mockResolvedValue(
            decision("routine.task.delete", true, ["CREATED"], undefined, [
                userGrant("routine.task.delete", "CREATED"),
            ]),
        );

        const result = await resolveRoutineCapabilityInTransaction(
            persistenceContext,
            activeActor,
            "routine.task.delete",
        );

        expect(mocks.resolveInTransaction).toHaveBeenCalledWith(
            activeActor.authorizationActor,
            "routine.task.delete",
            persistenceContext,
        );
        expect(result.scopes).toEqual(["CREATED"]);
    });
});

describe("Routine authorization scope translation", () => {
    it("translates task scopes into query predicates", () => {
        expect(buildRoutineTaskScope(7, 21, ["CREATED"])).toEqual({
            createdById: 7,
        });
        expect(buildRoutineTaskScope(7, 21, ["ASSIGNED"])).toEqual({
            assignees: { some: { employeeId: 21 } },
        });
        expect(buildRoutineTaskScope(7, 21, ["CREATED", "ASSIGNED"])).toEqual({
            OR: [
                { createdById: 7 },
                { assignees: { some: { employeeId: 21 } } },
            ],
        });
        expect(buildRoutineTaskScope(7, 21, ["ALL"])).toEqual({});
    });

    it("keeps occurrence assignment distinct from task assignment", () => {
        expect(buildRoutineOccurrenceScope(21, ["ASSIGNED"])).toEqual({
            assignees: { some: { employeeId: 21 } },
        });
        expect(buildRoutineOccurrenceScope(21, ["ALL"])).toEqual({});
        expect(buildRoutineOccurrenceScope(21, ["CREATED"])).toEqual({
            id: { in: [] },
        });
    });
});
