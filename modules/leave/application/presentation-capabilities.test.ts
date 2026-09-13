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
    buildLeaveAuthorizationContext,
    getLeavePresentationCapabilities,
    LEAVE_MIGRATED_CAPABILITIES,
} from "./authorization";
import type { LeavePresentationCapabilities } from "./types";

const DASHBOARD_USER = buildLeaveAuthorizationContext(
    { id: 7, role: "USER" },
    21,
    "DASHBOARD",
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

function userGrant(
    capability: (typeof LEAVE_MIGRATED_CAPABILITIES)[number],
    scope: AuthorizationScope,
): EffectiveAuthorizationGrant {
    return {
        capability,
        scope,
        source: { type: "USER", userId: 7 },
    };
}

function noGrantDecision(
    capability: (typeof LEAVE_MIGRATED_CAPABILITIES)[number],
): AuthorizationDecision {
    return decision(capability, false, [], "NO_APPLICABLE_GRANT");
}

function deniedDecision(
    capability: (typeof LEAVE_MIGRATED_CAPABILITIES)[number],
): AuthorizationDecision {
    return decision(capability, false, [], "CHANNEL_NOT_SUPPORTED");
}

function mockDecisions(
    getDecision: (
        capability: (typeof LEAVE_MIGRATED_CAPABILITIES)[number],
    ) => AuthorizationDecision,
): void {
    mocks.resolveMany.mockImplementation(
        async (_actor: unknown, capabilities: readonly string[]) => new Map(
            capabilities.map((capability) => [
                capability,
                getDecision(
                    capability as (typeof LEAVE_MIGRATED_CAPABILITIES)[number],
                ),
            ]),
        ),
    );
}

describe("Leave presentation capability projection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDecisions(noGrantDecision);
    });

    it("uses exactly one batched resolver call for the registered Leave inventory", async () => {
        const projection = await getLeavePresentationCapabilities(DASHBOARD_USER);

        expect(projection).toEqual({
            canReadOwnRequests: true,
            canReadAssignedApprovals: true,
            canCreateOwnRequests: true,
            canCancelOwnRequests: true,
            canApproveAssignedRequests: true,
            canDecideAssignedCancellations: true,
            canRequestOwnNotTaken: true,
            canConfirmAssignedNotTaken: true,
            canManageApprovers: false,
        });
        expect(Object.isFrozen(projection)).toBe(true);

        expect(mocks.resolveMany).toHaveBeenCalledTimes(1);
        expect(mocks.resolveMany).toHaveBeenCalledWith(
            DASHBOARD_USER.authorizationActor,
            LEAVE_MIGRATED_CAPABILITIES,
        );
    });

    it("preserves Dashboard Admin compatibility without projecting recovery authority", async () => {
        const projection = await getLeavePresentationCapabilities(
            buildLeaveAuthorizationContext(
                { id: 7, role: "ADMIN" },
                21,
                "DASHBOARD",
            ),
        );

        expect(projection).toEqual({
            canReadOwnRequests: true,
            canReadAssignedApprovals: true,
            canCreateOwnRequests: true,
            canCancelOwnRequests: true,
            canApproveAssignedRequests: true,
            canDecideAssignedCancellations: true,
            canRequestOwnNotTaken: true,
            canConfirmAssignedNotTaken: true,
            canManageApprovers: true,
        });
    });

    it("keeps each registered operation independent from the other operation capabilities", async () => {
        mockDecisions((capability) => {
            switch (capability) {
                case "leave.approval.read":
                    return decision(
                        capability,
                        true,
                        ["ASSIGNED"],
                        undefined,
                        [userGrant(capability, "ASSIGNED")],
                    );
                case "leave.request.approve":
                    return decision(
                        capability,
                        true,
                        ["ASSIGNED"],
                        undefined,
                        [userGrant(capability, "ASSIGNED")],
                    );
                case "leave.request.not_taken":
                    return decision(
                        capability,
                        true,
                        ["OWN"],
                        undefined,
                        [userGrant(capability, "OWN")],
                    );
                case "leave.approver.manage":
                    return decision(
                        capability,
                        true,
                        ["ALL"],
                        undefined,
                        [userGrant(capability, "ALL")],
                    );
                default:
                    return deniedDecision(capability);
            }
        });

        await expect(getLeavePresentationCapabilities(DASHBOARD_USER)).resolves.toEqual({
            canReadOwnRequests: false,
            canReadAssignedApprovals: true,
            canCreateOwnRequests: false,
            canCancelOwnRequests: false,
            canApproveAssignedRequests: true,
            canDecideAssignedCancellations: false,
            canRequestOwnNotTaken: true,
            canConfirmAssignedNotTaken: false,
            canManageApprovers: true,
        });
    });

    it("does not borrow eligibility between any registered Leave capabilities", async () => {
        const emptyProjection: LeavePresentationCapabilities = {
            canReadOwnRequests: false,
            canReadAssignedApprovals: false,
            canCreateOwnRequests: false,
            canCancelOwnRequests: false,
            canApproveAssignedRequests: false,
            canDecideAssignedCancellations: false,
            canRequestOwnNotTaken: false,
            canConfirmAssignedNotTaken: false,
            canManageApprovers: false,
        };

        const expectOnlyCapability = async (
            capability: (typeof LEAVE_MIGRATED_CAPABILITIES)[number],
            scope: AuthorizationScope,
            field: keyof LeavePresentationCapabilities,
        ): Promise<void> => {
            mockDecisions((candidate) => candidate === capability
                ? decision(
                    candidate,
                    true,
                    [scope],
                    undefined,
                    [userGrant(candidate, scope)],
                )
                : deniedDecision(candidate));

            await expect(
                getLeavePresentationCapabilities(DASHBOARD_USER),
            ).resolves.toEqual({
                ...emptyProjection,
                [field]: true,
            });
        };

        await expectOnlyCapability(
            "leave.request.read",
            "OWN",
            "canReadOwnRequests",
        );
        await expectOnlyCapability(
            "leave.approval.read",
            "ASSIGNED",
            "canReadAssignedApprovals",
        );
        await expectOnlyCapability(
            "leave.request.create",
            "OWN",
            "canCreateOwnRequests",
        );
        await expectOnlyCapability(
            "leave.request.cancel",
            "OWN",
            "canCancelOwnRequests",
        );
        await expectOnlyCapability(
            "leave.request.approve",
            "ASSIGNED",
            "canApproveAssignedRequests",
        );
        await expectOnlyCapability(
            "leave.cancellation.decide",
            "ASSIGNED",
            "canDecideAssignedCancellations",
        );
        await expectOnlyCapability(
            "leave.request.not_taken",
            "OWN",
            "canRequestOwnNotTaken",
        );
        await expectOnlyCapability(
            "leave.request.not_taken",
            "ASSIGNED",
            "canConfirmAssignedNotTaken",
        );
        await expectOnlyCapability(
            "leave.approver.manage",
            "ALL",
            "canManageApprovers",
        );
    });

    it("projects the expected LIFF channel denial as false while keeping supported capabilities", async () => {
        const projection = await getLeavePresentationCapabilities(
            buildLeaveAuthorizationContext(
                { id: 7, role: "USER" },
                21,
                "LIFF_SELF_SERVICE",
            ),
        );

        expect(projection.canReadOwnRequests).toBe(true);
        expect(projection.canReadAssignedApprovals).toBe(true);
        expect(projection.canApproveAssignedRequests).toBe(true);
        expect(projection.canRequestOwnNotTaken).toBe(true);
        expect(projection.canConfirmAssignedNotTaken).toBe(true);
        expect(projection.canDecideAssignedCancellations).toBe(false);
    });

    it("does not mask resolver failures or unknown capability decisions", async () => {
        const configurationError = new Error("invalid persisted authorization");
        mocks.resolveMany.mockRejectedValue(configurationError);
        await expect(
            getLeavePresentationCapabilities(DASHBOARD_USER),
        ).rejects.toBe(configurationError);

        mockDecisions((capability) => capability === "leave.request.read"
            ? decision(capability, false, [], "UNKNOWN_CAPABILITY")
            : deniedDecision(capability));

        await expect(
            getLeavePresentationCapabilities(DASHBOARD_USER),
        ).rejects.toMatchObject({
            authorizationReason: "UNKNOWN_CAPABILITY",
            capability: "leave.request.read",
            statusCode: 403,
        });
    });
});
