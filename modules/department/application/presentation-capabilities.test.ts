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
    buildDepartmentAuthorizationContext,
    DEPARTMENT_MIGRATED_CAPABILITIES,
    getDepartmentPresentationCapabilities,
} from "./authorization";
import type { DepartmentPresentationCapabilities } from "./types";

const DASHBOARD_USER = buildDepartmentAuthorizationContext(
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
        capability: "department.read",
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

describe("Department presentation capability projection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDecision((capability) => decision(
            capability,
            false,
            [],
            "NO_APPLICABLE_GRANT",
        ));
    });

    it("keeps the eligible-workforce Department compatibility bridge", async () => {
        const projection = await getDepartmentPresentationCapabilities(DASHBOARD_USER);

        expect(projection).toEqual({ canReadDepartments: true });
        expect(Object.isFrozen(projection)).toBe(true);
        expect(mocks.resolveMany).toHaveBeenCalledTimes(1);
        expect(mocks.resolveMany).toHaveBeenCalledWith(
            DASHBOARD_USER.authorizationActor,
            DEPARTMENT_MIGRATED_CAPABILITIES,
        );
    });

    it.each([
        ["USER", { type: "USER", userId: 7 }],
        ["TEAM", { type: "TEAM", teamId: 3 }],
        ["TEAM_ROLE", { type: "TEAM_ROLE", teamId: 3, teamRoleId: 4 }],
        ["ADMIN central authority", { type: "SYSTEM_ROLE", role: "ADMIN" }],
    ] as const)("projects an explicit %s grant", async (_label, source) => {
        mockDecision((capability) => decision(
            capability,
            true,
            ["ALL"],
            undefined,
            [grant(source)],
        ));

        await expect(
            getDepartmentPresentationCapabilities(DASHBOARD_USER),
        ).resolves.toEqual({ canReadDepartments: true });
    });

    it("fails closed for structural denial and does not mask failures", async () => {
        mockDecision((capability) => decision(
            capability,
            false,
            [],
            "CHANNEL_NOT_SUPPORTED",
        ));
        await expect(
            getDepartmentPresentationCapabilities(DASHBOARD_USER),
        ).resolves.toEqual({ canReadDepartments: false });

        const resolverFailure = new Error("authorization persistence failure");
        mocks.resolveMany.mockRejectedValue(resolverFailure);
        await expect(
            getDepartmentPresentationCapabilities(DASHBOARD_USER),
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
            getDepartmentPresentationCapabilities(DASHBOARD_USER),
        ).rejects.toMatchObject({
            authorizationReason: "UNKNOWN_CAPABILITY",
            capability: "department.read",
        });

        mocks.resolveMany.mockResolvedValue(new Map());
        await expect(
            getDepartmentPresentationCapabilities(DASHBOARD_USER),
        ).rejects.toThrow("Authorization resolver omitted Department capability");
    });

    it("exposes the immutable contract shape", async () => {
        const projection = await getDepartmentPresentationCapabilities(DASHBOARD_USER);

        expect(Object.keys(projection)).toEqual(["canReadDepartments"]);
        expect(projection satisfies DepartmentPresentationCapabilities).toBeTruthy();
    });
});
