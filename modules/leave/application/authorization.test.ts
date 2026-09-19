import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";
import type * as AuthorizationModule from "@/modules/authorization";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";

import {
    assertLeaveCapabilityScope,
    buildLeaveAuthorizationContext,
    canUseLeaveAdminRecoveryOverride,
    canUseLeaveRecoveryOverride,
    LEAVE_CAPABILITIES,
    resolveLeaveActorInTransaction,
    defaultLeaveScopes,
    resolveLeaveCapability,
    resolveLeaveCapabilityInTransaction,
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
    channel: "DASHBOARD" | "LIFF_SELF_SERVICE" = "DASHBOARD",
    employeeId: number | null = 21,
): ReturnType<typeof buildLeaveAuthorizationContext> {
    return buildLeaveAuthorizationContext(
        { id: 7, role },
        employeeId,
        channel,
    );
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

function systemRoleGrant(
    capability: string,
    scope: AuthorizationScope = "ALL",
): EffectiveAuthorizationGrant {
    return {
        capability: capability as EffectiveAuthorizationGrant["capability"],
        scope,
        source: { type: "SYSTEM_ROLE", role: "ADMIN" },
    };
}

function activeUser(
    role: "ADMIN" | "USER" = "USER",
    employeeId: number | null = 21,
): {
    id: number;
    role: string;
    isActive: boolean;
    deletedAt: null;
    employee: { id: number; status: string; deletedAt: null } | null;
} {
    return {
        id: 7,
        role,
        isActive: true,
        deletedAt: null,
        employee: employeeId === null
            ? null
            : { id: employeeId, status: "ACTIVE", deletedAt: null },
    };
}

describe("Leave authorization adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
        mocks.resolveInTransaction.mockReset();
        mocks.lockEmployeeRows.mockReset();
        mocks.lockUserRows.mockReset();
    });

    it("keeps the registered capability inventory and trusted actor mapping explicit", () => {
        expect(LEAVE_CAPABILITIES).toEqual([
            "leave.request.read",
            "leave.approval.read",
            "leave.request.create",
            "leave.request.cancel",
            "leave.request.approve",
            "leave.cancellation.decide",
            "leave.request.not_taken",
            "leave.approver.manage",
            "leave.recovery.manage",
        ]);
        expect(context().authorizationActor).toEqual({
            userId: 7,
            employeeId: 21,
            systemRole: "USER",
            channel: "DASHBOARD",
        } satisfies AuthorizationActor);
    });

    it.each([
        ["leave.request.read", ["OWN"]],
        ["leave.approval.read", ["ASSIGNED"]],
        ["leave.request.create", ["OWN"]],
        ["leave.request.cancel", ["OWN"]],
        ["leave.request.approve", ["ASSIGNED"]],
        ["leave.cancellation.decide", ["ASSIGNED"]],
        ["leave.request.not_taken", ["OWN", "ASSIGNED"]],
        ["leave.approver.manage", []],
    ] as const)(
        "applies the same role-neutral default policy for %s",
        async (capability, expectedScopes) => {
            expect(defaultLeaveScopes(
                context("USER").authorizationActor,
                capability,
            )).toEqual(expectedScopes);
            expect(defaultLeaveScopes(
                context("ADMIN").authorizationActor,
                capability,
            )).toEqual(expectedScopes);
            mocks.resolve.mockResolvedValue(
                decision(capability, false, [], "NO_APPLICABLE_GRANT"),
            );

            if (expectedScopes.length === 0) {
                for (const role of ["USER", "ADMIN"] as const) {
                    await expect(
                        resolveLeaveCapability(context(role), capability),
                    ).rejects.toMatchObject({
                        authorizationReason: "NO_APPLICABLE_GRANT",
                    });
                }
                return;
            }

            const [user, admin] = await Promise.all([
                resolveLeaveCapability(context("USER"), capability),
                resolveLeaveCapability(context("ADMIN"), capability),
            ]);
            expect(user.defaultScopes).toEqual(expectedScopes);
            expect(admin.defaultScopes).toEqual(expectedScopes);
            expect(admin.scopes).toEqual(user.scopes);
        },
    );

    it("uses central SYSTEM_ROLE authority for Dashboard ADMIN without Leave defaults", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "leave.approver.manage",
                true,
                ["ALL"],
                undefined,
                [systemRoleGrant("leave.approver.manage")],
            ),
        );

        const manage = await resolveLeaveCapability(
            context("ADMIN"),
            "leave.approver.manage",
        );

        expect(manage.scopes).toEqual(["ALL"]);
        expect(manage.defaultScopes).toEqual([]);
        expect(manage.decision.grants).toEqual([
            systemRoleGrant("leave.approver.manage"),
        ]);

        mocks.resolve.mockResolvedValue(
            decision(
                "leave.recovery.manage",
                true,
                ["ALL"],
                undefined,
                [systemRoleGrant("leave.recovery.manage")],
            ),
        );
        const recovery = await resolveLeaveCapability(
            context("ADMIN"),
            "leave.recovery.manage",
        );
        expect(recovery.defaultScopes).toEqual([]);
        expect(canUseLeaveRecoveryOverride(recovery)).toBe(true);
        expect(canUseLeaveAdminRecoveryOverride(recovery)).toBe(true);
    });

    it("honors explicit USER grants without promoting the actor to ADMIN", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "leave.approver.manage",
                true,
                ["ALL"],
                undefined,
                [userGrant("leave.approver.manage", "ALL")],
            ),
        );
        const manage = await resolveLeaveCapability(
            context("USER"),
            "leave.approver.manage",
        );
        expect(manage.defaultScopes).toEqual([]);
        expect(manage.scopes).toEqual(["ALL"]);
        expect(manage.actor.systemRole).toBe("USER");

        mocks.resolve.mockResolvedValue(
            decision(
                "leave.request.approve",
                true,
                ["ASSIGNED"],
                undefined,
                [userGrant("leave.request.approve", "ASSIGNED")],
            ),
        );
        const approval = await resolveLeaveCapability(
            context("USER"),
            "leave.request.approve",
        );
        expect(assertLeaveCapabilityScope(approval, "ASSIGNED")).toBe(approval);
    });

    it("resolves explicit USER recovery authority without changing the actor role", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "leave.recovery.manage",
                true,
                ["ALL"],
                undefined,
                [userGrant("leave.recovery.manage", "ALL")],
            ),
        );

        const recovery = await resolveLeaveCapability(
            context("USER"),
            "leave.recovery.manage",
        );

        expect(recovery.scopes).toEqual(["ALL"]);
        expect(recovery.defaultScopes).toEqual([]);
        expect(recovery.actor.systemRole).toBe("USER");
        expect(canUseLeaveRecoveryOverride(recovery)).toBe(true);
    });

    it("composes configured USER grants additively without narrowing defaults", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "leave.request.read",
                    true,
                    ["OWN"],
                    undefined,
                    [userGrant("leave.request.read", "OWN")],
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "leave.request.not_taken",
                    true,
                    ["OWN"],
                    undefined,
                    [userGrant("leave.request.not_taken", "OWN")],
                ),
            );

        const ownRead = await resolveLeaveCapability(
            context(),
            "leave.request.read",
        );
        const notTaken = await resolveLeaveCapability(
            context(),
            "leave.request.not_taken",
        );

        expect(ownRead.defaultScopes).toEqual(["OWN"]);
        expect(ownRead.scopes).toEqual(["OWN"]);
        expect(notTaken.defaultScopes).toEqual(["OWN", "ASSIGNED"]);
        expect(notTaken.scopes).toEqual(["OWN", "ASSIGNED"]);
        expect(notTaken.decision.grants).toEqual([
            userGrant("leave.request.not_taken", "OWN"),
        ]);
        expect(notTaken.actor.systemRole).toBe("USER");
    });

    it("does not bridge channel, capability, or persistence-configuration failures", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "leave.cancellation.decide",
                false,
                [],
                "CHANNEL_NOT_SUPPORTED",
            ),
        );
        await expect(
            resolveLeaveCapability(
                context("ADMIN", "LIFF_SELF_SERVICE"),
                "leave.cancellation.decide",
            ),
        ).rejects.toMatchObject({
            authorizationReason: "CHANNEL_NOT_SUPPORTED",
            statusCode: 403,
        });

        mocks.resolve.mockResolvedValue(
            decision(
                "leave.cancellation.decide",
                false,
                [],
                "CHANNEL_NOT_SUPPORTED",
            ),
        );
        await expect(
            resolveLeaveCapability(
                context("USER", "LIFF_SELF_SERVICE"),
                "leave.cancellation.decide",
            ),
        ).rejects.toMatchObject({
            authorizationReason: "CHANNEL_NOT_SUPPORTED",
            statusCode: 403,
        });

        mocks.resolve.mockResolvedValue(
            decision("leave.unknown", false, [], "UNKNOWN_CAPABILITY"),
        );
        await expect(
            resolveLeaveCapability(context(), "leave.unknown"),
        ).rejects.toMatchObject({ authorizationReason: "UNKNOWN_CAPABILITY" });

        const configurationError = new Error("invalid persisted authorization");
        mocks.resolve.mockRejectedValue(configurationError);
        await expect(
            resolveLeaveCapability(context(), "leave.request.read"),
        ).rejects.toBe(configurationError);
    });

    it("keeps the recovery override Dashboard-only after central authorization", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "leave.recovery.manage",
                true,
                ["ALL"],
                undefined,
                [
                    systemRoleGrant("leave.recovery.manage", "ALL"),
                ],
            ),
        );
        const dashboard = await resolveLeaveCapability(
            context("ADMIN", "DASHBOARD"),
            "leave.recovery.manage",
        );
        const liff = await resolveLeaveCapability(
            context("ADMIN", "LIFF_SELF_SERVICE"),
            "leave.recovery.manage",
        );

        expect(canUseLeaveRecoveryOverride(dashboard)).toBe(true);
        expect(canUseLeaveRecoveryOverride(liff)).toBe(false);
    });

    it("fails closed when LIFF attempts to resolve Leave recovery", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "leave.recovery.manage",
                false,
                [],
                "CHANNEL_NOT_SUPPORTED",
            ),
        );

        await expect(
            resolveLeaveCapability(
                context("USER", "LIFF_SELF_SERVICE"),
                "leave.recovery.manage",
            ),
        ).rejects.toMatchObject({
            authorizationReason: "CHANNEL_NOT_SUPPORTED",
        });
    });

    it("re-reads active identity inside the transaction before resolving the capability", async () => {
        const tx = {
            user: {
                findFirst: vi.fn().mockResolvedValue(activeUser()),
            },
        } as unknown as Prisma.TransactionClient;
        mocks.resolveInTransaction.mockResolvedValue(
            decision(
                "leave.request.cancel",
                true,
                ["OWN"],
                undefined,
                [userGrant("leave.request.cancel", "OWN")],
            ),
        );

        const result = await resolveLeaveCapabilityInTransaction(
            tx,
            context(),
            "leave.request.cancel",
        );

        expect(mocks.lockUserRows).toHaveBeenCalledWith(tx, [7]);
        expect(mocks.lockEmployeeRows).toHaveBeenCalledWith(tx, [21]);
        expect(mocks.resolveInTransaction).toHaveBeenCalledWith(
            {
                userId: 7,
                employeeId: 21,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            "leave.request.cancel",
            tx,
        );
        expect(result.scopes).toEqual(["OWN"]);
    });

    it("restores the permanent USER default when an additional grant is revoked before transaction resolution", async () => {
        const tx = {
            user: {
                findFirst: vi.fn().mockResolvedValue(activeUser()),
            },
        } as unknown as Prisma.TransactionClient;
        mocks.resolveInTransaction.mockResolvedValue(
            decision(
                "leave.request.cancel",
                false,
                [],
                "NO_APPLICABLE_GRANT",
            ),
        );

        const result = await resolveLeaveCapabilityInTransaction(
            tx,
            context(),
            "leave.request.cancel",
        );

        expect(result.defaultScopes).toEqual(["OWN"]);
        expect(result.scopes).toEqual(["OWN"]);
        expect(result.decision.reason).toBe("NO_APPLICABLE_GRANT");
    });

    it("rebuilds a stale Dashboard ADMIN route actor from the current persisted USER role", async () => {
        const tx = {
            user: {
                findFirst: vi.fn().mockResolvedValue(activeUser("USER", 21)),
            },
        } as unknown as Prisma.TransactionClient;
        const staleContext = context("ADMIN", "DASHBOARD", 21);

        const result = await resolveLeaveActorInTransaction(tx, staleContext);

        expect(staleContext.authorizationActor.systemRole).toBe("ADMIN");
        expect(result).toEqual({
            userId: 7,
            employeeId: 21,
            systemRole: "USER",
            channel: "DASHBOARD",
        });
        expect(result.systemRole).not.toBe(
            staleContext.authorizationActor.systemRole,
        );
    });

    it("fails closed when the active workforce identity is revoked before mutation", async () => {
        const tx = {
            user: {
                findFirst: vi.fn().mockResolvedValue(null),
            },
        } as unknown as Prisma.TransactionClient;

        await expect(
            resolveLeaveCapabilityInTransaction(
                tx,
                context(),
                "leave.request.cancel",
            ),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
        expect(mocks.resolveInTransaction).not.toHaveBeenCalled();
    });

    it("uses the current USER actor for final authorization after a stale ADMIN preflight", async () => {
        const tx = {
            user: {
                findFirst: vi.fn().mockResolvedValue(activeUser("USER", 21)),
            },
        } as unknown as Prisma.TransactionClient;
        const staleContext = context("ADMIN", "DASHBOARD", 21);
        mocks.resolveInTransaction.mockImplementation(
            async (
                authorizationActor: AuthorizationActor,
            ): Promise<AuthorizationDecision> => authorizationActor.systemRole === "ADMIN"
                ? decision(
                    "leave.approver.manage",
                    true,
                    ["ALL"],
                    undefined,
                    [systemRoleGrant("leave.approver.manage")],
                )
                : decision(
                    "leave.approver.manage",
                    false,
                    [],
                    "NO_APPLICABLE_GRANT",
                ),
        );
        expect(staleContext.authorizationActor.systemRole).toBe("ADMIN");

        await expect(
            resolveLeaveCapabilityInTransaction(
                tx,
                staleContext,
                "leave.approver.manage",
            ),
        ).rejects.toMatchObject({
            capability: "leave.approver.manage",
            authorizationReason: "NO_APPLICABLE_GRANT",
            statusCode: 403,
        });
        expect(mocks.resolveInTransaction).toHaveBeenCalledWith(
            {
                userId: 7,
                employeeId: 21,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            "leave.approver.manage",
            tx,
        );
    });

    it("rejects a stale Employee 21 preflight when persisted User now belongs to Employee 22", async () => {
        // The persisted relationship moved from preflight Employee 21 to Employee 22.
        const currentUser = activeUser("USER", 22);
        const findFirst = vi.fn().mockImplementation(
            async (query: Prisma.UserFindFirstArgs) => {
                const where = query.where;
                return where?.id === currentUser.id
                    && where.employeeId === currentUser.employee?.id
                    ? currentUser
                    : null;
            },
        );
        const tx = {
            user: {
                findFirst,
            },
        } as unknown as Prisma.TransactionClient;
        const preflightContext = context("USER", "DASHBOARD", 21);

        await expect(
            resolveLeaveCapabilityInTransaction(
                tx,
                preflightContext,
                "leave.request.cancel",
            ),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
        expect(mocks.lockUserRows).toHaveBeenCalledWith(tx, [7]);
        expect(mocks.lockEmployeeRows).toHaveBeenCalledWith(tx, [21]);
        expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                id: 7,
                employeeId: 21,
                isActive: true,
                deletedAt: null,
                employee: {
                    is: { status: "ACTIVE", deletedAt: null },
                },
            }),
        }));
        expect(mocks.resolveInTransaction).not.toHaveBeenCalled();
    });

    it("rejects account-only Dashboard Admin approver management", async () => {
        const findFirst = vi.fn().mockResolvedValue(activeUser("ADMIN", null));
        const tx = {
            user: {
                findFirst,
            },
        } as unknown as Prisma.TransactionClient;
        await expect(
            resolveLeaveCapabilityInTransaction(
                tx,
                context("ADMIN", "DASHBOARD", null),
                "leave.approver.manage",
            ),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);

        expect(findFirst).not.toHaveBeenCalled();
        expect(mocks.lockUserRows).not.toHaveBeenCalled();
        expect(mocks.lockEmployeeRows).not.toHaveBeenCalled();
        expect(mocks.resolveInTransaction).not.toHaveBeenCalled();
    });

    it("re-reads the current persisted role without making it business authority", async () => {
        const currentUser = activeUser("USER", null);
        currentUser.employee = { id: 21, status: "ACTIVE", deletedAt: null };
        const findFirst = vi.fn().mockResolvedValue(currentUser);
        const tx = {
            user: {
                findFirst,
            },
        } as unknown as Prisma.TransactionClient;
        const staleContext = context("ADMIN", "DASHBOARD", 21);
        mocks.resolveInTransaction.mockResolvedValue(
            decision(
                "leave.approver.manage",
                true,
                ["ALL"],
                undefined,
                [userGrant("leave.approver.manage", "ALL")],
            ),
        );

        const result = await resolveLeaveCapabilityInTransaction(
            tx,
            staleContext,
            "leave.approver.manage",
        );
        expect(result.actor.systemRole).toBe("USER");
        expect(result.actor.employeeId).toBe(21);
        expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                id: 7,
                isActive: true,
                deletedAt: null,
            }),
        }));
        expect(findFirst.mock.calls[0]?.[0].where).not.toHaveProperty("role");
        expect(mocks.lockUserRows).toHaveBeenCalledWith(tx, [7]);
        expect(mocks.lockEmployeeRows).toHaveBeenCalledWith(tx, [21]);
        expect(mocks.resolveInTransaction).toHaveBeenCalledWith(
            {
                userId: 7,
                employeeId: 21,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            "leave.approver.manage",
            tx,
        );
    });

    it.each([
        ["an inactive account", { ...activeUser("ADMIN", null), isActive: false }],
        ["a deleted account", { ...activeUser("ADMIN", null), deletedAt: new Date() }],
    ] as const)("fails closed for %s in the account-only path", async (_label, user) => {
        const tx = {
            user: {
                findFirst: vi.fn().mockResolvedValue(user),
            },
        } as unknown as Prisma.TransactionClient;

        await expect(
            resolveLeaveCapabilityInTransaction(
                tx,
                context("ADMIN", "DASHBOARD", null),
                "leave.approver.manage",
            ),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
        expect(mocks.resolveInTransaction).not.toHaveBeenCalled();
    });

    it("does not make Employee optional for any other Leave capability or channel", async () => {
        const tx = {
            user: {
                findFirst: vi.fn(),
            },
        } as unknown as Prisma.TransactionClient;

        await expect(
            resolveLeaveCapabilityInTransaction(
                tx,
                context("ADMIN", "DASHBOARD", null),
                "leave.request.cancel",
            ),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
        await expect(
            resolveLeaveCapabilityInTransaction(
                tx,
                context("ADMIN", "LIFF_SELF_SERVICE", null),
                "leave.approver.manage",
            ),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
        expect(mocks.resolveInTransaction).not.toHaveBeenCalled();
    });

    it("resolves an explicit USER approver-management grant with active workforce", async () => {
        const tx = {
            user: {
                findFirst: vi.fn().mockResolvedValue(activeUser("USER", 21)),
            },
        } as unknown as Prisma.TransactionClient;
        mocks.resolveInTransaction.mockResolvedValue(
            decision(
                "leave.approver.manage",
                true,
                ["ALL"],
                undefined,
                [userGrant("leave.approver.manage", "ALL")],
            ),
        );

        const result = await resolveLeaveCapabilityInTransaction(
            tx,
            context("USER", "DASHBOARD", 21),
            "leave.approver.manage",
        );

        expect(result.actor.systemRole).toBe("USER");
        expect(result.actor.employeeId).toBe(21);
        expect(result.scopes).toEqual(["ALL"]);
        expect(mocks.lockEmployeeRows).toHaveBeenCalledWith(tx, [21]);
    });

    it("fails closed when an explicit USER approver-management actor loses workforce identity", async () => {
        const tx = {
            user: {
                findFirst: vi.fn().mockResolvedValue(null),
            },
        } as unknown as Prisma.TransactionClient;

        await expect(
            resolveLeaveCapabilityInTransaction(
                tx,
                context("USER", "DASHBOARD", 21),
                "leave.approver.manage",
            ),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
        expect(mocks.resolveInTransaction).not.toHaveBeenCalled();
    });
});
