import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";
import { AuthorizationConfigurationError } from "@/modules/authorization";
import type * as AuthorizationModule from "@/modules/authorization";

import {
    assertDepartmentCapabilityScope,
    buildDepartmentAuthorizationContext,
    DEPARTMENT_CAPABILITIES,
    resolveDepartmentCapability,
} from "./authorization";

const mocks = vi.hoisted(() => ({
    resolve: vi.fn(),
}));

vi.mock("@/modules/authorization", async () => {
    const actual = await vi.importActual<typeof AuthorizationModule>(
        "@/modules/authorization",
    );
    return {
        ...actual,
        authorization: {
            ...actual.authorization,
            resolve: mocks.resolve,
        },
    };
});

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

describe("Department authorization default-policy adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
    });

    it("keeps the registered inventory and trusted Dashboard actor mapping", () => {
        expect(DEPARTMENT_CAPABILITIES).toEqual(["department.read"]);
        expect(context().authorizationActor).toEqual({
            userId: 7,
            employeeId: null,
            systemRole: "USER",
            channel: "DASHBOARD",
        } satisfies AuthorizationActor);
    });

    it("composes the USER default policy when no configured grant applies", async () => {
        mocks.resolve.mockResolvedValue(
            decision("department.read", false, [], "NO_APPLICABLE_GRANT"),
        );

        const result = await resolveDepartmentCapability(
            context(),
            "department.read",
        );

        expect(result.defaultScopes).toEqual(["ALL"]);
        expect(result.scopes).toEqual(["ALL"]);
        expect(assertDepartmentCapabilityScope(result, "ALL")).toBe(result);
    });

    it("retains the default policy after a configured grant is removed", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision("department.read", false, [], "NO_APPLICABLE_GRANT"),
            )
            .mockResolvedValueOnce(
                decision(
                    "department.read",
                    true,
                    ["ALL"],
                    undefined,
                    [grant("department.read", { type: "USER", userId: 7 })],
                ),
            )
            .mockResolvedValueOnce(
                decision("department.read", false, [], "NO_APPLICABLE_GRANT"),
            );

        const withoutGrant = await resolveDepartmentCapability(
            context(),
            "department.read",
        );
        const withGrant = await resolveDepartmentCapability(
            context(),
            "department.read",
        );
        const afterRemoval = await resolveDepartmentCapability(
            context(),
            "department.read",
        );

        expect(withoutGrant.scopes).toEqual(["ALL"]);
        expect(withGrant.scopes).toEqual(["ALL"]);
        expect(afterRemoval.scopes).toEqual(["ALL"]);
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

        const result = await resolveDepartmentCapability(
            context(),
            "department.read",
        );

        expect(result.actor.systemRole).toBe("USER");
        expect(result.defaultScopes).toEqual(["ALL"]);
        expect(result.scopes).toEqual(["ALL"]);
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

        const result = await resolveDepartmentCapability(
            context("ADMIN"),
            "department.read",
        );

        expect(mocks.resolve).toHaveBeenCalledWith(
            context("ADMIN").authorizationActor,
            "department.read",
        );
        expect(result.defaultScopes).toEqual([]);
        expect(result.scopes).toEqual(["ALL"]);
    });

    it("does not bridge structural denials or resolver failures", async () => {
        for (const reason of ["UNKNOWN_CAPABILITY", "CHANNEL_NOT_SUPPORTED"] as const) {
            mocks.resolve.mockResolvedValue(
                decision("department.read", false, [], reason),
            );

            await expect(
                resolveDepartmentCapability(context(), "department.read"),
            ).rejects.toMatchObject({
                authorizationReason: reason,
                statusCode: 403,
            });
        }

        mocks.resolve.mockResolvedValue(
            decision("department.unknown", false, [], "UNKNOWN_CAPABILITY"),
        );
        await expect(
            resolveDepartmentCapability(context(), "department.unknown"),
        ).rejects.toMatchObject({
            authorizationReason: "UNKNOWN_CAPABILITY",
            capability: "department.unknown",
        });

        const resolverFailure = new AuthorizationConfigurationError(
            "UNSUPPORTED_PERSISTED_SCOPE",
            "invalid persisted grant configuration",
        );
        mocks.resolve.mockRejectedValue(resolverFailure);
        await expect(
            resolveDepartmentCapability(context(), "department.read"),
        ).rejects.toBe(resolverFailure);
    });

    it("cannot be narrowed by a configured scope", async () => {
        mocks.resolve.mockResolvedValue(
            decision("department.read", true, ["OWN"]),
        );

        const result = await resolveDepartmentCapability(
            context(),
            "department.read",
        );

        expect(result.scopes).toEqual(["ALL"]);
        expect(assertDepartmentCapabilityScope(result, "ALL")).toBe(result);
    });
});
