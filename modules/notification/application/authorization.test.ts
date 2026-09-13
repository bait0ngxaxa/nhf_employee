import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";

import {
    assertNotificationCapabilityScope,
    buildNotificationAuthorizationContext,
    NotificationCapabilityDeniedError,
    NOTIFICATION_MIGRATED_CAPABILITIES,
    resolveNotificationCapabilityForMigration,
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
): ReturnType<typeof buildNotificationAuthorizationContext> {
    return buildNotificationAuthorizationContext({ id: 7, role });
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
        scope: "OWN",
        source,
    };
}

describe("Notification authorization migration adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
    });

    it("keeps both registered capabilities and the trusted Dashboard actor mapping", () => {
        expect(NOTIFICATION_MIGRATED_CAPABILITIES).toEqual([
            "notification.inbox.read",
            "notification.inbox.update",
        ]);
        expect(context().authorizationActor).toEqual({
            userId: 7,
            employeeId: null,
            systemRole: "USER",
            channel: "DASHBOARD",
        } satisfies AuthorizationActor);
    });

    it.each(NOTIFICATION_MIGRATED_CAPABILITIES)(
        "preserves own-inbox compatibility for %s only when no grant applies",
        async (capability) => {
            mocks.resolve.mockResolvedValue(
                decision(capability, false, [], "NO_APPLICABLE_GRANT"),
            );

            const result = await resolveNotificationCapabilityForMigration(
                context(),
                capability,
            );

            expect(result.scopes).toEqual(["OWN"]);
            expect(result.usedMigrationCompatibility).toBe(true);
        },
    );

    it.each([
        ["USER", { type: "USER", userId: 7 }],
        ["TEAM", { type: "TEAM", teamId: 3 }],
        ["TEAM_ROLE", { type: "TEAM_ROLE", teamId: 3, teamRoleId: 4 }],
    ] as const)("honors an explicit central %s grant without broadening OWN", async (_source, source) => {
        for (const capability of NOTIFICATION_MIGRATED_CAPABILITIES) {
            mocks.resolve.mockResolvedValue(
                decision(
                    capability,
                    true,
                    ["OWN"],
                    undefined,
                    [grant(capability, source)],
                ),
            );

            const result = await resolveNotificationCapabilityForMigration(
                context(),
                capability,
            );

            expect(result.actor.systemRole).toBe("USER");
            expect(result.scopes).toEqual(["OWN"]);
            expect(result.usedMigrationCompatibility).toBe(false);
        }
    });

    it("uses central ADMIN semantics and keeps read and update capabilities independent", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "notification.inbox.read",
                    true,
                    ["OWN"],
                    undefined,
                    [grant("notification.inbox.read", { type: "SYSTEM_ROLE", role: "ADMIN" })],
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "notification.inbox.update",
                    false,
                    [],
                    "NO_APPLICABLE_GRANT",
                ),
            );

        const read = await resolveNotificationCapabilityForMigration(
            context("ADMIN"),
            "notification.inbox.read",
        );
        const update = await resolveNotificationCapabilityForMigration(
            context(),
            "notification.inbox.update",
        );

        expect(read.scopes).toEqual(["OWN"]);
        expect(read.usedMigrationCompatibility).toBe(false);
        expect(update.scopes).toEqual(["OWN"]);
        expect(update.usedMigrationCompatibility).toBe(true);
        expect(mocks.resolve).toHaveBeenNthCalledWith(
            1,
            context("ADMIN").authorizationActor,
            "notification.inbox.read",
        );
        expect(mocks.resolve).toHaveBeenNthCalledWith(
            2,
            context().authorizationActor,
            "notification.inbox.update",
        );
    });

    it("does not bridge structural denials or resolver failures", async () => {
        for (const reason of ["UNKNOWN_CAPABILITY", "CHANNEL_NOT_SUPPORTED"] as const) {
            mocks.resolve.mockResolvedValue(
                decision("notification.inbox.read", false, [], reason),
            );

            await expect(
                resolveNotificationCapabilityForMigration(
                    context(),
                    "notification.inbox.read",
                ),
            ).rejects.toMatchObject({ authorizationReason: reason });
        }

        const resolverFailure = new Error("authorization persistence failure");
        mocks.resolve.mockRejectedValue(resolverFailure);
        await expect(
            resolveNotificationCapabilityForMigration(
                context(),
                "notification.inbox.read",
            ),
        ).rejects.toBe(resolverFailure);
    });

    it("rejects an ALL decision so an inbox route cannot become cross-user", async () => {
        mocks.resolve.mockResolvedValue(
            decision("notification.inbox.read", true, ["ALL"]),
        );

        const result = await resolveNotificationCapabilityForMigration(
            context(),
            "notification.inbox.read",
        );

        expect(() => assertNotificationCapabilityScope(result, "OWN")).toThrow(
            NotificationCapabilityDeniedError,
        );
    });
});
