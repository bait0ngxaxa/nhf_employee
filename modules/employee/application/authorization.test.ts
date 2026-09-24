import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";
import type * as AuthorizationModule from "@/modules/authorization";
import { AuthorizationConfigurationError } from "@/modules/authorization";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";

import {
    assertEmployeeCapability,
    assertEmployeeCapabilityScope,
    buildEmployeeAuthorizationContext,
    buildEmployeeAuthorizedCommandActor,
    defaultEmployeeScopes,
    EmployeeCapabilityDeniedError,
    EMPLOYEE_CAPABILITIES,
    resolveEmployeeCapability,
    resolveEmployeeCapabilityInTransaction,
} from "./authorization";

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

function context(
    role: "ADMIN" | "USER" = "USER",
    employeeId: number | null = null,
): ReturnType<typeof buildEmployeeAuthorizationContext> {
    return buildEmployeeAuthorizationContext({ id: 7, role }, employeeId);
}

function commandActor(
    role: "ADMIN" | "USER" = "USER",
): ReturnType<typeof buildEmployeeAuthorizedCommandActor> {
    return buildEmployeeAuthorizedCommandActor({
        id: 7,
        role,
        email: "actor@thainhf.org",
    });
}

function decision(
    capability: string,
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
    capability: string,
    scope: AuthorizationScope,
): EffectiveAuthorizationGrant {
    return {
        capability: capability as EffectiveAuthorizationGrant["capability"],
        scope,
        source: { type: "USER", userId: 7 },
    };
}

function activeUser(
    role: "ADMIN" | "USER" = "USER",
    employeeId = 21,
    employeeStatus = "ACTIVE",
    employeeDeletedAt: Date | null = null,
): {
    id: number;
    role: string;
    isActive: boolean;
    deletedAt: null;
    employeeId: number;
    employee: { id: number; status: string; deletedAt: Date | null };
} {
    return {
        id: 7,
        role,
        isActive: true,
        deletedAt: null,
        employeeId,
        employee: {
            id: employeeId,
            status: employeeStatus,
            deletedAt: employeeDeletedAt,
        },
    };
}

describe("Employee authorization adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
        mocks.resolveInTransaction.mockReset();
        mocks.lockEmployeeRows.mockReset();
        mocks.lockUserRows.mockReset();
    });

    it("keeps the registered inventory and fixed Dashboard actor mapping explicit", () => {
        expect(EMPLOYEE_CAPABILITIES).toEqual([
            "employee.read",
            "employee.stats.read",
            "employee.create",
            "employee.update",
            "employee.delete",
            "employee.import",
            "employee.export",
        ]);
        expect(context().authorizationActor).toEqual({
            userId: 7,
            employeeId: null,
            systemRole: "USER",
            channel: "DASHBOARD",
        } satisfies AuthorizationActor);
    });

    it.each([
        "employee.read",
        "employee.stats.read",
        "employee.export",
    ] as const)("uses the permanent ALL default for an ungranted USER %s", async (capability) => {
        mocks.resolve.mockResolvedValue(
            decision(capability, false, [], "NO_APPLICABLE_GRANT"),
        );

        const result = await resolveEmployeeCapability(
            context(),
            capability,
        );

        expect(result.decision.reason).toBe("NO_APPLICABLE_GRANT");
        expect(result.defaultScopes).toEqual(["ALL"]);
        expect(result.scopes).toEqual(["ALL"]);
    });

    it.each(EMPLOYEE_CAPABILITIES)(
        "keeps the Employee default policy independent from systemRole for %s",
        async (capability) => {
            const expectedScopes = defaultEmployeeScopes(capability);
            const noGrant = decision(
                capability,
                false,
                [],
                "NO_APPLICABLE_GRANT",
            );

            mocks.resolve.mockResolvedValue(noGrant);
            const userResult = resolveEmployeeCapability(
                context("USER"),
                capability,
            );
            mocks.resolve.mockResolvedValue(noGrant);
            const adminResult = resolveEmployeeCapability(
                context("ADMIN"),
                capability,
            );

            if (expectedScopes.length === 0) {
                await expect(userResult).rejects.toMatchObject({
                    authorizationReason: "NO_APPLICABLE_GRANT",
                });
                await expect(adminResult).rejects.toMatchObject({
                    authorizationReason: "NO_APPLICABLE_GRANT",
                });
                return;
            }

            const [user, admin] = await Promise.all([userResult, adminResult]);
            expect(user.defaultScopes).toEqual(expectedScopes);
            expect(admin.defaultScopes).toEqual(expectedScopes);
            expect(admin.scopes).toEqual(user.scopes);
        },
    );

    it.each([
        "employee.create",
        "employee.update",
        "employee.delete",
        "employee.import",
    ] as const)("does not put ADMIN authority in the default policy for %s", async (capability) => {
        mocks.resolve.mockResolvedValue(
            decision(
                capability,
                true,
                ["ALL"],
                undefined,
                [{
                    capability: capability as EffectiveAuthorizationGrant["capability"],
                    scope: "ALL",
                    source: { type: "USER", userId: 7 },
                }],
            ),
        );

        const result = await resolveEmployeeCapability(
            context("ADMIN"),
            capability,
        );

        expect(result.defaultScopes).toEqual([]);
        expect(result.scopes).toEqual(["ALL"]);
        expect(result.decision.grants[0]?.source).toEqual({
            type: "USER",
            userId: 7,
        });
    });

    it.each([
        "employee.create",
        "employee.update",
        "employee.delete",
        "employee.import",
    ] as const)("does not grant %s to an ungranted USER", async (capability) => {
        mocks.resolve.mockResolvedValue(
            decision(capability, false, [], "NO_APPLICABLE_GRANT"),
        );

        await expect(
            resolveEmployeeCapability(context(), capability),
        ).rejects.toMatchObject({
            capability,
            authorizationReason: "NO_APPLICABLE_GRANT",
            statusCode: 403,
        });
    });

    it.each(EMPLOYEE_CAPABILITIES)(
        "honors an explicit USER grant for %s without role promotion",
        async (capability) => {
            mocks.resolve.mockResolvedValue(
                decision(
                    capability,
                    true,
                    ["ALL"],
                    undefined,
                    [userGrant(capability, "ALL")],
                ),
            );

            const result = await resolveEmployeeCapability(
                context(),
                capability,
            );

            expect(result.actor.systemRole).toBe("USER");
            expect(result.scopes).toEqual(["ALL"]);
            expect(result.defaultScopes).toEqual(
                capability === "employee.read"
                || capability === "employee.stats.read"
                || capability === "employee.export"
                    ? ["ALL"]
                    : [],
            );
            expect(assertEmployeeCapabilityScope(result, "ALL")).toBe(result);
        },
    );

    it("keeps the read baseline when a configured grant is added and removed", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision("employee.read", false, [], "NO_APPLICABLE_GRANT"),
            )
            .mockResolvedValueOnce(
                decision(
                    "employee.read",
                    true,
                    ["ALL"],
                    undefined,
                    [userGrant("employee.read", "ALL")],
                ),
            )
            .mockResolvedValueOnce(
                decision("employee.read", false, [], "NO_APPLICABLE_GRANT"),
            );

        const beforeGrant = await resolveEmployeeCapability(
            context(),
            "employee.read",
        );
        const withGrant = await resolveEmployeeCapability(
            context(),
            "employee.read",
        );
        const afterGrantRemoval = await resolveEmployeeCapability(
            context(),
            "employee.read",
        );

        expect(beforeGrant).toMatchObject({
            defaultScopes: ["ALL"],
            scopes: ["ALL"],
            decision: { grants: [] },
        });
        expect(withGrant).toMatchObject({
            defaultScopes: ["ALL"],
            scopes: ["ALL"],
            decision: { grants: [userGrant("employee.read", "ALL")] },
        });
        expect(afterGrantRemoval).toMatchObject({
            defaultScopes: ["ALL"],
            scopes: ["ALL"],
            decision: { grants: [] },
        });
    });

    it("fails closed for structural denials and propagates resolver failures", async () => {
        for (const reason of ["UNKNOWN_CAPABILITY", "CHANNEL_NOT_SUPPORTED"] as const) {
            mocks.resolve.mockResolvedValue(
                decision("employee.read", false, [], reason),
            );

            await expect(
                resolveEmployeeCapability(
                    context("ADMIN"),
                    "employee.read",
                ),
            ).rejects.toMatchObject({
                authorizationReason: reason,
                statusCode: 403,
            });
        }

        const resolverFailure = new Error("resolver persistence failure");
        mocks.resolve.mockRejectedValue(resolverFailure);
        await expect(
            resolveEmployeeCapability(context(), "employee.read"),
        ).rejects.toBe(resolverFailure);

        const configurationError = new AuthorizationConfigurationError(
            "UNSUPPORTED_PERSISTED_SCOPE",
            "unsupported configured scope",
        );
        mocks.resolve.mockRejectedValue(configurationError);
        await expect(
            resolveEmployeeCapability(context(), "employee.read"),
        ).rejects.toBe(configurationError);

        mocks.resolve.mockResolvedValue(
            decision("employee.stats.read", true, ["ALL"]),
        );
        await expect(
            resolveEmployeeCapability(context(), "employee.read"),
        ).rejects.toMatchObject({
            name: "AuthorizationConfigurationError",
            code: "CAPABILITY_MISMATCH",
        });

        mocks.resolve.mockResolvedValue(
            decision("employee.unknown", false, [], "UNKNOWN_CAPABILITY"),
        );
        await expect(
            resolveEmployeeCapability(context(), "employee.unknown"),
        ).rejects.toMatchObject({
            capability: "employee.unknown",
            authorizationReason: "UNKNOWN_CAPABILITY",
            statusCode: 403,
        });
    });

    it("requires ALL scope after the resolver decision", async () => {
        mocks.resolve.mockResolvedValue(
            decision("employee.update", true, ["OWN"]),
        );

        const result = await assertEmployeeCapability(
            context(),
            "employee.update",
        );

        expect(() => assertEmployeeCapabilityScope(result, "ALL")).toThrow(
            EmployeeCapabilityDeniedError,
        );
    });

    it("re-reads the active workforce actor and resolves inside the transaction", async () => {
        const tx = {
            user: {
                findUnique: vi.fn().mockResolvedValue(activeUser()),
            },
        } as unknown as Prisma.TransactionClient;
        mocks.resolveInTransaction.mockResolvedValue(
            decision(
                "employee.update",
                true,
                ["ALL"],
                undefined,
                [userGrant("employee.update", "ALL")],
            ),
        );

        const result = await resolveEmployeeCapabilityInTransaction(
            tx,
            commandActor("USER"),
            "employee.update",
            21,
        );

        expect(tx.user.findUnique).toHaveBeenCalledTimes(2);
        expect(mocks.lockUserRows).toHaveBeenCalledWith(tx, [7]);
        expect(mocks.lockEmployeeRows).toHaveBeenCalledWith(tx, [21]);
        expect(mocks.lockEmployeeRows.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.lockUserRows.mock.invocationCallOrder[0],
        );
        expect(mocks.resolveInTransaction).toHaveBeenCalledWith(
            {
                userId: 7,
                employeeId: 21,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            "employee.update",
            tx,
        );
        expect(result.actor.employeeId).toBe(21);
        expect(result.defaultScopes).toEqual([]);
        expect(result.scopes).toEqual(["ALL"]);
    });

    it("uses the current persisted role when the route-time role is stale", async () => {
        const tx = {
            user: {
                findUnique: vi.fn().mockResolvedValue(activeUser("ADMIN")),
            },
        } as unknown as Prisma.TransactionClient;
        mocks.resolveInTransaction.mockResolvedValue(
            decision(
                "employee.delete",
                true,
                ["ALL"],
                undefined,
                [{
                    capability: "employee.delete",
                    scope: "ALL",
                    source: { type: "USER", userId: 7 },
                }],
            ),
        );

        const result = await resolveEmployeeCapabilityInTransaction(
            tx,
            commandActor("USER"),
            "employee.delete",
            21,
        );

        expect(result.actor.systemRole).toBe("ADMIN");
        expect(result.defaultScopes).toEqual([]);
        expect(result.scopes).toEqual(["ALL"]);
    });

    it.each(["employee.update", "employee.delete"] as const)(
        "denies a transaction-time %s when the configured grant was revoked",
        async (capability) => {
            const tx = {
                user: {
                    findUnique: vi.fn().mockResolvedValue(activeUser()),
                },
            } as unknown as Prisma.TransactionClient;
            mocks.resolveInTransaction.mockResolvedValue(
                decision(capability, false, [], "NO_APPLICABLE_GRANT"),
            );

            await expect(
                resolveEmployeeCapabilityInTransaction(
                    tx,
                    commandActor("USER"),
                    capability,
                    21,
                ),
            ).rejects.toMatchObject({
                capability,
                authorizationReason: "NO_APPLICABLE_GRANT",
                statusCode: 403,
            });
            expect(mocks.resolveInTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 7,
                    employeeId: 21,
                    systemRole: "USER",
                    channel: "DASHBOARD",
                }),
                capability,
                tx,
            );
        },
    );

    it.each([
        ["an inactive account", { ...activeUser(), isActive: false }],
        ["a deleted account", { ...activeUser(), deletedAt: new Date() }],
        ["an inactive Employee", activeUser("USER", 21, "SUSPENDED")],
        ["a deleted Employee", activeUser("USER", 21, "ACTIVE", new Date())],
    ] as const)("fails closed for %s before resolving", async (_label, user) => {
        const tx = {
            user: {
                findUnique: vi.fn().mockResolvedValue(user),
            },
        } as unknown as Prisma.TransactionClient;

        await expect(
            resolveEmployeeCapabilityInTransaction(
                tx,
                commandActor(),
                "employee.update",
                21,
            ),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
        expect(mocks.resolveInTransaction).not.toHaveBeenCalled();
    });
});
