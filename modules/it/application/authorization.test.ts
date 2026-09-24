import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationActor,
    AuthorizationDecision,
    AuthorizationPersistenceContext,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";
import { AuthorizationConfigurationError } from "@/modules/authorization";
import type * as AuthorizationModule from "@/modules/authorization";

import {
    assertITCapability,
    buildITAuthorizationContext,
    defaultITScopes,
    getITPresentationCapabilities,
    isITTicketResourceInScope,
    ITCapabilityDeniedError,
    IT_CAPABILITIES,
    resolveITCapability,
    resolveITCapabilityInTransaction,
    type ITAuthorizationContext,
    type ITCapability,
} from "./authorization";

const mocks = vi.hoisted(() => ({
    resolve: vi.fn(),
    resolveMany: vi.fn(),
    resolveInTransaction: vi.fn(),
}));

vi.mock("@/modules/authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationModule>();
    return {
        ...actual,
        authorization: {
            ...actual.authorization,
            resolve: mocks.resolve,
            resolveMany: mocks.resolveMany,
            resolveInTransaction: mocks.resolveInTransaction,
        },
    };
});

function context(
    role: "ADMIN" | "USER" = "USER",
): ITAuthorizationContext {
    return buildITAuthorizationContext({ id: 7, role }, 21);
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
        ...(reason === undefined ? {} : { reason }),
    };
}

function noGrantDecision(capability: string): AuthorizationDecision {
    return decision(capability, false, [], "NO_APPLICABLE_GRANT");
}

describe("IT authorization adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
        mocks.resolveMany.mockReset();
        mocks.resolveInTransaction.mockReset();
    });

    it("builds a trusted Dashboard actor with the central identity contract", () => {
        expect(context("ADMIN").authorizationActor).toEqual({
            userId: 7,
            employeeId: 21,
            systemRole: "ADMIN",
            channel: "DASHBOARD",
        } satisfies AuthorizationActor);
    });

    it.each([
        ["it.ticket.read", ["OWN"]],
        ["it.ticket.create", ["OWN"]],
        ["it.ticket.comment", ["OWN"]],
        ["it.ticket.manage", []],
        ["it.analytics.read", []],
    ] as const)(
        "uses the same role-neutral Default Domain Policy for %s",
        (capability, expectedScopes) => {
            expect(defaultITScopes(
                context("USER").authorizationActor,
                capability,
            )).toEqual(expectedScopes);
            expect(defaultITScopes(
                context("ADMIN").authorizationActor,
                capability,
            )).toEqual(expectedScopes);
        },
    );

    it.each(["USER", "ADMIN"] as const)(
        "composes only the approved defaults for %s",
        async (role) => {
            mocks.resolve.mockImplementation(async (
                _actor: AuthorizationActor,
                capability: string,
            ) => noGrantDecision(capability));

            for (const capability of [
                "it.ticket.read",
                "it.ticket.create",
                "it.ticket.comment",
            ] as const) {
                const result = await resolveITCapability(context(role), capability);
                expect(result.defaultScopes).toEqual(["OWN"]);
                expect(result.scopes).toEqual(["OWN"]);
                expect(result.decision).toMatchObject({
                    allowed: false,
                    reason: "NO_APPLICABLE_GRANT",
                });
            }

            for (const capability of [
                "it.ticket.manage",
                "it.analytics.read",
            ] as const) {
                await expect(
                    resolveITCapability(context(role), capability),
                ).rejects.toMatchObject({
                    name: "ITCapabilityDeniedError",
                    authorizationReason: "NO_APPLICABLE_GRANT",
                });
            }
        },
    );

    it("preserves additive configured ALL authority over an OWN default", async () => {
        mocks.resolve.mockResolvedValue(decision(
            "it.ticket.read",
            true,
            ["ALL"],
            undefined,
            [{
                capability: "it.ticket.read",
                scope: "ALL",
                source: { type: "USER", userId: 7 },
            }],
        ));

        const result = await resolveITCapability(context(), "it.ticket.read");

        expect(result.defaultScopes).toEqual(["OWN"]);
        expect(result.decision.scopes).toEqual(["ALL"]);
        expect(result.scopes).toEqual(["ALL"]);
    });

    it("keeps unsupported channel decisions denied for every IT capability", async () => {
        for (const channel of ["LIFF_SELF_SERVICE", "SYSTEM"] as const) {
            for (const capability of IT_CAPABILITIES) {
                const unsupportedContext = {
                    authorizationActor: {
                        ...context().authorizationActor,
                        channel,
                    },
                } as unknown as ITAuthorizationContext;
                mocks.resolve.mockResolvedValueOnce(
                    decision(capability, false, [], "CHANNEL_NOT_SUPPORTED"),
                );

                await expect(
                    resolveITCapability(unsupportedContext, capability),
                ).rejects.toMatchObject({
                    name: "ITCapabilityDeniedError",
                    authorizationReason: "CHANNEL_NOT_SUPPORTED",
                });
            }
        }

        expect(mocks.resolve).toHaveBeenCalledTimes(IT_CAPABILITIES.length * 2);
        expect(mocks.resolve.mock.calls.map(([actor]) => actor.channel)).toEqual(
            [...IT_CAPABILITIES.map(() => "LIFF_SELF_SERVICE"),
                ...IT_CAPABILITIES.map(() => "SYSTEM")],
        );
    });

    it("rejects foreign capability keys before consulting central authorization", async () => {
        await expect(
            resolveITCapability(context(), "stock.catalog.read"),
        ).rejects.toBeInstanceOf(ITCapabilityDeniedError);
        await expect(
            resolveITCapability(context(), "it.ticket.assign"),
        ).rejects.toMatchObject({ authorizationReason: "UNKNOWN_CAPABILITY" });

        expect(mocks.resolve).not.toHaveBeenCalled();
    });

    it("does not rescue resolver configuration errors or mismatched decisions", async () => {
        const configurationError = new AuthorizationConfigurationError(
            "UNSUPPORTED_PERSISTED_SCOPE",
            "invalid persisted grant",
        );
        mocks.resolve.mockRejectedValueOnce(configurationError);
        await expect(
            resolveITCapability(context(), "it.ticket.manage"),
        ).rejects.toBe(configurationError);

        mocks.resolve.mockResolvedValueOnce(
            noGrantDecision("it.ticket.comment"),
        );
        await expect(
            resolveITCapability(context(), "it.ticket.read"),
        ).rejects.toThrow("does not match the requested capability");
    });

    it("projects presentation booleans from composed effective scopes", async () => {
        const configuredCommentGrant: EffectiveAuthorizationGrant = {
            capability: "it.ticket.comment",
            scope: "ALL",
            source: { type: "USER", userId: 7 },
        };
        mocks.resolveMany.mockResolvedValue(new Map([
            ["it.ticket.read", noGrantDecision("it.ticket.read")],
            ["it.ticket.create", noGrantDecision("it.ticket.create")],
            ["it.ticket.comment", decision(
                "it.ticket.comment",
                true,
                ["ALL"],
                undefined,
                [configuredCommentGrant],
            )],
            ["it.ticket.manage", noGrantDecision("it.ticket.manage")],
            ["it.analytics.read", noGrantDecision("it.analytics.read")],
        ]));

        await expect(getITPresentationCapabilities(context())).resolves.toEqual({
            canReadOwnTickets: true,
            canReadAllTickets: false,
            canCreateOwnTickets: true,
            canCommentOwnTickets: true,
            canCommentAllTickets: true,
            canManageTickets: false,
            canReadAnalytics: false,
        });
    });

    it("uses the IT adapter for transaction-aware central resolution", async () => {
        const persistenceContext = {} as AuthorizationPersistenceContext;
        mocks.resolveInTransaction.mockResolvedValue(
            noGrantDecision("it.ticket.create"),
        );

        const result = await resolveITCapabilityInTransaction(
            context(),
            "it.ticket.create",
            persistenceContext,
        );

        expect(result.scopes).toEqual(["OWN"]);
        expect(mocks.resolveInTransaction).toHaveBeenCalledWith(
            context().authorizationActor,
            "it.ticket.create",
            persistenceContext,
        );
    });

    it("asserts only a composed capability decision", async () => {
        mocks.resolve.mockResolvedValue(noGrantDecision("it.ticket.manage"));

        await expect(
            assertITCapability(context(), "it.ticket.manage"),
        ).rejects.toMatchObject({
            name: "ITCapabilityDeniedError",
            statusCode: 403,
            capability: "it.ticket.manage",
        });
    });
});

describe("IT Ticket requester resource scope", () => {
    const actor = { userId: 7, systemRole: "ADMIN" as const };

    it("allows OWN only for the authenticated requester identity", () => {
        expect(isITTicketResourceInScope(
            actor,
            ["OWN"],
            { requesterUserId: 7 },
        )).toBe(true);
        expect(isITTicketResourceInScope(
            actor,
            ["OWN"],
            { requesterUserId: 8 },
        )).toBe(false);
    });

    it("allows ALL without using requester ownership", () => {
        expect(isITTicketResourceInScope(
            actor,
            ["ALL"],
            { requesterUserId: 8 },
        )).toBe(true);
    });

    it("does not treat assignment as requester ownership", () => {
        const assignedTicket = {
            requesterUserId: 8,
            assignedToUserId: actor.userId,
        };

        expect(isITTicketResourceInScope(
            actor,
            ["OWN"],
            assignedTicket,
        )).toBe(false);
    });

    it("denies scopes that do not define IT requester access", () => {
        expect(isITTicketResourceInScope(
            actor,
            ["TEAM", "ASSIGNED"],
            { requesterUserId: actor.userId },
        )).toBe(false);
        expect(isITTicketResourceInScope(
            actor,
            [],
            { requesterUserId: actor.userId },
        )).toBe(false);
    });
});
