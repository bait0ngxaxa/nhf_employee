import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    AuthorizationDecision,
    EffectiveAuthorizationGrant,
} from "@/modules/authorization";
import type * as AuthorizationModule from "@/modules/authorization";

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

import {
    getRoutinePresentationCapabilities,
    ROUTINE_CAPABILITIES,
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

function allowedDecisions(): ReadonlyMap<string, AuthorizationDecision> {
    return new Map(
        ROUTINE_CAPABILITIES.map((capability) => [
            capability,
            { ...ALLOWED_DECISION, capability },
        ]),
    );
}

function mockResolveMany(
    getDecision: (capability: string) => AuthorizationDecision,
): void {
    mocks.resolveMany.mockImplementation(
        async (_actor: unknown, capabilities: readonly string[]) =>
            new Map(
                capabilities.map((capability) => [
                    capability,
                    getDecision(capability),
                ]),
            ),
    );
}

describe("Routine presentation capability projection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.resolveMany.mockResolvedValue(allowedDecisions());
    });

    it("projects Routine capabilities and effective broad scopes into serializable booleans", async () => {
        await expect(
            getRoutinePresentationCapabilities(ACTOR, 21),
        ).resolves.toEqual({
            canReadTasks: true,
            canReadAllTasks: true,
            canCreateTasks: true,
            canCreateTasksForOthers: true,
            canUpdateTasks: true,
            canUpdateAllTasks: true,
            canDeleteTasks: true,
            canDeleteAllTasks: true,
            canReadOccurrences: true,
            canOverrideOccurrences: true,
            canReassignOccurrences: true,
            canChangeOccurrenceDueDate: true,
            canExportTasks: true,
            canReadSummary: true,
            canReadAllSummary: true,
            canReadReference: true,
            canReadAllReferences: true,
        });
    });

    it("uses one central multi-capability resolution for the projection", async () => {
        await getRoutinePresentationCapabilities(ACTOR, 21);

        expect(mocks.resolveMany).toHaveBeenCalledTimes(1);
        expect(mocks.resolve).not.toHaveBeenCalled();
    });

    it("honors explicit non-admin task grants in the LIFF projection", async () => {
        mockResolveMany((capability) => {
            const allowed = capability === "routine.task.read"
                || capability === "routine.task.create";
            return {
                capability,
                allowed,
                scopes: allowed
                    ? [capability === "routine.task.create" ? "OWN" : "ALL"]
                    : [],
                grants: allowed
                    ? [{
                          capability: capability as EffectiveAuthorizationGrant["capability"],
                          scope: capability === "routine.task.create" ? "OWN" : "ALL",
                          source: { type: "USER", userId: 7 },
                      }]
                    : [],
                ...(allowed ? {} : { reason: "CHANNEL_NOT_SUPPORTED" as const }),
            };
        });

        await expect(
            getRoutinePresentationCapabilities({
                ...ACTOR,
                mode: "LIFF_SELF_SERVICE",
            }, 21),
        ).resolves.toMatchObject({
            canReadTasks: true,
            canCreateTasks: true,
            canUpdateTasks: false,
            canDeleteTasks: false,
        });
    });

    it("projects configured Dashboard ADMIN authority without applying the LIFF clamp", async () => {
        mockResolveMany((capability) => ({
            capability,
            allowed: true,
            scopes: ["ALL"],
            grants: [{
                capability: capability as EffectiveAuthorizationGrant["capability"],
                scope: "ALL",
                source: { type: "USER", userId: 7 },
            }],
        }));

        const dashboardAdmin: RoutineCommandActor = {
            ...ACTOR,
            role: "ADMIN",
        };

        await expect(
            getRoutinePresentationCapabilities(dashboardAdmin, null),
        ).resolves.toEqual({
            canReadTasks: true,
            canReadAllTasks: true,
            canCreateTasks: true,
            canCreateTasksForOthers: true,
            canUpdateTasks: true,
            canUpdateAllTasks: true,
            canDeleteTasks: true,
            canDeleteAllTasks: true,
            canReadOccurrences: true,
            canOverrideOccurrences: true,
            canReassignOccurrences: true,
            canChangeOccurrenceDueDate: true,
            canExportTasks: true,
            canReadSummary: true,
            canReadAllSummary: true,
            canReadReference: true,
            canReadAllReferences: true,
        });
        expect(mocks.resolveMany).toHaveBeenCalledWith(
            {
                userId: 7,
                employeeId: null,
                systemRole: "ADMIN",
                channel: "DASHBOARD",
            },
            ROUTINE_CAPABILITIES,
        );
    });

    it("keeps no-grant USER default policy for LIFF self-service", async () => {
        mockResolveMany((capability) => {
            const dashboardOnly = capability.startsWith("routine.occurrence.")
                || capability === "routine.task.export";

            return {
                capability,
                allowed: false,
                scopes: [],
                grants: [],
                reason: dashboardOnly
                    ? "CHANNEL_NOT_SUPPORTED" as const
                    : "NO_APPLICABLE_GRANT" as const,
            };
        });

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
            canReadOccurrences: false,
            canOverrideOccurrences: false,
            canReassignOccurrences: false,
            canChangeOccurrenceDueDate: false,
            canExportTasks: false,
            canReadSummary: true,
            canReadAllSummary: false,
            canReadReference: true,
        });
    });

    it("maps an expected authorization denial to false", async () => {
        mockResolveMany((capability) => ({
            capability,
            allowed: false,
            scopes: [],
            grants: [],
            reason: "CHANNEL_NOT_SUPPORTED",
        }));

        await expect(
            getRoutinePresentationCapabilities(ACTOR, 21),
        ).resolves.toEqual({
            canReadTasks: false,
            canReadAllTasks: false,
            canCreateTasks: false,
            canCreateTasksForOthers: false,
            canUpdateTasks: false,
            canUpdateAllTasks: false,
            canDeleteTasks: false,
            canDeleteAllTasks: false,
            canReadOccurrences: false,
            canOverrideOccurrences: false,
            canReassignOccurrences: false,
            canChangeOccurrenceDueDate: false,
            canExportTasks: false,
            canReadSummary: false,
            canReadAllSummary: false,
            canReadReference: false,
            canReadAllReferences: false,
        });
    });

    it("propagates authorization configuration failures", async () => {
        const configurationError = new Error("invalid persisted capability");
        mocks.resolveMany.mockRejectedValue(configurationError);

        await expect(
            getRoutinePresentationCapabilities(ACTOR, 21),
        ).rejects.toBe(configurationError);
    });

    it("does not mask an unknown capability decision as ordinary denial", async () => {
        mockResolveMany((capability) => ({
            capability,
            allowed: false,
            scopes: [],
            grants: [],
            reason: "UNKNOWN_CAPABILITY",
        }));

        await expect(
            getRoutinePresentationCapabilities(ACTOR, 21),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("keeps Dashboard-only Routine administration unavailable to LIFF ADMIN", async () => {
        mockResolveMany((capability) => {
            const dashboardOnly = capability === "routine.occurrence.read"
                || capability === "routine.occurrence.override"
                || capability === "routine.occurrence.reassign"
                || capability === "routine.occurrence.change_due_date"
                || capability === "routine.task.export";

            return {
                capability,
                allowed: !dashboardOnly,
                scopes: dashboardOnly ? [] : ["ALL"],
                grants: [],
                ...(dashboardOnly
                    ? { reason: "CHANNEL_NOT_SUPPORTED" as const }
                    : {}),
            };
        });

        const liffAdmin: RoutineCommandActor = {
            ...ACTOR,
            role: "ADMIN",
            mode: "LIFF_SELF_SERVICE",
        };

        await expect(
            getRoutinePresentationCapabilities(liffAdmin, 21),
        ).resolves.toEqual({
            canReadTasks: true,
            canReadAllTasks: false,
            canCreateTasks: true,
            canCreateTasksForOthers: false,
            canUpdateTasks: true,
            canUpdateAllTasks: false,
            canDeleteTasks: true,
            canDeleteAllTasks: false,
            canReadOccurrences: false,
            canOverrideOccurrences: false,
            canReassignOccurrences: false,
            canChangeOccurrenceDueDate: false,
            canExportTasks: false,
            canReadSummary: true,
            canReadAllSummary: false,
            canReadReference: true,
            canReadAllReferences: false,
        });
        expect(mocks.resolveMany).toHaveBeenCalledWith(
            {
                userId: 7,
                employeeId: 21,
                systemRole: "ADMIN",
                channel: "LIFF_SELF_SERVICE",
            },
            ROUTINE_CAPABILITIES,
        );
    });
});
