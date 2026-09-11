import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationDecision,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";

const mocks = vi.hoisted(() => ({
    resolve: vi.fn(),
    resolveInTransaction: vi.fn(),
}));

vi.mock("@/modules/authorization", () => ({
    authorization: {
        resolve: mocks.resolve,
        resolveInTransaction: mocks.resolveInTransaction,
    },
}));

import {
    getRoutinePresentationCapabilities,
} from "./authorization";
import type { RoutineCommandActor } from "./types";

const ACTOR: RoutineCommandActor = {
    id: 7,
    role: "USER",
    email: "user@example.com",
};

const ALLOWED_DECISION: AuthorizationDecision = {
    capability: "routine.task.read",
    allowed: true,
    scopes: ["ALL"],
    grants: [],
};

const IMPORT_GRANT: EffectiveAuthorizationGrant = {
    capability: "routine.import.manage",
    scope: "ALL",
    source: { type: "USER", userId: 7 },
};

describe("Routine presentation capability projection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.resolve.mockResolvedValue(ALLOWED_DECISION);
    });

    it("projects the nine migrated capabilities into serializable booleans", async () => {
        await expect(
            getRoutinePresentationCapabilities(ACTOR, 21),
        ).resolves.toEqual({
            canReadTasks: true,
            canCreateTasks: true,
            canUpdateTasks: true,
            canDeleteTasks: true,
            canReadOccurrences: true,
            canOverrideOccurrences: true,
            canReassignOccurrences: true,
            canChangeOccurrenceDueDate: true,
            canManageImports: true,
        });
    });

    it("keeps the no-grant USER compatibility floor and honors a configured grant", async () => {
        mocks.resolve.mockImplementation(
            (_actor: unknown, capability: string): Promise<AuthorizationDecision> =>
                capability === "routine.import.manage"
                    ? Promise.resolve({
                          capability,
                          allowed: true,
                          scopes: ["ALL"],
                          grants: [IMPORT_GRANT],
                      })
                    : Promise.resolve({
                          capability,
                          allowed: false,
                          scopes: [],
                          grants: [],
                          reason: "NO_APPLICABLE_GRANT",
                      }),
        );

        await expect(
            getRoutinePresentationCapabilities(ACTOR, 21),
        ).resolves.toEqual({
            canReadTasks: true,
            canCreateTasks: true,
            canUpdateTasks: true,
            canDeleteTasks: true,
            canReadOccurrences: true,
            canOverrideOccurrences: false,
            canReassignOccurrences: false,
            canChangeOccurrenceDueDate: false,
            canManageImports: true,
        });
    });

    it("projects Dashboard ADMIN authorization without applying the LIFF clamp", async () => {
        mocks.resolve.mockImplementation(
            (_actor: unknown, capability: string): Promise<AuthorizationDecision> =>
                Promise.resolve({
                    capability,
                    allowed: true,
                    scopes: ["ALL"],
                    grants: [{
                        capability: capability as EffectiveAuthorizationGrant["capability"],
                        scope: "ALL",
                        source: { type: "SYSTEM_ROLE", role: "ADMIN" },
                    }],
                }),
        );

        const dashboardAdmin: RoutineCommandActor = {
            ...ACTOR,
            role: "ADMIN",
        };

        await expect(
            getRoutinePresentationCapabilities(dashboardAdmin, null),
        ).resolves.toEqual({
            canReadTasks: true,
            canCreateTasks: true,
            canUpdateTasks: true,
            canDeleteTasks: true,
            canReadOccurrences: true,
            canOverrideOccurrences: true,
            canReassignOccurrences: true,
            canChangeOccurrenceDueDate: true,
            canManageImports: true,
        });
        expect(mocks.resolve).toHaveBeenCalledWith(
            {
                userId: 7,
                employeeId: null,
                systemRole: "ADMIN",
                channel: "DASHBOARD",
            },
            "routine.occurrence.override",
        );
    });

    it("keeps no-grant USER compatibility for LIFF self-service", async () => {
        mocks.resolve.mockImplementation(
            (_actor: unknown, capability: string): Promise<AuthorizationDecision> =>
                Promise.resolve({
                    capability,
                    allowed: false,
                    scopes: [],
                    grants: [],
                    reason: "NO_APPLICABLE_GRANT",
                }),
        );

        await expect(
            getRoutinePresentationCapabilities({
                ...ACTOR,
                mode: "LIFF_SELF_SERVICE",
            }, 21),
        ).resolves.toMatchObject({
            canReadTasks: true,
            canCreateTasks: true,
            canUpdateTasks: true,
            canDeleteTasks: true,
            canReadOccurrences: true,
            canOverrideOccurrences: false,
            canReassignOccurrences: false,
            canChangeOccurrenceDueDate: false,
            canManageImports: false,
        });
    });

    it("maps an expected authorization denial to false", async () => {
        mocks.resolve.mockImplementation(
            (_actor: unknown, capability: string): Promise<AuthorizationDecision> =>
                Promise.resolve({
                    capability,
                    allowed: false,
                    scopes: [],
                    grants: [],
                    reason: "CHANNEL_NOT_SUPPORTED",
                }),
        );

        await expect(
            getRoutinePresentationCapabilities(ACTOR, 21),
        ).resolves.toEqual({
            canReadTasks: false,
            canCreateTasks: false,
            canUpdateTasks: false,
            canDeleteTasks: false,
            canReadOccurrences: false,
            canOverrideOccurrences: false,
            canReassignOccurrences: false,
            canChangeOccurrenceDueDate: false,
            canManageImports: false,
        });
    });

    it("propagates authorization configuration failures", async () => {
        const configurationError = new Error("invalid persisted capability");
        mocks.resolve.mockImplementation(
            (_actor: unknown, capability: string): Promise<AuthorizationDecision> =>
                capability === "routine.task.update"
                    ? Promise.reject(configurationError)
                    : Promise.resolve(ALLOWED_DECISION),
        );

        await expect(
            getRoutinePresentationCapabilities(ACTOR, 21),
        ).rejects.toBe(configurationError);
    });

    it("does not mask an unknown capability decision as ordinary denial", async () => {
        mocks.resolve.mockImplementation(
            (_actor: unknown, capability: string): Promise<AuthorizationDecision> =>
                Promise.resolve({
                    capability,
                    allowed: false,
                    scopes: [],
                    grants: [],
                    reason: "UNKNOWN_CAPABILITY",
                }),
        );

        await expect(
            getRoutinePresentationCapabilities(ACTOR, 21),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("keeps Dashboard-only Routine administration unavailable to LIFF ADMIN", async () => {
        mocks.resolve.mockImplementation(
            (_actor: unknown, capability: string): Promise<AuthorizationDecision> => {
                const dashboardOnly = capability === "routine.occurrence.read"
                    || capability === "routine.occurrence.override"
                    || capability === "routine.occurrence.reassign"
                    || capability === "routine.occurrence.change_due_date"
                    || capability === "routine.import.manage";

                return Promise.resolve({
                    capability,
                    allowed: !dashboardOnly,
                    scopes: dashboardOnly ? [] : ["ALL"],
                    grants: [],
                    ...(dashboardOnly
                        ? { reason: "CHANNEL_NOT_SUPPORTED" as const }
                        : {}),
                });
            },
        );

        const liffAdmin: RoutineCommandActor = {
            ...ACTOR,
            role: "ADMIN",
            mode: "LIFF_SELF_SERVICE",
        };

        await expect(
            getRoutinePresentationCapabilities(liffAdmin, 21),
        ).resolves.toEqual({
            canReadTasks: true,
            canCreateTasks: true,
            canUpdateTasks: true,
            canDeleteTasks: true,
            canReadOccurrences: false,
            canOverrideOccurrences: false,
            canReassignOccurrences: false,
            canChangeOccurrenceDueDate: false,
            canManageImports: false,
        });
        expect(mocks.resolve).toHaveBeenCalledWith(
            {
                userId: 7,
                employeeId: 21,
                systemRole: "ADMIN",
                channel: "LIFF_SELF_SERVICE",
            },
            "routine.task.update",
        );
    });
});
