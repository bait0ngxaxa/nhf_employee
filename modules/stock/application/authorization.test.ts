import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationPersistenceContext,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";

import {
    buildStockAuthorizationContext,
    resolveStockCapabilityForMigration,
    resolveStockCapabilityInTransaction,
    type StockAuthorizedCommandActor,
    type StockMigratedCapability,
} from "./authorization";
import { StockCapabilityDeniedError } from "./errors";
import { requireLiffStockProcessorSession } from "../presentation/liff-stock-auth";

const mocks = vi.hoisted(() => ({
    resolve: vi.fn(),
    resolveInTransaction: vi.fn(),
    lockEmployeeRows: vi.fn(),
    lockUserRows: vi.fn(),
}));

const liffMocks = vi.hoisted(() => ({
    requireLiffWorkforceSession: vi.fn(),
    forbidden: vi.fn(() => new Response(null, { status: 403 })),
}));

vi.mock("@/modules/authorization", () => ({
    authorization: {
        resolve: mocks.resolve,
        resolveInTransaction: mocks.resolveInTransaction,
    },
}));

vi.mock("@/lib/db/row-locks", () => ({
    lockEmployeeRows: mocks.lockEmployeeRows,
    lockUserRows: mocks.lockUserRows,
}));

vi.mock("@/modules/line", () => ({
    requireLiffWorkforceSession: liffMocks.requireLiffWorkforceSession,
}));

vi.mock("@/lib/ssot/http", () => ({
    forbidden: liffMocks.forbidden,
}));

function context(
    role: "ADMIN" | "USER" = "USER",
    channel: "DASHBOARD" | "LIFF_SELF_SERVICE" = "DASHBOARD",
): ReturnType<typeof buildStockAuthorizationContext> {
    return buildStockAuthorizationContext(
        { id: 7, role },
        21,
        channel,
    );
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

function userGrant(
    capability: StockMigratedCapability,
    scope: AuthorizationScope,
): EffectiveAuthorizationGrant {
    return {
        capability,
        scope,
        source: { type: "USER", userId: 7 },
    };
}

function systemRoleGrant(
    capability: StockMigratedCapability,
): EffectiveAuthorizationGrant {
    return {
        capability,
        scope: "ALL",
        source: { type: "SYSTEM_ROLE", role: "ADMIN" },
    };
}

function commandActor(
    authorizationContext = context(),
): StockAuthorizedCommandActor {
    return {
        id: authorizationContext.authorizationActor.userId,
        email: "user@example.com",
        name: "ผู้ใช้",
        authorization: authorizationContext,
    };
}

describe("Stock authorization migration adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
        mocks.resolveInTransaction.mockReset();
        mocks.lockEmployeeRows.mockReset();
        mocks.lockUserRows.mockReset();
        liffMocks.requireLiffWorkforceSession.mockReset();
        liffMocks.forbidden.mockClear();
    });

    it("maps the trusted identity to the central actor", () => {
        expect(context("USER", "DASHBOARD").authorizationActor).toEqual({
            userId: 7,
            employeeId: 21,
            systemRole: "USER",
            channel: "DASHBOARD",
        } satisfies AuthorizationActor);
    });

    it("keeps Dashboard USER catalog and request access on the compatibility floor", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "stock.catalog.read",
                    false,
                    [],
                    "NO_APPLICABLE_GRANT",
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.request.read",
                    false,
                    [],
                    "NO_APPLICABLE_GRANT",
                ),
            );

        const catalog = await resolveStockCapabilityForMigration(
            context(),
            "stock.catalog.read",
        );
        const requests = await resolveStockCapabilityForMigration(
            context(),
            "stock.request.read",
            { requestedScope: "all" },
        );

        expect(catalog.scopes).toEqual(["ALL"]);
        expect(requests.scopes).toEqual(["OWN"]);
        expect(catalog.usedMigrationCompatibility).toBe(true);
        expect(mocks.resolve).toHaveBeenNthCalledWith(
            1,
            context().authorizationActor,
            "stock.catalog.read",
        );
    });

    it("keeps LIFF USER requester compatibility and denies processor access", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "stock.catalog.read",
                    false,
                    [],
                    "NO_APPLICABLE_GRANT",
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.request.read",
                    false,
                    [],
                    "NO_APPLICABLE_GRANT",
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.request.process",
                    false,
                    [],
                    "NO_APPLICABLE_GRANT",
                ),
            );

        const catalog = await resolveStockCapabilityForMigration(
            context("USER", "LIFF_SELF_SERVICE"),
            "stock.catalog.read",
        );
        const requests = await resolveStockCapabilityForMigration(
            context("USER", "LIFF_SELF_SERVICE"),
            "stock.request.read",
            { requestedScope: "all" },
        );

        expect(catalog.scopes).toEqual(["ALL"]);
        expect(requests.scopes).toEqual(["OWN"]);
        await expect(
            resolveStockCapabilityForMigration(
                context("USER", "LIFF_SELF_SERVICE"),
                "stock.request.process",
            ),
        ).rejects.toMatchObject({
            authorizationReason: "NO_APPLICABLE_GRANT",
            statusCode: 403,
        });
    });

    it("keeps Dashboard ADMIN compatibility when no grant applies", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "stock.inventory.manage",
                    false,
                    [],
                    "NO_APPLICABLE_GRANT",
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.request.process",
                    false,
                    [],
                    "NO_APPLICABLE_GRANT",
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.report.export",
                    false,
                    [],
                    "NO_APPLICABLE_GRANT",
                ),
            );

        const inventory = await resolveStockCapabilityForMigration(
            context("ADMIN"),
            "stock.inventory.manage",
        );
        const process = await resolveStockCapabilityForMigration(
            context("ADMIN"),
            "stock.request.process",
        );
        const report = await resolveStockCapabilityForMigration(
            context("ADMIN"),
            "stock.report.export",
        );

        expect(inventory.scopes).toEqual(["ALL"]);
        expect(process.scopes).toEqual(["ALL"]);
        expect(report.scopes).toEqual(["ALL"]);
        expect(inventory.usedMigrationCompatibility).toBe(true);
    });

    it("preserves the Dashboard ADMIN mine/all request distinction", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "stock.request.read",
                    true,
                    ["ALL"],
                    undefined,
                    [systemRoleGrant("stock.request.read")],
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.request.read",
                    true,
                    ["ALL"],
                    undefined,
                    [systemRoleGrant("stock.request.read")],
                ),
            );

        const mine = await resolveStockCapabilityForMigration(
            context("ADMIN"),
            "stock.request.read",
            { requestedScope: "mine" },
        );
        const all = await resolveStockCapabilityForMigration(
            context("ADMIN"),
            "stock.request.read",
            { requestedScope: "all" },
        );

        expect(mine.scopes).toEqual(["ALL"]);
        expect(all.scopes).toEqual(["ALL"]);
        expect(mine.isAdministrative).toBe(true);
        expect(all.isAdministrative).toBe(true);
    });

    it("keeps LIFF ADMIN processor compatibility while leaving dashboard-only capabilities unsupported", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "stock.request.process",
                    true,
                    ["ALL"],
                    undefined,
                    [systemRoleGrant("stock.request.process")],
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.inventory.manage",
                    false,
                    [],
                    "CHANNEL_NOT_SUPPORTED",
                ),
            );

        const processor = await resolveStockCapabilityForMigration(
            context("ADMIN", "LIFF_SELF_SERVICE"),
            "stock.request.process",
            { requestedScope: "all" },
        );

        expect(processor.scopes).toEqual(["ALL"]);
        expect(processor.actor.channel).toBe("LIFF_SELF_SERVICE");
        await expect(
            resolveStockCapabilityForMigration(
                context("ADMIN", "LIFF_SELF_SERVICE"),
                "stock.inventory.manage",
            ),
        ).rejects.toMatchObject({
            authorizationReason: "CHANNEL_NOT_SUPPORTED",
            statusCode: 403,
        });
    });

    it("honors an explicit USER grant without using compatibility", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "stock.request.process",
                true,
                ["ALL"],
                undefined,
                [userGrant("stock.request.process", "ALL")],
            ),
        );

        const result = await resolveStockCapabilityForMigration(
            context(),
            "stock.request.process",
            { requestedScope: "all" },
        );

        expect(result.scopes).toEqual(["ALL"]);
        expect(result.usedMigrationCompatibility).toBe(false);
        expect(result.isAdministrative).toBe(false);
    });

    it("honors an explicit LIFF USER processor grant", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "stock.request.process",
                true,
                ["ALL"],
                undefined,
                [userGrant("stock.request.process", "ALL")],
            ),
        );

        const result = await resolveStockCapabilityForMigration(
            context("USER", "LIFF_SELF_SERVICE"),
            "stock.request.process",
            { requestedScope: "all" },
        );

        expect(result.actor.channel).toBe("LIFF_SELF_SERVICE");
        expect(result.scopes).toEqual(["ALL"]);
        expect(result.usedMigrationCompatibility).toBe(false);
    });

    it("checks LIFF workforce before the central processor capability", async () => {
        liffMocks.requireLiffWorkforceSession.mockResolvedValue({
            ok: false,
            response: new Response(null, { status: 401 }),
        });

        const result = await requireLiffStockProcessorSession();

        expect(result.ok).toBe(false);
        expect(mocks.resolve).not.toHaveBeenCalled();
    });

    it("allows a LIFF USER with an explicit processor grant through the guard", async () => {
        const liffAuth = {
            ok: true as const,
            user: { id: 7, role: "USER", email: "user@example.com" },
            employeeId: 21,
        };
        liffMocks.requireLiffWorkforceSession.mockResolvedValue(liffAuth);
        mocks.resolve.mockResolvedValue(
            decision(
                "stock.request.process",
                true,
                ["ALL"],
                undefined,
                [userGrant("stock.request.process", "ALL")],
            ),
        );

        const result = await requireLiffStockProcessorSession();

        expect(result).toEqual(liffAuth);
        expect(mocks.resolve).toHaveBeenCalledWith(
            {
                userId: 7,
                employeeId: 21,
                systemRole: "USER",
                channel: "LIFF_SELF_SERVICE",
            },
            "stock.request.process",
        );
    });

    it("does not bridge unknown capabilities or structural denials", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "stock.unknown",
                    false,
                    [],
                    "UNKNOWN_CAPABILITY",
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.request.process",
                    false,
                    [],
                    "CHANNEL_NOT_SUPPORTED",
                ),
            );

        await expect(
            resolveStockCapabilityForMigration(context(), "stock.unknown"),
        ).rejects.toBeInstanceOf(StockCapabilityDeniedError);
        await expect(
            resolveStockCapabilityForMigration(
                context("USER", "LIFF_SELF_SERVICE"),
                "stock.request.process",
            ),
        ).rejects.toMatchObject({
            authorizationReason: "CHANNEL_NOT_SUPPORTED",
        });
    });

    it("propagates central authorization configuration failures", async () => {
        const configurationError = new Error("invalid persisted grant");
        mocks.resolve.mockRejectedValue(configurationError);

        await expect(
            resolveStockCapabilityForMigration(
                context(),
                "stock.request.read",
            ),
        ).rejects.toBe(configurationError);
    });

    it("re-reads the active actor and passes the transaction through the central resolver", async () => {
        const tx = {
            user: {
                findUnique: vi.fn().mockResolvedValue({
                    id: 7,
                    role: "USER",
                    isActive: true,
                    deletedAt: null,
                    employee: {
                        id: 21,
                        status: "ACTIVE",
                        deletedAt: null,
                    },
                }),
            },
        } as unknown as AuthorizationPersistenceContext & {
            user: { findUnique: ReturnType<typeof vi.fn> };
        };
        mocks.resolveInTransaction.mockResolvedValue(
            decision(
                "stock.request.cancel",
                true,
                ["OWN"],
                undefined,
                [userGrant("stock.request.cancel", "OWN")],
            ),
        );

        const result = await resolveStockCapabilityInTransaction(
            tx as never,
            commandActor(),
            "stock.request.cancel",
        );

        expect(mocks.lockUserRows).toHaveBeenCalledWith(tx, [7]);
        expect(mocks.lockEmployeeRows).toHaveBeenCalledWith(tx, [21]);
        expect(mocks.resolveInTransaction).toHaveBeenCalledWith(
            {
                userId: 7,
                employeeId: 21,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            "stock.request.cancel",
            tx,
        );
        expect(result.scopes).toEqual(["OWN"]);
    });
});
