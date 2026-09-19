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
    assertNotificationCapabilityScope,
    buildNotificationAuthorizationContext,
    defaultNotificationScopes,
    NotificationCapabilityDeniedError,
    NOTIFICATION_CAPABILITIES,
    resolveNotificationCapability,
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

describe("Notification authorization default-policy adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
    });

    it("keeps both registered capabilities and the trusted Dashboard actor mapping", () => {
        expect(NOTIFICATION_CAPABILITIES).toEqual([
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

    it.each(NOTIFICATION_CAPABILITIES)(
        "composes the own-inbox default policy for %s when no grant applies",
        async (capability) => {
            mocks.resolve.mockResolvedValue(
                decision(capability, false, [], "NO_APPLICABLE_GRANT"),
            );

            const user = await resolveNotificationCapability(
                context("USER"),
                capability,
            );
            const admin = await resolveNotificationCapability(
                context("ADMIN"),
                capability,
            );

            expect(defaultNotificationScopes(capability)).toEqual(["OWN"]);
            expect(user.defaultScopes).toEqual(["OWN"]);
            expect(admin.defaultScopes).toEqual(user.defaultScopes);
            expect(admin.scopes).toEqual(user.scopes);
        },
    );

    it("retains the own-inbox default policy after a configured grant is removed", async () => {
        const capability = "notification.inbox.read" as const;
        mocks.resolve
            .mockResolvedValueOnce(
                decision(capability, false, [], "NO_APPLICABLE_GRANT"),
            )
            .mockResolvedValueOnce(
                decision(
                    capability,
                    true,
                    ["OWN"],
                    undefined,
                    [grant(capability, { type: "USER", userId: 7 })],
                ),
            )
            .mockResolvedValueOnce(
                decision(capability, false, [], "NO_APPLICABLE_GRANT"),
            );

        const withoutGrant = await resolveNotificationCapability(
            context(),
            capability,
        );
        const withGrant = await resolveNotificationCapability(
            context(),
            capability,
        );
        const afterRemoval = await resolveNotificationCapability(
            context(),
            capability,
        );

        expect(withoutGrant.scopes).toEqual(["OWN"]);
        expect(withGrant.scopes).toEqual(["OWN"]);
        expect(afterRemoval.scopes).toEqual(["OWN"]);
    });

    it.each([
        ["USER", { type: "USER", userId: 7 }],
        ["TEAM", { type: "TEAM", teamId: 3 }],
        ["TEAM_ROLE", { type: "TEAM_ROLE", teamId: 3, teamRoleId: 4 }],
    ] as const)("honors an explicit central %s grant without broadening OWN", async (_source, source) => {
        for (const capability of NOTIFICATION_CAPABILITIES) {
            mocks.resolve.mockResolvedValue(
                decision(
                    capability,
                    true,
                    ["OWN"],
                    undefined,
                    [grant(capability, source)],
                ),
            );

            const result = await resolveNotificationCapability(
                context(),
                capability,
            );

            expect(result.actor.systemRole).toBe("USER");
            expect(result.defaultScopes).toEqual(["OWN"]);
            expect(result.scopes).toEqual(["OWN"]);
        }
    });

    it("uses configured ADMIN authority and keeps read and update capabilities independent", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "notification.inbox.read",
                    true,
                    ["OWN"],
                    undefined,
                    [grant("notification.inbox.read", { type: "USER", userId: 7 })],
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "notification.inbox.update",
                    true,
                    ["OWN"],
                    undefined,
                    [grant("notification.inbox.update", { type: "USER", userId: 7 })],
                ),
            );

        const read = await resolveNotificationCapability(
            context("ADMIN"),
            "notification.inbox.read",
        );
        const update = await resolveNotificationCapability(
            context("ADMIN"),
            "notification.inbox.update",
        );

        expect(read.defaultScopes).toEqual(["OWN"]);
        expect(read.scopes).toEqual(["OWN"]);
        expect(update.defaultScopes).toEqual(["OWN"]);
        expect(update.scopes).toEqual(["OWN"]);
        expect(mocks.resolve).toHaveBeenNthCalledWith(
            1,
            context("ADMIN").authorizationActor,
            "notification.inbox.read",
        );
        expect(mocks.resolve).toHaveBeenNthCalledWith(
            2,
            context("ADMIN").authorizationActor,
            "notification.inbox.update",
        );
    });

    it("does not bridge structural denials or resolver failures", async () => {
        for (const reason of ["UNKNOWN_CAPABILITY", "CHANNEL_NOT_SUPPORTED"] as const) {
            mocks.resolve.mockResolvedValue(
                decision("notification.inbox.read", false, [], reason),
            );

            await expect(
                resolveNotificationCapability(
                    context(),
                    "notification.inbox.read",
                ),
                ).rejects.toMatchObject({ authorizationReason: reason });
        }

        mocks.resolve.mockResolvedValue(
            decision("notification.unknown", false, [], "UNKNOWN_CAPABILITY"),
        );
        await expect(
            resolveNotificationCapability(context(), "notification.unknown"),
        ).rejects.toMatchObject({
            authorizationReason: "UNKNOWN_CAPABILITY",
            capability: "notification.unknown",
        });

        const resolverFailure = new AuthorizationConfigurationError(
            "UNSUPPORTED_PERSISTED_SCOPE",
            "invalid persisted grant configuration",
        );
        mocks.resolve.mockRejectedValue(resolverFailure);
        await expect(
            resolveNotificationCapability(
                context(),
                "notification.inbox.read",
            ),
        ).rejects.toBe(resolverFailure);
    });

    it("rejects an ALL decision so an inbox route cannot become cross-user", async () => {
        mocks.resolve.mockResolvedValue(
            decision("notification.inbox.read", true, ["ALL"]),
        );

        const result = await resolveNotificationCapability(
            context(),
            "notification.inbox.read",
        );

        expect(() => assertNotificationCapabilityScope(result, "OWN")).toThrow(
            NotificationCapabilityDeniedError,
        );
    });
});
