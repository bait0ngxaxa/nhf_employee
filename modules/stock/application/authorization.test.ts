import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationPersistenceContext,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";
import type * as AuthorizationModule from "@/modules/authorization";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";

import {
    buildStockAuthorizationContext,
    defaultStockScopes,
    resolveStockCapability,
    resolveStockCapabilityInTransaction,
    type StockAuthorizedCommandActor,
    type StockCapability,
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

vi.mock("@/modules/authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationModule>();
    return {
        ...actual,
        authorization: {
            ...actual.authorization,
            resolve: mocks.resolve,
            resolveInTransaction: mocks.resolveInTransaction,
        },
    };
});

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
    capability: StockCapability,
    scope: AuthorizationScope,
): EffectiveAuthorizationGrant {
    return {
        capability,
        scope,
        source: { type: "USER", userId: 7 },
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

describe("Stock authorization adapter", () => {
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

    it("composes the permanent Dashboard USER catalog and request defaults", async () => {
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

        const catalog = await resolveStockCapability(
            context(),
            "stock.catalog.read",
        );
        const requests = await resolveStockCapability(
            context(),
            "stock.request.read",
            { requestedScope: "all" },
        );

        expect(catalog.scopes).toEqual(["ALL"]);
        expect(requests.scopes).toEqual(["OWN"]);
        expect(catalog.defaultScopes).toEqual(["ALL"]);
        expect(requests.defaultScopes).toEqual(["OWN"]);
        expect(mocks.resolve).toHaveBeenNthCalledWith(
            1,
            context().authorizationActor,
            "stock.catalog.read",
        );
    });

    it.each([
        ["stock.catalog.read", ["ALL"]],
        ["stock.request.read", ["OWN"]],
        ["stock.request.create", ["OWN"]],
        ["stock.request.cancel", ["OWN"]],
        ["stock.inventory.manage", []],
        ["stock.request.process", []],
        ["stock.report.export", []],
    ] as const)(
        "applies the same role-neutral default policy for %s",
        async (capability, expectedScopes) => {
            expect(defaultStockScopes(
                context("USER").authorizationActor,
                capability,
            )).toEqual(expectedScopes);
            expect(defaultStockScopes(
                context("ADMIN").authorizationActor,
                capability,
            )).toEqual(expectedScopes);
            mocks.resolve.mockResolvedValue(
                decision(capability, false, [], "NO_APPLICABLE_GRANT"),
            );

            if (expectedScopes.length === 0) {
                for (const role of ["USER", "ADMIN"] as const) {
                    await expect(
                        resolveStockCapability(context(role), capability),
                    ).rejects.toMatchObject({
                        authorizationReason: "NO_APPLICABLE_GRANT",
                    });
                }
                return;
            }

            const [user, admin] = await Promise.all([
                resolveStockCapability(context("USER"), capability),
                resolveStockCapability(context("ADMIN"), capability),
            ]);
            expect(user.defaultScopes).toEqual(expectedScopes);
            expect(admin.defaultScopes).toEqual(expectedScopes);
            expect(admin.scopes).toEqual(user.scopes);
        },
    );

    it("composes LIFF USER requester defaults and denies processor access", async () => {
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

        const catalog = await resolveStockCapability(
            context("USER", "LIFF_SELF_SERVICE"),
            "stock.catalog.read",
        );
        const requests = await resolveStockCapability(
            context("USER", "LIFF_SELF_SERVICE"),
            "stock.request.read",
            { requestedScope: "all" },
        );

        expect(catalog.scopes).toEqual(["ALL"]);
        expect(requests.scopes).toEqual(["OWN"]);
        await expect(
            resolveStockCapability(
                context("USER", "LIFF_SELF_SERVICE"),
                "stock.request.process",
            ),
        ).rejects.toMatchObject({
            authorizationReason: "NO_APPLICABLE_GRANT",
            statusCode: 403,
        });
    });

    it("uses configured authority for Dashboard ADMIN", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "stock.inventory.manage",
                    true,
                    ["ALL"],
                    undefined,
                    [userGrant("stock.inventory.manage", "ALL")],
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.request.process",
                    true,
                    ["ALL"],
                    undefined,
                    [userGrant("stock.request.process", "ALL")],
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.report.export",
                    true,
                    ["ALL"],
                    undefined,
                    [userGrant("stock.report.export", "ALL")],
                ),
            );

        const inventory = await resolveStockCapability(
            context("ADMIN"),
            "stock.inventory.manage",
        );
        const process = await resolveStockCapability(
            context("ADMIN"),
            "stock.request.process",
        );
        const report = await resolveStockCapability(
            context("ADMIN"),
            "stock.report.export",
        );

        expect(inventory.scopes).toEqual(["ALL"]);
        expect(process.scopes).toEqual(["ALL"]);
        expect(report.scopes).toEqual(["ALL"]);
        expect(inventory.defaultScopes).toEqual([]);
        expect(process.defaultScopes).toEqual([]);
        expect(report.defaultScopes).toEqual([]);
        expect(inventory.isAdministrative).toBe(false);
    });

    it("preserves the Dashboard ADMIN mine/all request distinction for configured authority", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "stock.request.read",
                    true,
                    ["ALL"],
                    undefined,
                    [userGrant("stock.request.read", "ALL")],
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.request.read",
                    true,
                    ["ALL"],
                    undefined,
                    [userGrant("stock.request.read", "ALL")],
                ),
            );

        const mine = await resolveStockCapability(
            context("ADMIN"),
            "stock.request.read",
            { requestedScope: "mine" },
        );
        const all = await resolveStockCapability(
            context("ADMIN"),
            "stock.request.read",
            { requestedScope: "all" },
        );

        expect(mine.scopes).toEqual(["ALL"]);
        expect(all.scopes).toEqual(["ALL"]);
        expect(mine.isAdministrative).toBe(false);
        expect(all.isAdministrative).toBe(false);
    });

    it("keeps LIFF ADMIN processor authority while leaving dashboard-only capabilities unsupported", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "stock.request.process",
                    true,
                    ["ALL"],
                    undefined,
                    [userGrant("stock.request.process", "ALL")],
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.inventory.manage",
                    false,
                    [],
                    "CHANNEL_NOT_SUPPORTED",
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "stock.report.export",
                    false,
                    [],
                    "CHANNEL_NOT_SUPPORTED",
                ),
            );

        const processor = await resolveStockCapability(
            context("ADMIN", "LIFF_SELF_SERVICE"),
            "stock.request.process",
            { requestedScope: "all" },
        );

        expect(processor.scopes).toEqual(["ALL"]);
        expect(processor.actor.channel).toBe("LIFF_SELF_SERVICE");
        await expect(
            resolveStockCapability(
                context("ADMIN", "LIFF_SELF_SERVICE"),
                "stock.inventory.manage",
            ),
        ).rejects.toMatchObject({
            authorizationReason: "CHANNEL_NOT_SUPPORTED",
            statusCode: 403,
        });
        await expect(
            resolveStockCapability(
                context("ADMIN", "LIFF_SELF_SERVICE"),
                "stock.report.export",
            ),
        ).rejects.toMatchObject({
            authorizationReason: "CHANNEL_NOT_SUPPORTED",
            statusCode: 403,
        });
    });

    it("adds an explicit USER grant to the permanent policy", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "stock.request.process",
                true,
                ["ALL"],
                undefined,
                [userGrant("stock.request.process", "ALL")],
            ),
        );

        const result = await resolveStockCapability(
            context(),
            "stock.request.process",
            { requestedScope: "all" },
        );

        expect(result.scopes).toEqual(["ALL"]);
        expect(result.defaultScopes).toEqual([]);
        expect(result.isAdministrative).toBe(false);
    });

    it("does not turn a requested all view into a broader effective scope", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "stock.request.read",
                true,
                ["OWN"],
                undefined,
                [userGrant("stock.request.read", "OWN")],
            ),
        );

        const result = await resolveStockCapability(
            context(),
            "stock.request.read",
            { requestedScope: "all" },
        );

        expect(result.actor).toEqual({
            userId: 7,
            employeeId: 21,
            systemRole: "USER",
            channel: "DASHBOARD",
        });
        expect(result.scopes).toEqual(["OWN"]);
        expect(result.defaultScopes).toEqual(["OWN"]);
        expect(mocks.resolve).toHaveBeenCalledWith(
            result.actor,
            "stock.request.read",
        );
    });

    it("keeps cancel authority at OWN when the requested view is all", async () => {
        mocks.resolve.mockResolvedValue(
            decision(
                "stock.request.cancel",
                false,
                [],
                "NO_APPLICABLE_GRANT",
            ),
        );

        const result = await resolveStockCapability(
            context(),
            "stock.request.cancel",
            { requestedScope: "all" },
        );

        expect(result.defaultScopes).toEqual(["OWN"]);
        expect(result.scopes).toEqual(["OWN"]);
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

        const result = await resolveStockCapability(
            context("USER", "LIFF_SELF_SERVICE"),
            "stock.request.process",
            { requestedScope: "all" },
        );

        expect(result.actor.channel).toBe("LIFF_SELF_SERVICE");
        expect(result.scopes).toEqual(["ALL"]);
        expect(result.defaultScopes).toEqual([]);
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
            resolveStockCapability(context(), "stock.unknown"),
        ).rejects.toBeInstanceOf(StockCapabilityDeniedError);
        await expect(
            resolveStockCapability(
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
            resolveStockCapability(
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

    it("does not revive stale Dashboard ADMIN authority after the persisted role is downgraded to USER", async () => {
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
        } as never;
        const staleActor = commandActor(context("ADMIN"));
        mocks.resolveInTransaction.mockResolvedValue(
            decision(
                "stock.inventory.manage",
                false,
                [],
                "NO_APPLICABLE_GRANT",
            ),
        );
        expect(staleActor.authorization.authorizationActor.systemRole).toBe(
            "ADMIN",
        );

        await expect(
            resolveStockCapabilityInTransaction(
                tx,
                staleActor,
                "stock.inventory.manage",
            ),
        ).rejects.toMatchObject({
            capability: "stock.inventory.manage",
            authorizationReason: "NO_APPLICABLE_GRANT",
            statusCode: 403,
        });
        expect(mocks.resolveInTransaction).toHaveBeenCalledWith(
            {
                userId: 7,
                employeeId: 21,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            "stock.inventory.manage",
            tx,
        );
    });

    it.each([
        "stock.inventory.manage",
        "stock.request.process",
        "stock.request.cancel",
    ] as const)(
        "rejects Dashboard ADMIN account-only transaction access without an employee profile for %s",
        async (capability) => {
            const tx = {
                user: {
                    findUnique: vi.fn().mockResolvedValue({
                        id: 7,
                        role: "ADMIN",
                        isActive: true,
                        deletedAt: null,
                        employee: null,
                    }),
                },
            } as never;
            await expect(
                resolveStockCapabilityInTransaction(
                    tx,
                    commandActor(context("ADMIN")),
                    capability,
                ),
            ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
            expect(mocks.lockEmployeeRows).not.toHaveBeenCalled();
            expect(mocks.resolveInTransaction).not.toHaveBeenCalled();
        },
    );

    it.each([
        ["stock.request.create", "DASHBOARD"],
        ["stock.request.process", "LIFF_SELF_SERVICE"],
    ] as const)(
        "still requires an active employee for ADMIN %s on %s",
        async (capability, channel) => {
            const tx = {
                user: {
                    findUnique: vi.fn().mockResolvedValue({
                        id: 7,
                        role: "ADMIN",
                        isActive: true,
                        deletedAt: null,
                        employee: null,
                    }),
                },
            } as never;

            await expect(
                resolveStockCapabilityInTransaction(
                    tx,
                    commandActor(context("ADMIN", channel)),
                    capability,
                ),
            ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
            expect(mocks.resolveInTransaction).not.toHaveBeenCalled();
        },
    );

    it("still requires an active employee for a Dashboard USER transaction actor", async () => {
        const tx = {
            user: {
                findUnique: vi.fn().mockResolvedValue({
                    id: 7,
                    role: "USER",
                    isActive: true,
                    deletedAt: null,
                    employee: null,
                }),
            },
        } as never;

        await expect(
            resolveStockCapabilityInTransaction(
                tx,
                commandActor(context("USER")),
                "stock.request.cancel",
            ),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
        expect(mocks.resolveInTransaction).not.toHaveBeenCalled();
    });
});
