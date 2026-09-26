import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as AuthorizationModule from "@/modules/authorization";
import type {
    AuthorizationDecision,
    AuthorizationScope,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";

const mocks = vi.hoisted(() => ({
    resolve: vi.fn(),
    resolveMany: vi.fn(),
}));

vi.mock("@/modules/authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationModule>();
    return {
        ...actual,
        authorization: {
            ...actual.authorization,
            resolve: mocks.resolve,
            resolveMany: mocks.resolveMany,
        },
    };
});

import {
    assertEmailRequestCapabilityScope,
    buildEmailRequestAuthorizationContext,
    defaultEmailRequestScopes,
    EmailRequestCapabilityDeniedError,
    getEmailRequestPresentationCapabilities,
    resolveEmailRequestCapability,
} from "./authorization";

import { buildEmailRequestAuthorizationActor } from "./authorization";

function grant(
    capability: string,
    scope: AuthorizationScope,
    source: EffectiveAuthorizationGrant["source"],
): EffectiveAuthorizationGrant {
    return {
        capability: capability as EffectiveAuthorizationGrant["capability"],
        scope,
        source,
    };
}

function decision(
    capability: string,
    scopes: readonly AuthorizationScope[],
    grants: readonly EffectiveAuthorizationGrant[] = [],
    reason?: AuthorizationDecision["reason"],
): AuthorizationDecision {
    return {
        capability,
        allowed: scopes.length > 0,
        scopes,
        grants,
        ...(reason === undefined ? {} : { reason }),
    };
}

describe("Email Request authorization adapter", () => {
    beforeEach(() => {
        mocks.resolve.mockReset();
        mocks.resolveMany.mockReset();
    });

    it("denies a USER without configured authority and provides no defaults", async () => {
        mocks.resolve.mockResolvedValue(
            decision("email.request.read", [], [], "NO_APPLICABLE_GRANT"),
        );
        const context = buildEmailRequestAuthorizationContext({ id: 7, role: "USER" });

        expect(defaultEmailRequestScopes(context.authorizationActor, "email.request.read"))
            .toEqual([]);
        await expect(
            resolveEmailRequestCapability(context, "email.request.read"),
        ).rejects.toMatchObject({
            name: "EmailRequestCapabilityDeniedError",
            authorizationReason: "NO_APPLICABLE_GRANT",
        });
    });

    it("keeps the legacy API actor on Dashboard with no Employee identity", () => {
        expect(buildEmailRequestAuthorizationActor({ id: 7, role: "USER" })).toEqual({
            userId: 7,
            employeeId: null,
            systemRole: "USER",
            channel: "DASHBOARD",
        });
    });

    it("does not accept Ticket capability keys as Email Request authority", async () => {
        await expect(resolveEmailRequestCapability(
            buildEmailRequestAuthorizationContext({ id: 7, role: "USER" }),
            "it.ticket.create",
        )).rejects.toMatchObject({
            name: "AuthorizationConfigurationError",
            code: "UNKNOWN_PERSISTED_CAPABILITY",
        });
    });

    it("exposes configured OWN and ALL read authority and configured create authority", async () => {
        mocks.resolve
            .mockResolvedValueOnce(
                decision(
                    "email.request.read",
                    ["OWN"],
                    [grant("email.request.read", "OWN", { type: "USER", userId: 7 })],
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "email.request.read",
                    ["ALL"],
                    [grant("email.request.read", "ALL", { type: "USER", userId: 7 })],
                ),
            )
            .mockResolvedValueOnce(
                decision(
                    "email.request.create",
                    ["ALL"],
                    [grant("email.request.create", "ALL", { type: "USER", userId: 7 })],
                ),
            );
        const context = buildEmailRequestAuthorizationContext({ id: 7, role: "USER" });

        const own = await resolveEmailRequestCapability(context, "email.request.read");
        const all = await resolveEmailRequestCapability(context, "email.request.read");
        const create = await resolveEmailRequestCapability(context, "email.request.create");

        expect(assertEmailRequestCapabilityScope(own, "OWN").scopes).toEqual(["OWN"]);
        expect(assertEmailRequestCapabilityScope(all, "OWN").scopes).toEqual(["ALL"]);
        expect(assertEmailRequestCapabilityScope(create, "ALL").scopes).toEqual(["ALL"]);
        expect(own.actor.systemRole).toBe("USER");
    });

    it("fails closed for unsupported scope and channel decisions", async () => {
        mocks.resolve.mockResolvedValueOnce(
            decision(
                "email.request.create",
                ["ASSIGNED"],
                [grant("email.request.create", "ASSIGNED", { type: "USER", userId: 7 })],
            ),
        );
        await expect(
            resolveEmailRequestCapability(
                buildEmailRequestAuthorizationContext({ id: 7, role: "USER" }),
                "email.request.create",
            ),
        ).rejects.toMatchObject({
            name: "AuthorizationConfigurationError",
            code: "UNSUPPORTED_PERSISTED_SCOPE",
        });

        mocks.resolve.mockResolvedValueOnce(
            decision("email.request.create", [], [], "CHANNEL_NOT_SUPPORTED"),
        );
        await expect(
            resolveEmailRequestCapability(
                buildEmailRequestAuthorizationContext({ id: 7, role: "USER" }),
                "email.request.create",
            ),
        ).rejects.toBeInstanceOf(EmailRequestCapabilityDeniedError);
    });

    it("propagates resolver/configuration failures and accepts configured ADMIN authority", async () => {
        const resolverError = new Error("invalid persisted authorization");
        mocks.resolve.mockRejectedValueOnce(resolverError);
        await expect(
            resolveEmailRequestCapability(
                buildEmailRequestAuthorizationContext({ id: 7, role: "USER" }),
                "email.request.read",
            ),
        ).rejects.toBe(resolverError);

        mocks.resolve.mockResolvedValueOnce(
            decision(
                "email.request.create",
                ["ALL"],
                [grant("email.request.create", "ALL", {
                    type: "USER",
                    userId: 7,
                })],
            ),
        );
        const admin = await resolveEmailRequestCapability(
            buildEmailRequestAuthorizationContext({ id: 7, role: "ADMIN" }),
            "email.request.create",
        );
        expect(admin.scopes).toEqual(["ALL"]);
        expect(admin.defaultScopes).toEqual([]);
    });

    it.each([
        {
            label: "read-only",
            readScopes: ["OWN"] as const,
            createScopes: [] as const,
            expected: { canReadRequests: true, canCreateRequests: false },
        },
        {
            label: "create-only",
            readScopes: [] as const,
            createScopes: ["ALL"] as const,
            expected: { canReadRequests: false, canCreateRequests: true },
        },
        {
            label: "read and create",
            readScopes: ["ALL"] as const,
            createScopes: ["ALL"] as const,
            expected: { canReadRequests: true, canCreateRequests: true },
        },
        {
            label: "no capability",
            readScopes: [] as const,
            createScopes: [] as const,
            expected: { canReadRequests: false, canCreateRequests: false },
        },
    ])("projects configured USER Email Request $label authority", async ({
        readScopes,
        createScopes,
        expected,
    }) => {
        mocks.resolveMany.mockResolvedValue(new Map([
            ["email.request.read", decision("email.request.read", readScopes)],
            ["email.request.create", decision("email.request.create", createScopes)],
        ]));

        await expect(
            getEmailRequestPresentationCapabilities(
                buildEmailRequestAuthorizationContext({ id: 7, role: "USER" }),
            ),
        ).resolves.toEqual(expected);
        expect(mocks.resolveMany).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 7, channel: "DASHBOARD" }),
            ["email.request.read", "email.request.create"],
        );
    });

    it("projects configured ADMIN authority through resolved capability grants", async () => {
        mocks.resolveMany.mockResolvedValue(new Map([
            ["email.request.read", decision("email.request.read", ["ALL"], [
                grant("email.request.read", "ALL", { type: "USER", userId: 7 }),
            ])],
            ["email.request.create", decision("email.request.create", ["ALL"], [
                grant("email.request.create", "ALL", { type: "USER", userId: 7 }),
            ])],
        ]));

        await expect(
            getEmailRequestPresentationCapabilities(
                buildEmailRequestAuthorizationContext({ id: 7, role: "ADMIN" }),
            ),
        ).resolves.toEqual({ canReadRequests: true, canCreateRequests: true });
    });
});
