import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";

import {
    assertEmployeeCapabilityForMigration,
    assertEmployeeCapabilityScope,
    buildEmployeeAuthorizationContext,
    buildEmployeeAuthorizedCommandActor,
    EmployeeCapabilityDeniedError,
    EMPLOYEE_MIGRATED_CAPABILITIES,
    resolveEmployeeCapabilityForMigration,
    resolveEmployeeCapabilityInTransaction,
} from "./authorization";

const mocks = vi.hoisted(() => ({
    resolve: vi.fn(),
    resolveInTransaction: vi.fn(),
    lockEmployeeRows: vi.fn(),
    lockUserRows: vi.fn(),
}));

vi.mock("@/modules/authorization", () => ({
    authorization: {
        resolve: mocks.resolve,
        resolveInTransaction: mocks.resolveInTransaction,
    },
}));

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
    employee: { id: number; status: string; deletedAt: Date | null };
} {
    return {
        id: 7,
        role,
        isActive: true,
        deletedAt: null,
        employee: {
            id: employeeId,
            status: employeeStatus,
            deletedAt: employeeDeletedAt,
        },
    };
}

describe("Employee authorization migration adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
        mocks.resolveInTransaction.mockReset();
        mocks.lockEmployeeRows.mockReset();
        mocks.lockUserRows.mockReset();
    });

    it("keeps the registered inventory and fixed Dashboard actor mapping explicit", () => {
        expect(EMPLOYEE_MIGRATED_CAPABILITIES).toEqual([
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
    ] as const)("keeps broad USER compatibility for %s", async (capability) => {
        mocks.resolve.mockResolvedValue(
            decision(capability, false, [], "NO_APPLICABLE_GRANT"),
        );

        const result = await resolveEmployeeCapabilityForMigration(
            context(),
            capability,
        );

        expect(result.scopes).toEqual(["ALL"]);
        expect(result.usedMigrationCompatibility).toBe(true);
    });

    it.each([
        "employee.create",
        "employee.update",
        "employee.delete",
        "employee.import",
    ] as const)("keeps Admin compatibility for %s", async (capability) => {
        mocks.resolve.mockResolvedValue(
            decision(capability, false, [], "NO_APPLICABLE_GRANT"),
        );

        const result = await resolveEmployeeCapabilityForMigration(
            context("ADMIN"),
            capability,
        );

        expect(result.scopes).toEqual(["ALL"]);
        expect(result.usedMigrationCompatibility).toBe(true);
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
            resolveEmployeeCapabilityForMigration(context(), capability),
        ).rejects.toMatchObject({
            capability,
            authorizationReason: "NO_APPLICABLE_GRANT",
            statusCode: 403,
        });
    });

    it.each(EMPLOYEE_MIGRATED_CAPABILITIES)(
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

            const result = await resolveEmployeeCapabilityForMigration(
                context(),
                capability,
            );

            expect(result.actor.systemRole).toBe("USER");
            expect(result.scopes).toEqual(["ALL"]);
            expect(result.usedMigrationCompatibility).toBe(false);
            expect(assertEmployeeCapabilityScope(result, "ALL")).toBe(result);
        },
    );

    it("does not invoke compatibility for denial reasons other than NO_APPLICABLE_GRANT", async () => {
        for (const reason of ["UNKNOWN_CAPABILITY", "CHANNEL_NOT_SUPPORTED"] as const) {
            mocks.resolve.mockResolvedValue(
                decision("employee.read", false, [], reason),
            );

            await expect(
                resolveEmployeeCapabilityForMigration(
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
            resolveEmployeeCapabilityForMigration(context(), "employee.read"),
        ).rejects.toBe(resolverFailure);
    });

    it("requires ALL scope after the resolver decision", async () => {
        mocks.resolve.mockResolvedValue(
            decision("employee.read", true, ["OWN"]),
        );

        const result = await assertEmployeeCapabilityForMigration(
            context(),
            "employee.read",
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
        );

        expect(tx.user.findUnique).toHaveBeenCalledTimes(2);
        expect(mocks.lockUserRows).toHaveBeenCalledWith(tx, [7]);
        expect(mocks.lockEmployeeRows).toHaveBeenCalledWith(tx, [21]);
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
        expect(result.scopes).toEqual(["ALL"]);
    });

    it("uses the current persisted role when the route-time role is stale", async () => {
        const tx = {
            user: {
                findUnique: vi.fn().mockResolvedValue(activeUser("ADMIN")),
            },
        } as unknown as Prisma.TransactionClient;
        mocks.resolveInTransaction.mockResolvedValue(
            decision("employee.delete", false, [], "NO_APPLICABLE_GRANT"),
        );

        const result = await resolveEmployeeCapabilityInTransaction(
            tx,
            commandActor("USER"),
            "employee.delete",
        );

        expect(result.actor.systemRole).toBe("ADMIN");
        expect(result.scopes).toEqual(["ALL"]);
        expect(result.usedMigrationCompatibility).toBe(true);
    });

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
            ),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
        expect(mocks.resolveInTransaction).not.toHaveBeenCalled();
    });
});
