import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationPersistenceContext,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";
import type * as AuthorizationModule from "@/modules/authorization";

import {
    buildRoutineAuthorizationActor,
    buildRoutineOccurrenceScope,
    buildRoutineTaskScope,
    assertActiveEmployeesInTransaction,
    assertActiveRoutineActorInTransaction,
    defaultRoutineScopes,
    resolveRoutineCapability,
    resolveRoutineCapabilityInTransaction,
    type RoutineCapability,
} from "./authorization";
import type { RoutineCommandActor } from "./types";

const mocks = vi.hoisted(() => ({
    resolve: vi.fn(),
    resolveInTransaction: vi.fn(),
    lockEmployeeRows: vi.fn(),
    lockUserRows: vi.fn(),
}));

vi.mock("@/modules/authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationModule>();
    return {
        ...actual,
        authorization: {
            ...actual.authorization,
            resolve: mocks.resolve,
            resolveInTransaction: mocks.resolveInTransaction,
        },
    };
});

vi.mock("@/lib/db/row-locks", () => ({
    lockEmployeeRows: mocks.lockEmployeeRows,
    lockUserRows: mocks.lockUserRows,
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
    capability: RoutineCapability,
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
    capability: RoutineCapability,
    scope: AuthorizationScope,
): EffectiveAuthorizationGrant {
    return {
        capability,
        scope,
        source: { type: "USER", userId: 7 },
    };
}

function systemRoleGrant(
    capability: RoutineCapability,
): EffectiveAuthorizationGrant {
    return {
        capability,
        scope: "ALL",
        source: { type: "SYSTEM_ROLE", role: "ADMIN" },
    };
}

describe("Routine authorization adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
        mocks.resolveInTransaction.mockReset();
        mocks.lockEmployeeRows.mockReset();
        mocks.lockUserRows.mockReset();
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

    it("rebuilds a stale Dashboard ADMIN route actor from the current persisted USER role", async () => {
        const tx = {
            user: {
                findUnique: vi.fn().mockResolvedValue({
                    id: 7,
                    role: "USER",
                    isActive: true,
                    deletedAt: null,
                    employee: {
                        id: 21,
                        status: "ACTIVE",
                        deletedAt: null,
                    },
                }),
            },
        } as unknown as Prisma.TransactionClient;
        const routeActor = actor({ role: "ADMIN" });

        const result = await assertActiveRoutineActorInTransaction(
            tx,
            routeActor,
        );

        expect(routeActor.role).toBe("ADMIN");
        expect(result.authorizationActor).toEqual({
            userId: 7,
            employeeId: 21,
            systemRole: "USER",
            channel: "DASHBOARD",
        });
        expect(result.authorizationActor.systemRole).not.toBe(routeActor.role);
    });

    it("uses the revalidated Routine actor for the final capability decision", async () => {
        const tx = {
            user: {
                findUnique: vi.fn().mockResolvedValue({
                    id: 7,
                    role: "USER",
                    isActive: true,
                    deletedAt: null,
                    employee: {
                        id: 21,
                        status: "ACTIVE",
                        deletedAt: null,
                    },
                }),
            },
        } as unknown as Prisma.TransactionClient & AuthorizationPersistenceContext;
        const routeActor = actor({ role: "ADMIN" });
        mocks.resolveInTransaction.mockImplementation(
            async (
                authorizationActor: AuthorizationActor,
            ): Promise<AuthorizationDecision> =>
                authorizationActor.systemRole === "ADMIN"
                    ? decision(
                        "routine.occurrence.override",
                        true,
                        ["ALL"],
                        undefined,
                        [systemRoleGrant("routine.occurrence.override")],
                    )
                    : decision(
                        "routine.occurrence.override",
                        false,
                        [],
                        "NO_APPLICABLE_GRANT",
                    ),
        );

        const activeActor = await assertActiveRoutineActorInTransaction(
            tx,
            routeActor,
        );

        await expect(
            resolveRoutineCapabilityInTransaction(
                tx,
                activeActor,
                "routine.occurrence.override",
            ),
        ).rejects.toMatchObject({
            authorizationReason: "NO_APPLICABLE_GRANT",
            statusCode: 403,
        });
        expect(mocks.resolveInTransaction).toHaveBeenCalledWith(
            activeActor.authorizationActor,
            "routine.occurrence.override",
            tx,
        );
        expect(activeActor.authorizationActor.systemRole).toBe("USER");
        expect(activeActor.authorizationActor.systemRole).not.toBe(
            routeActor.role,
        );
    });

    it("composes the permanent USER default policy when no grant exists", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.task.update",
                false,
                [],
                "NO_APPLICABLE_GRANT",
            ),
        );

        const result = await resolveRoutineCapability(
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
        expect(result.defaultScopes).toEqual(["CREATED", "ASSIGNED"]);
        expect(result.hasBroadAuthority).toBe(false);
    });

    it("does not let a narrow configured grant shrink the default policy", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.task.update",
                true,
                ["CREATED"],
                undefined,
                [userGrant("routine.task.update", "CREATED")],
            ),
        );

        const result = await resolveRoutineCapability(
            actor(),
            21,
            "routine.task.update",
        );

        expect(result.scopes).toEqual(["CREATED", "ASSIGNED"]);
        expect(result.defaultScopes).toEqual(["CREATED", "ASSIGNED"]);
        expect(result.decision.grants).toEqual([
            userGrant("routine.task.update", "CREATED"),
        ]);
    });

    it("does not turn a requested task view scope into an ALL resolver grant", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.task.read",
                true,
                ["ASSIGNED"],
                undefined,
                [userGrant("routine.task.read", "ASSIGNED")],
            ),
        );

        const result = await resolveRoutineCapability(
            actor(),
            21,
            "routine.task.read",
            { taskReadView: "work-item", requestedScope: "all" },
        );

        expect(result.actor).toEqual({
            userId: 7,
            employeeId: 21,
            systemRole: "USER",
            channel: "DASHBOARD",
        });
        expect(result.scopes).toEqual(["CREATED", "ASSIGNED"]);
        expect(result.defaultScopes).toEqual(["CREATED", "ASSIGNED"]);
        expect(mocks.resolve).toHaveBeenCalledWith(
            result.actor,
            "routine.task.read",
        );
    });

    it("composes broader configured Routine grants without losing their provenance", async () => {
        const cases = [
            {
                capability: "routine.task.read" as const,
                options: { taskReadView: "management" } as const,
                configuredScopes: ["ALL"] as const,
                expectedScopes: ["ALL"] as const,
            },
            {
                capability: "routine.task.update" as const,
                options: {},
                configuredScopes: ["ALL"] as const,
                expectedScopes: ["ALL"] as const,
            },
            {
                capability: "routine.task.delete" as const,
                options: {},
                configuredScopes: ["ALL"] as const,
                expectedScopes: ["ALL"] as const,
            },
            {
                capability: "routine.occurrence.read" as const,
                options: {},
                configuredScopes: ["ALL"] as const,
                expectedScopes: ["ALL"] as const,
            },
        ];

        for (const testCase of cases) {
            mocks.resolve.mockResolvedValueOnce(
                decision(
                    testCase.capability,
                    true,
                    testCase.configuredScopes,
                    undefined,
                    [userGrant(testCase.capability, "ALL")],
                ),
            );
            const result = await resolveRoutineCapability(
                actor(),
                21,
                testCase.capability,
                testCase.options,
            );
            expect(result.scopes).toEqual(testCase.expectedScopes);
            expect(result.decision.grants).toEqual([
                userGrant(testCase.capability, "ALL"),
            ]);
            expect(result.hasBroadAuthority).toBe(true);
        }
    });

    it("applies the context-sensitive task-read default policy", async () => {
        const cases = [
            {
                label: "management view",
                options: { taskReadView: "management" } as const,
                scopes: ["CREATED", "ASSIGNED"] as const,
            },
            {
                label: "work-item mine view",
                options: {
                    taskReadView: "work-item",
                    requestedScope: "mine",
                } as const,
                scopes: ["ASSIGNED"] as const,
            },
            {
                label: "work-item all view",
                options: {
                    taskReadView: "work-item",
                    requestedScope: "all",
                } as const,
                scopes: ["CREATED", "ASSIGNED"] as const,
            },
        ];

        for (const testCase of cases) {
            mocks.resolve.mockResolvedValueOnce(
                decision(
                    "routine.task.read",
                    false,
                    [],
                    "NO_APPLICABLE_GRANT",
                ),
            );

            const result = await resolveRoutineCapability(
                actor(),
                21,
                "routine.task.read",
                testCase.options,
            );

            expect(result.scopes, testCase.label).toEqual(testCase.scopes);
            expect(result.defaultScopes, testCase.label).toEqual(testCase.scopes);
        }
    });

    it("applies the complete permanent Routine default-policy matrix", async () => {
        const cases = [
            {
                capability: "routine.task.read" as const,
                options: { taskReadView: "management" } as const,
                scopes: ["CREATED", "ASSIGNED"] as const,
            },
            {
                capability: "routine.task.read" as const,
                options: {
                    taskReadView: "work-item",
                    requestedScope: "mine",
                } as const,
                scopes: ["ASSIGNED"] as const,
            },
            {
                capability: "routine.task.read" as const,
                options: {
                    taskReadView: "work-item",
                    requestedScope: "all",
                } as const,
                scopes: ["CREATED", "ASSIGNED"] as const,
            },
            {
                capability: "routine.task.create" as const,
                options: {},
                scopes: ["OWN"] as const,
            },
            {
                capability: "routine.task.update" as const,
                options: {},
                scopes: ["CREATED", "ASSIGNED"] as const,
            },
            {
                capability: "routine.task.delete" as const,
                options: {},
                scopes: ["CREATED"] as const,
            },
            {
                capability: "routine.occurrence.read" as const,
                options: {},
                scopes: ["ASSIGNED"] as const,
            },
            {
                capability: "routine.task.export" as const,
                options: {},
                scopes: [] as const,
            },
            {
                capability: "routine.summary.read" as const,
                options: { summaryView: "mine" } as const,
                scopes: ["ASSIGNED"] as const,
            },
            {
                capability: "routine.summary.read" as const,
                options: { summaryView: "all" } as const,
                scopes: ["ASSIGNED"] as const,
            },
            {
                capability: "routine.reference.read" as const,
                options: {},
                scopes: ["OWN"] as const,
            },
        ];

        for (const testCase of cases) {
            for (const role of ["USER", "ADMIN"] as const) {
                mocks.resolve.mockResolvedValueOnce(
                    decision(testCase.capability, false, [], "NO_APPLICABLE_GRANT"),
                );
                const result = resolveRoutineCapability(
                    actor({ role }),
                    21,
                    testCase.capability,
                    testCase.options,
                );
                if (testCase.scopes.length === 0) {
                    await expect(result).rejects.toMatchObject({
                        authorizationReason: "NO_APPLICABLE_GRANT",
                        statusCode: 403,
                    });
                    continue;
                }
                const resolved = await result;
                expect(resolved.defaultScopes).toEqual(testCase.scopes);
                expect(resolved.scopes).toEqual(testCase.scopes);
            }
        }
    });

    it("keeps task-read defaults role-neutral when the requested view is all", () => {
        const userActor = buildRoutineAuthorizationActor(actor(), 21);
        const adminActor = buildRoutineAuthorizationActor(actor({ role: "ADMIN" }), 21);

        expect(
            defaultRoutineScopes(userActor, "routine.task.read", {
                taskReadView: "work-item",
                requestedScope: "all",
            }),
        ).toEqual(["CREATED", "ASSIGNED"]);
        expect(
            defaultRoutineScopes(adminActor, "routine.task.read", {
                taskReadView: "work-item",
                requestedScope: "all",
            }),
        ).toEqual(["CREATED", "ASSIGNED"]);
    });

    it("does not bridge a structural task-read denial into work-item ALL", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.task.read",
                false,
                [],
                "CHANNEL_NOT_SUPPORTED",
            ),
        );

        await expect(
            resolveRoutineCapability(
                actor(),
                21,
                "routine.task.read",
                { taskReadView: "work-item", requestedScope: "all" },
            ),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("never converts a structural channel denial into default access", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.occurrence.read",
                false,
                [],
                "CHANNEL_NOT_SUPPORTED",
            ),
        );

        await expect(
            resolveRoutineCapability(
                actor({ mode: "LIFF_SELF_SERVICE" }),
                21,
                "routine.occurrence.read",
            ),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("does not provide a USER default for occurrence administration or import", async () => {
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
                resolveRoutineCapability(actor(), 21, capability),
            ).rejects.toMatchObject({ statusCode: 403 });
        }
    });

    it.each([
        "routine.occurrence.override",
        "routine.occurrence.reassign",
        "routine.occurrence.change_due_date",
        "routine.import.manage",
    ] as const)("denies revoked central-only capability %s in a transaction", async (capability) => {
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
            decision(capability, false, [], "NO_APPLICABLE_GRANT"),
        );

        await expect(
            resolveRoutineCapabilityInTransaction(
                persistenceContext,
                activeActor,
                capability,
            ),
        ).rejects.toMatchObject({
            authorizationReason: "NO_APPLICABLE_GRANT",
            statusCode: 403,
        });
    });

    it("accepts a configured import grant without creating a USER default", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.import.manage",
                true,
                ["ALL"],
                undefined,
                [userGrant("routine.import.manage", "ALL")],
            ),
        );

        const result = await resolveRoutineCapability(
            actor(),
            null,
            "routine.import.manage",
        );

        expect(result.scopes).toEqual(["ALL"]);
        expect(result.defaultScopes).toEqual([]);
        expect(result.hasBroadAuthority).toBe(true);
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

        const result = await resolveRoutineCapability(
            actor({ role: "ADMIN", mode: "LIFF_SELF_SERVICE" }),
            42,
            "routine.task.update",
        );

        expect(result.actor.channel).toBe("LIFF_SELF_SERVICE");
        expect(result.scopes).toEqual(["CREATED", "ASSIGNED"]);
        expect(result.hasBroadAuthority).toBe(false);
        expect(result.liffSelfServicePolicyApplied).toBe(true);
    });

    it.each([
        {
            capability: "routine.task.read" as const,
            options: {
                taskReadView: "work-item",
                requestedScope: "all",
            } as const,
            expectedScopes: ["CREATED", "ASSIGNED"] as const,
        },
        {
            capability: "routine.summary.read" as const,
            options: { summaryView: "all" } as const,
            expectedScopes: ["ASSIGNED"] as const,
        },
        {
            capability: "routine.reference.read" as const,
            options: {} as const,
            expectedScopes: ["OWN"] as const,
        },
    ])("clamps LIFF %s to its self-service policy even with configured ALL", async ({ capability, options, expectedScopes }) => {
        mocks.resolve.mockResolvedValue(
            decision(
                capability,
                true,
                ["ALL"],
                undefined,
                [userGrant(capability, "ALL")],
            ),
        );

        const result = await resolveRoutineCapability(
            actor({ mode: "LIFF_SELF_SERVICE" }),
            21,
            capability,
            options,
        );

        expect(result.scopes).toEqual(expectedScopes);
        expect(result.hasBroadAuthority).toBe(false);
        expect(result.liffSelfServicePolicyApplied).toBe(true);
    });

    it("keeps export unavailable on the LIFF channel even when the actor is an ADMIN", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.task.export",
                false,
                [],
                "CHANNEL_NOT_SUPPORTED",
            ),
        );

        await expect(
            resolveRoutineCapability(
                actor({ role: "ADMIN", mode: "LIFF_SELF_SERVICE" }),
                21,
                "routine.task.export",
            ),
        ).rejects.toMatchObject({
            authorizationReason: "CHANNEL_NOT_SUPPORTED",
            statusCode: 403,
        });
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

        const result = await resolveRoutineCapability(
            actor({ id: 99, role: "ADMIN" }),
            null,
            "routine.occurrence.override",
        );

        expect(result.hasBroadAuthority).toBe(true);
        expect(result.scopes).toEqual(["ALL"]);
    });

    it("does not assign a Routine export default to Dashboard ADMIN", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.task.export",
                true,
                ["ALL"],
                undefined,
                [systemRoleGrant("routine.task.export")],
            ),
        );

        const result = await resolveRoutineCapability(
            actor({ id: 99, role: "ADMIN" }),
            null,
            "routine.task.export",
        );

        expect(result.defaultScopes).toEqual([]);
        expect(result.scopes).toEqual(["ALL"]);
        expect(result.hasBroadAuthority).toBe(true);
    });

    it("requires configured ALL for a regular-user Routine export", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "routine.task.export",
                false,
                [],
                "NO_APPLICABLE_GRANT",
            ),
        );

        await expect(
            resolveRoutineCapability(actor(), 21, "routine.task.export"),
        ).rejects.toMatchObject({
            authorizationReason: "NO_APPLICABLE_GRANT",
            statusCode: 403,
        });

        mocks.resolve.mockResolvedValue(
            decision(
                "routine.task.export",
                true,
                ["ALL"],
                undefined,
                [userGrant("routine.task.export", "ALL")],
            ),
        );

        const result = await resolveRoutineCapability(
            actor(),
            21,
            "routine.task.export",
        );

        expect(result.defaultScopes).toEqual([]);
        expect(result.scopes).toEqual(["ALL"]);
        expect(result.hasBroadAuthority).toBe(true);
    });

    it("does not convert authorization configuration errors into default access", async () => {
        const configurationError = new Error("invalid persisted capability");
        mocks.resolve.mockRejectedValue(configurationError);

        await expect(
            resolveRoutineCapability(
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
        expect(result.defaultScopes).toEqual(["CREATED"]);
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

    it("fails closed for a TEAM scope without a Routine-owned Team predicate", () => {
        expect(buildRoutineTaskScope(7, 21, ["TEAM"])).toEqual({
            id: { in: [] },
        });
        expect(buildRoutineOccurrenceScope(21, ["TEAM"])).toEqual({
            id: { in: [] },
        });
    });

    it("locks target Employees before accepting a new active-assignee set", async () => {
        const steps: string[] = [];
        const tx = {
            employee: {
                findMany: vi.fn().mockImplementation(async () => {
                    steps.push("re-read");
                    return [{ id: 21 }, { id: 42 }];
                }),
            },
        } as never;
        mocks.lockEmployeeRows.mockImplementation(async () => {
            steps.push("lock");
        });

        await assertActiveEmployeesInTransaction(tx, [42, 21, 42]);

        expect(mocks.lockEmployeeRows).toHaveBeenCalledWith(tx, [42, 21]);
        expect(steps).toEqual(["lock", "re-read"]);
    });
});
