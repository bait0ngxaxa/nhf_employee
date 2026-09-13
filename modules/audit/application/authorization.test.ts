import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";

import {
    assertAuditCapabilityScope,
    buildAuditAuthorizationContext,
    AuditCapabilityDeniedError,
    AUDIT_MIGRATED_CAPABILITIES,
    resolveAuditCapabilityForMigration,
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
): ReturnType<typeof buildAuditAuthorizationContext> {
    return buildAuditAuthorizationContext({ id: 7, role });
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

describe("Audit authorization migration adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
    });

    it("keeps the registered inventory and trusted Dashboard actor mapping", () => {
        expect(AUDIT_MIGRATED_CAPABILITIES).toEqual(["audit.read"]);
        expect(context().authorizationActor).toEqual({
            userId: 7,
            employeeId: null,
            systemRole: "USER",
            channel: "DASHBOARD",
        } satisfies AuthorizationActor);
    });

    it("allows ADMIN only through the central resolver", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "audit.read",
                true,
                ["ALL"],
                undefined,
                [grant("audit.read", { type: "SYSTEM_ROLE", role: "ADMIN" })],
            ),
        );

        const result = await resolveAuditCapabilityForMigration(
            context("ADMIN"),
            "audit.read",
        );

        expect(mocks.resolve).toHaveBeenCalledWith(
            context("ADMIN").authorizationActor,
            "audit.read",
        );
        expect(result.scopes).toEqual(["ALL"]);
        expect(result.usedMigrationCompatibility).toBe(false);
    });

    it.each([
        ["USER", { type: "USER", userId: 7 }],
        ["TEAM", { type: "TEAM", teamId: 3 }],
        ["TEAM_ROLE", { type: "TEAM_ROLE", teamId: 3, teamRoleId: 4 }],
    ] as const)("honors an explicit central %s grant", async (_source, source) => {
        mocks.resolve.mockResolvedValue(
            decision(
                "audit.read",
                true,
                ["ALL"],
                undefined,
                [grant("audit.read", source)],
            ),
        );

        const result = await resolveAuditCapabilityForMigration(
            context(),
            "audit.read",
        );

        expect(result.actor.systemRole).toBe("USER");
        expect(result.scopes).toEqual(["ALL"]);
        expect(result.usedMigrationCompatibility).toBe(false);
    });

    it("keeps an ungranted USER denied without an Audit compatibility floor", async () => {
        mocks.resolve.mockResolvedValue(
            decision("audit.read", false, [], "NO_APPLICABLE_GRANT"),
        );

        await expect(
            resolveAuditCapabilityForMigration(context(), "audit.read"),
        ).rejects.toMatchObject({
            capability: "audit.read",
            authorizationReason: "NO_APPLICABLE_GRANT",
            statusCode: 403,
        });
    });

    it("does not bridge structural denials or resolver failures", async () => {
        for (const reason of ["UNKNOWN_CAPABILITY", "CHANNEL_NOT_SUPPORTED"] as const) {
            mocks.resolve.mockResolvedValue(
                decision("audit.read", false, [], reason),
            );

            await expect(
                resolveAuditCapabilityForMigration(context(), "audit.read"),
            ).rejects.toMatchObject({ authorizationReason: reason });
        }

        const resolverFailure = new Error("authorization persistence failure");
        mocks.resolve.mockRejectedValue(resolverFailure);
        await expect(
            resolveAuditCapabilityForMigration(context(), "audit.read"),
        ).rejects.toBe(resolverFailure);
    });

    it("requires ALL scope after the resolver decision", async () => {
        mocks.resolve.mockResolvedValue(
            decision("audit.read", true, ["OWN"]),
        );

        const result = await resolveAuditCapabilityForMigration(
            context(),
            "audit.read",
        );

        expect(() => assertAuditCapabilityScope(result, "ALL")).toThrow(
            AuditCapabilityDeniedError,
        );
    });
});
