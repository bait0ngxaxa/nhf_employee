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
    buildAuditAuthorizationContext,
    AUDIT_MIGRATED_CAPABILITIES,
    getAuditPresentationCapabilities,
} from "./authorization";
import type { AuditPresentationCapabilities } from "./types";

const DASHBOARD_USER = buildAuditAuthorizationContext(
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
    source: EffectiveAuthorizationGrant["source"],
): EffectiveAuthorizationGrant {
    return {
        capability: "audit.read",
        scope: "ALL",
        source,
    };
}

function mockDecision(getDecision: (capability: string) => AuthorizationDecision): void {
    mocks.resolveMany.mockImplementation(
        async (_actor: unknown, capabilities: readonly string[]) => new Map(
            capabilities.map((capability) => [capability, getDecision(capability)]),
        ),
    );
}

describe("Audit presentation capability projection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDecision((capability) => decision(
            capability,
            false,
            [],
            "NO_APPLICABLE_GRANT",
        ));
    });

    it("uses central ADMIN authority rather than a local role compatibility floor", async () => {
        mockDecision((capability) => decision(
            capability,
            true,
            ["ALL"],
            undefined,
            [grant({ type: "SYSTEM_ROLE", role: "ADMIN" })],
        ));

        await expect(
            getAuditPresentationCapabilities(
                buildAuditAuthorizationContext({ id: 7, role: "ADMIN" }, 21),
            ),
        ).resolves.toEqual({ canReadAuditLogs: true });
        expect(mocks.resolveMany).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 7,
                employeeId: 21,
                systemRole: "ADMIN",
                channel: "DASHBOARD",
            }),
            AUDIT_MIGRATED_CAPABILITIES,
        );
    });

    it.each([
        ["USER", { type: "USER", userId: 7 }],
        ["TEAM", { type: "TEAM", teamId: 3 }],
        ["TEAM_ROLE", { type: "TEAM_ROLE", teamId: 3, teamRoleId: 4 }],
    ] as const)("projects an explicit %s grant", async (_label, source) => {
        mockDecision((capability) => decision(
            capability,
            true,
            ["ALL"],
            undefined,
            [grant(source)],
        ));

        await expect(
            getAuditPresentationCapabilities(DASHBOARD_USER),
        ).resolves.toEqual({ canReadAuditLogs: true });
    });

    it("denies an ungranted USER without a compatibility floor", async () => {
        await expect(
            getAuditPresentationCapabilities(DASHBOARD_USER),
        ).resolves.toEqual({ canReadAuditLogs: false });
    });

    it("fails closed for structural denial and does not mask failures", async () => {
        mockDecision((capability) => decision(
            capability,
            false,
            [],
            "CHANNEL_NOT_SUPPORTED",
        ));
        await expect(
            getAuditPresentationCapabilities(DASHBOARD_USER),
        ).resolves.toEqual({ canReadAuditLogs: false });

        const resolverFailure = new Error("authorization persistence failure");
        mocks.resolveMany.mockRejectedValue(resolverFailure);
        await expect(
            getAuditPresentationCapabilities(DASHBOARD_USER),
        ).rejects.toBe(resolverFailure);
    });

    it("does not convert unknown or omitted decisions into allow", async () => {
        mockDecision((capability) => decision(
            capability,
            false,
            [],
            "UNKNOWN_CAPABILITY",
        ));
        await expect(
            getAuditPresentationCapabilities(DASHBOARD_USER),
        ).rejects.toMatchObject({
            authorizationReason: "UNKNOWN_CAPABILITY",
            capability: "audit.read",
        });

        mocks.resolveMany.mockResolvedValue(new Map());
        await expect(
            getAuditPresentationCapabilities(DASHBOARD_USER),
        ).rejects.toThrow("Authorization resolver omitted Audit capability");
    });

    it("exposes the immutable contract shape", async () => {
        const projection = await getAuditPresentationCapabilities(DASHBOARD_USER);

        expect(Object.keys(projection)).toEqual(["canReadAuditLogs"]);
        expect(projection satisfies AuditPresentationCapabilities).toBeTruthy();
    });
});
