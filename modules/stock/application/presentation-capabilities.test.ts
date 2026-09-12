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
    buildStockAuthorizationContext,
    getStockPresentationCapabilities,
    STOCK_MIGRATED_CAPABILITIES,
} from "./authorization";

const DASHBOARD_USER = buildStockAuthorizationContext(
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
    capability: (typeof STOCK_MIGRATED_CAPABILITIES)[number],
    scope: AuthorizationScope,
): EffectiveAuthorizationGrant {
    return {
        capability,
        scope,
        source: { type: "USER", userId: 7 },
    };
}

function mockDecisions(
    getDecision: (capability: (typeof STOCK_MIGRATED_CAPABILITIES)[number]) => AuthorizationDecision,
): void {
    mocks.resolveMany.mockImplementation(
        async (_actor: unknown, capabilities: readonly string[]) => new Map(
            capabilities.map((capability) => [
                capability,
                getDecision(capability as (typeof STOCK_MIGRATED_CAPABILITIES)[number]),
            ]),
        ),
    );
}

function noGrantDecision(
    capability: (typeof STOCK_MIGRATED_CAPABILITIES)[number],
): AuthorizationDecision {
    return decision(capability, false, [], "NO_APPLICABLE_GRANT");
}

function deniedDecision(
    capability: (typeof STOCK_MIGRATED_CAPABILITIES)[number],
): AuthorizationDecision {
    return decision(capability, false, [], "CHANNEL_NOT_SUPPORTED");
}

describe("Stock presentation capability projection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDecisions(noGrantDecision);
    });

    it("uses one batched resolver call and returns the Dashboard USER compatibility floor", async () => {
        await expect(getStockPresentationCapabilities(DASHBOARD_USER)).resolves.toEqual({
            canReadCatalog: true,
            canReadOwnRequests: true,
            canReadAllRequests: false,
            canCreateRequests: true,
            canCancelOwnRequests: true,
            canCancelAnyRequests: false,
            canProcessRequests: false,
            canManageInventory: false,
            canExportReports: false,
        });

        expect(mocks.resolveMany).toHaveBeenCalledTimes(1);
        expect(mocks.resolveMany).toHaveBeenCalledWith(
            DASHBOARD_USER.authorizationActor,
            STOCK_MIGRATED_CAPABILITIES,
        );
    });

    it("projects the Dashboard ADMIN compatibility floor independently of role checks", async () => {
        const capabilities = await getStockPresentationCapabilities(
            buildStockAuthorizationContext({ id: 7, role: "ADMIN" }, 21, "DASHBOARD"),
        );

        expect(capabilities).toEqual({
            canReadCatalog: true,
            canReadOwnRequests: true,
            canReadAllRequests: true,
            canCreateRequests: true,
            canCancelOwnRequests: true,
            canCancelAnyRequests: true,
            canProcessRequests: true,
            canManageInventory: true,
            canExportReports: true,
        });
    });

    it("keeps LIFF USER requester compatibility and denies processor compatibility", async () => {
        const capabilities = await getStockPresentationCapabilities(
            buildStockAuthorizationContext({ id: 7, role: "USER" }, 21, "LIFF_SELF_SERVICE"),
        );

        expect(capabilities).toEqual({
            canReadCatalog: true,
            canReadOwnRequests: true,
            canReadAllRequests: false,
            canCreateRequests: true,
            canCancelOwnRequests: true,
            canCancelAnyRequests: false,
            canProcessRequests: false,
            canManageInventory: false,
            canExportReports: false,
        });
    });

    it("keeps LIFF ADMIN processor compatibility without the Routine self-service clamp", async () => {
        const capabilities = await getStockPresentationCapabilities(
            buildStockAuthorizationContext({ id: 7, role: "ADMIN" }, 21, "LIFF_SELF_SERVICE"),
        );

        expect(capabilities).toEqual({
            canReadCatalog: true,
            canReadOwnRequests: true,
            canReadAllRequests: true,
            canCreateRequests: true,
            canCancelOwnRequests: true,
            canCancelAnyRequests: true,
            canProcessRequests: true,
            canManageInventory: false,
            canExportReports: false,
        });
    });

    it("honors explicit non-admin grants and keeps read, process, and cancel-all independent", async () => {
        mockDecisions((capability) => {
            switch (capability) {
                case "stock.request.read":
                    return decision(
                        capability,
                        true,
                        ["ALL"],
                        undefined,
                        [userGrant(capability, "ALL")],
                    );
                case "stock.request.cancel":
                    return decision(
                        capability,
                        true,
                        ["ALL"],
                        undefined,
                        [userGrant(capability, "ALL")],
                    );
                case "stock.inventory.manage":
                case "stock.report.export":
                    return decision(
                        capability,
                        true,
                        ["ALL"],
                        undefined,
                        [userGrant(capability, "ALL")],
                    );
                case "stock.request.process":
                    return deniedDecision(capability);
                default:
                    return noGrantDecision(capability);
            }
        });

        await expect(getStockPresentationCapabilities(DASHBOARD_USER)).resolves.toMatchObject({
            canReadAllRequests: true,
            canProcessRequests: false,
            canCancelAnyRequests: true,
            canManageInventory: true,
            canExportReports: true,
        });
    });

    it("does not infer process from read-all or cancel-all", async () => {
        mockDecisions((capability) => capability === "stock.request.read"
            ? decision(capability, true, ["ALL"], undefined, [userGrant(capability, "ALL")])
            : capability === "stock.request.cancel"
                ? decision(capability, true, ["ALL"], undefined, [userGrant(capability, "ALL")])
                : deniedDecision(capability));

        await expect(getStockPresentationCapabilities(DASHBOARD_USER)).resolves.toMatchObject({
            canReadAllRequests: true,
            canCancelAnyRequests: true,
            canProcessRequests: false,
        });
    });

    it("does not infer cancel-all or process from read-all", async () => {
        mockDecisions((capability) => capability === "stock.request.read"
            ? decision(capability, true, ["ALL"], undefined, [userGrant(capability, "ALL")])
            : deniedDecision(capability));

        await expect(getStockPresentationCapabilities(DASHBOARD_USER)).resolves.toMatchObject({
            canReadAllRequests: true,
            canCancelAnyRequests: false,
            canProcessRequests: false,
        });
    });

    it.each([
        ["stock.inventory.manage", "canManageInventory", "canExportReports"],
        ["stock.report.export", "canExportReports", "canManageInventory"],
    ] as const)(
        "keeps %s independent from the other administrative Stock surface",
        async (grantedCapability, grantedProjection, deniedProjection) => {
            mockDecisions((capability) => capability === grantedCapability
                ? decision(
                    capability,
                    true,
                    ["ALL"],
                    undefined,
                    [userGrant(capability, "ALL")],
                )
                : deniedDecision(capability));

            const projection = await getStockPresentationCapabilities(DASHBOARD_USER);

            expect(projection[grantedProjection]).toBe(true);
            expect(projection[deniedProjection]).toBe(false);
        },
    );

    it("denies Dashboard-only inventory and report capabilities in LIFF", async () => {
        const liffUser = buildStockAuthorizationContext(
            { id: 7, role: "USER" },
            21,
            "LIFF_SELF_SERVICE",
        );

        mockDecisions((capability) =>
            capability === "stock.inventory.manage"
                || capability === "stock.report.export"
                ? deniedDecision(capability)
                : noGrantDecision(capability),
        );

        await expect(getStockPresentationCapabilities(liffUser)).resolves.toMatchObject({
            canManageInventory: false,
            canExportReports: false,
        });
    });

    it("maps expected NO_APPLICABLE_GRANT denials through compatibility", async () => {
        mockDecisions((capability) => noGrantDecision(capability));

        await expect(getStockPresentationCapabilities(DASHBOARD_USER)).resolves.toMatchObject({
            canReadCatalog: true,
            canReadOwnRequests: true,
            canCreateRequests: true,
            canCancelOwnRequests: true,
        });
    });

    it("propagates resolver configuration failures", async () => {
        const configurationError = new Error("invalid persisted grant");
        mocks.resolveMany.mockRejectedValue(configurationError);

        await expect(
            getStockPresentationCapabilities(DASHBOARD_USER),
        ).rejects.toBe(configurationError);
    });

    it("does not mask an unknown capability/configuration decision as ordinary denial", async () => {
        mockDecisions((capability) => capability === "stock.catalog.read"
            ? decision(capability, false, [], "UNKNOWN_CAPABILITY")
            : deniedDecision(capability));

        await expect(
            getStockPresentationCapabilities(DASHBOARD_USER),
        ).rejects.toMatchObject({
            authorizationReason: "UNKNOWN_CAPABILITY",
            capability: "stock.catalog.read",
            statusCode: 403,
        });
    });
});
