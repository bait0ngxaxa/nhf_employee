import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationDecision,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";

const mocks = vi.hoisted(() => ({
    resolveMany: vi.fn(),
}));

vi.mock("@/modules/authorization", () => ({
    authorization: {
        resolveMany: mocks.resolveMany,
    },
}));

import {
    buildNotificationAuthorizationContext,
    getNotificationPresentationCapabilities,
    NOTIFICATION_MIGRATED_CAPABILITIES,
} from "./authorization";
import type { NotificationPresentationCapabilities } from "./types";

const DASHBOARD_USER = buildNotificationAuthorizationContext(
    { id: 7, role: "USER" },
    21,
);

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
    capability: (typeof NOTIFICATION_MIGRATED_CAPABILITIES)[number],
    source: EffectiveAuthorizationGrant["source"],
): EffectiveAuthorizationGrant {
    return {
        capability,
        scope: "OWN",
        source,
    };
}

function mockDecisions(
    getDecision: (
        capability: (typeof NOTIFICATION_MIGRATED_CAPABILITIES)[number],
    ) => AuthorizationDecision,
): void {
    mocks.resolveMany.mockImplementation(
        async (_actor: unknown, capabilities: readonly string[]) => new Map(
            capabilities.map((capability) => [
                capability,
                getDecision(
                    capability as (typeof NOTIFICATION_MIGRATED_CAPABILITIES)[number],
                ),
            ]),
        ),
    );
}

describe("Notification presentation capability projection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDecisions((capability) => decision(
            capability,
            false,
            [],
            "NO_APPLICABLE_GRANT",
        ));
    });

    it("resolves read and update in one batch and keeps their booleans independent", async () => {
        mockDecisions((capability) => decision(
            capability,
            capability === "notification.inbox.read",
            capability === "notification.inbox.read" ? ["OWN"] : [],
            capability === "notification.inbox.read"
                ? undefined
                : "CHANNEL_NOT_SUPPORTED",
        ));

        await expect(
            getNotificationPresentationCapabilities(DASHBOARD_USER),
        ).resolves.toEqual({ canReadInbox: true, canUpdateInbox: false });
        expect(mocks.resolveMany).toHaveBeenCalledTimes(1);
        expect(mocks.resolveMany).toHaveBeenCalledWith(
            DASHBOARD_USER.authorizationActor,
            NOTIFICATION_MIGRATED_CAPABILITIES,
        );
    });

    it("keeps the NO_APPLICABLE_GRANT compatibility bridge as OWN for both fields", async () => {
        await expect(
            getNotificationPresentationCapabilities(DASHBOARD_USER),
        ).resolves.toEqual({ canReadInbox: true, canUpdateInbox: true });
    });

    it.each([
        [true, true],
        [true, false],
        [false, true],
        [false, false],
    ])("projects read=%s and update=%s independently", async (canRead, canUpdate) => {
        mockDecisions((capability) => {
            const allowed = capability === "notification.inbox.read"
                ? canRead
                : canUpdate;
            return decision(
                capability,
                allowed,
                allowed ? ["OWN"] : [],
                allowed ? undefined : "CHANNEL_NOT_SUPPORTED",
            );
        });

        await expect(
            getNotificationPresentationCapabilities(DASHBOARD_USER),
        ).resolves.toEqual({
            canReadInbox: canRead,
            canUpdateInbox: canUpdate,
        });
    });

    it.each([
        ["USER", { type: "USER", userId: 7 }],
        ["TEAM", { type: "TEAM", teamId: 3 }],
        ["TEAM_ROLE", { type: "TEAM_ROLE", teamId: 3, teamRoleId: 4 }],
    ] as const)("projects an explicit %s grant without broadening OWN", async (_label, source) => {
        mockDecisions((capability) => decision(
            capability,
            true,
            ["OWN"],
            undefined,
            [grant(capability, source)],
        ));

        await expect(
            getNotificationPresentationCapabilities(DASHBOARD_USER),
        ).resolves.toEqual({ canReadInbox: true, canUpdateInbox: true });
    });

    it("projects the ADMIN central decision and compatibility bridge for each capability", async () => {
        mockDecisions((capability) => capability === "notification.inbox.read"
            ? decision(
                capability,
                true,
                ["OWN"],
                undefined,
                [grant(capability, { type: "SYSTEM_ROLE", role: "ADMIN" })],
            )
            : decision(capability, false, [], "NO_APPLICABLE_GRANT"));

        await expect(
            getNotificationPresentationCapabilities(
                buildNotificationAuthorizationContext({ id: 7, role: "ADMIN" }, 21),
            ),
        ).resolves.toEqual({ canReadInbox: true, canUpdateInbox: true });
    });

    it("does not broaden an inbox projection from an ALL decision", async () => {
        mockDecisions((capability) => decision(
            capability,
            true,
            ["ALL"],
        ));

        await expect(
            getNotificationPresentationCapabilities(DASHBOARD_USER),
        ).resolves.toEqual({ canReadInbox: false, canUpdateInbox: false });
    });

    it("does not convert resolver failures, unknown, or omitted decisions into allow", async () => {
        const resolverFailure = new Error("authorization persistence failure");
        mocks.resolveMany.mockRejectedValue(resolverFailure);
        await expect(
            getNotificationPresentationCapabilities(DASHBOARD_USER),
        ).rejects.toBe(resolverFailure);

        mockDecisions((capability) => capability === "notification.inbox.read"
            ? decision(capability, false, [], "UNKNOWN_CAPABILITY")
            : decision(capability, false, [], "CHANNEL_NOT_SUPPORTED"));
        await expect(
            getNotificationPresentationCapabilities(DASHBOARD_USER),
        ).rejects.toMatchObject({
            authorizationReason: "UNKNOWN_CAPABILITY",
            capability: "notification.inbox.read",
        });

        mocks.resolveMany.mockResolvedValue(new Map([
            ["notification.inbox.read", decision(
                "notification.inbox.read",
                false,
                [],
                "NO_APPLICABLE_GRANT",
            )],
        ]));
        await expect(
            getNotificationPresentationCapabilities(DASHBOARD_USER),
        ).rejects.toThrow("Authorization resolver omitted Notification capability");
    });

    it("exposes the immutable contract shape", async () => {
        const projection = await getNotificationPresentationCapabilities(DASHBOARD_USER);

        expect(Object.keys(projection)).toEqual([
            "canReadInbox",
            "canUpdateInbox",
        ]);
        expect(Object.isFrozen(projection)).toBe(true);
        expect(projection satisfies NotificationPresentationCapabilities).toBeTruthy();
    });
});
