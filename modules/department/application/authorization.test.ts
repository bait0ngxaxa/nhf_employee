import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";

import {
    assertDepartmentCapabilityScope,
    buildDepartmentAuthorizationContext,
    DepartmentCapabilityDeniedError,
    DEPARTMENT_MIGRATED_CAPABILITIES,
    resolveDepartmentCapabilityForMigration,
} from "./authorization";

const mocks = vi.hoisted(() => ({
    resolve: vi.fn(),
}));

vi.mock("@/modules/authorization", () => ({
    authorization: {
        resolve: mocks.resolve,
    },
}));

function context(
    role: "ADMIN" | "USER" = "USER",
): ReturnType<typeof buildDepartmentAuthorizationContext> {
    return buildDepartmentAuthorizationContext({ id: 7, role });
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

function grant(
    capability: string,
    source: EffectiveAuthorizationGrant["source"],
): EffectiveAuthorizationGrant {
    return {
        capability: capability as EffectiveAuthorizationGrant["capability"],
        scope: "ALL",
        source,
    };
}

describe("Department authorization migration adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
    });

    it("keeps the registered inventory and trusted Dashboard actor mapping", () => {
        expect(DEPARTMENT_MIGRATED_CAPABILITIES).toEqual(["department.read"]);
        expect(context().authorizationActor).toEqual({
            userId: 7,
            employeeId: null,
            systemRole: "USER",
            channel: "DASHBOARD",
        } satisfies AuthorizationActor);
    });

    it("preserves eligible-user compatibility only for NO_APPLICABLE_GRANT", async () => {
        mocks.resolve.mockResolvedValue(
            decision("department.read", false, [], "NO_APPLICABLE_GRANT"),
        );

        const result = await resolveDepartmentCapabilityForMigration(
            context(),
            "department.read",
        );

        expect(result.scopes).toEqual(["ALL"]);
        expect(result.usedMigrationCompatibility).toBe(true);
        expect(assertDepartmentCapabilityScope(result, "ALL")).toBe(result);
    });

    it.each([
        ["USER", { type: "USER", userId: 7 }],
        ["TEAM", { type: "TEAM", teamId: 3 }],
        ["TEAM_ROLE", { type: "TEAM_ROLE", teamId: 3, teamRoleId: 4 }],
    ] as const)("honors the central %s grant without changing the actor role", async (_source, source) => {
        mocks.resolve.mockResolvedValue(
            decision(
                "department.read",
                true,
                ["ALL"],
                undefined,
                [grant("department.read", source)],
            ),
        );

        const result = await resolveDepartmentCapabilityForMigration(
            context(),
            "department.read",
        );

        expect(result.actor.systemRole).toBe("USER");
        expect(result.scopes).toEqual(["ALL"]);
        expect(result.usedMigrationCompatibility).toBe(false);
    });

    it("accepts ADMIN through the central resolver rather than a feature-local role check", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "department.read",
                true,
                ["ALL"],
                undefined,
                [grant("department.read", { type: "SYSTEM_ROLE", role: "ADMIN" })],
            ),
        );

        const result = await resolveDepartmentCapabilityForMigration(
            context("ADMIN"),
            "department.read",
        );

        expect(mocks.resolve).toHaveBeenCalledWith(
            context("ADMIN").authorizationActor,
            "department.read",
        );
        expect(result.usedMigrationCompatibility).toBe(false);
    });

    it("does not bridge structural denials or resolver failures", async () => {
        for (const reason of ["UNKNOWN_CAPABILITY", "CHANNEL_NOT_SUPPORTED"] as const) {
            mocks.resolve.mockResolvedValue(
                decision("department.read", false, [], reason),
            );

            await expect(
                resolveDepartmentCapabilityForMigration(context(), "department.read"),
            ).rejects.toMatchObject({
                authorizationReason: reason,
                statusCode: 403,
            });
        }

        const resolverFailure = new Error("authorization persistence failure");
        mocks.resolve.mockRejectedValue(resolverFailure);
        await expect(
            resolveDepartmentCapabilityForMigration(context(), "department.read"),
        ).rejects.toBe(resolverFailure);
    });

    it("requires the registered ALL scope", async () => {
        mocks.resolve.mockResolvedValue(
            decision("department.read", true, ["OWN"]),
        );

        const result = await resolveDepartmentCapabilityForMigration(
            context(),
            "department.read",
        );

        expect(() => assertDepartmentCapabilityScope(result, "ALL")).toThrow(
            DepartmentCapabilityDeniedError,
        );
    });
});
