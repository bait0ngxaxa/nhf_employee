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
    buildEmployeeAuthorizationContext,
    EMPLOYEE_MIGRATED_CAPABILITIES,
    getEmployeePresentationCapabilities,
} from "./authorization";
import type { EmployeePresentationCapabilities } from "./types";

const DASHBOARD_USER = buildEmployeeAuthorizationContext(
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

function userGrant(
    capability: (typeof EMPLOYEE_MIGRATED_CAPABILITIES)[number],
): EffectiveAuthorizationGrant {
    return {
        capability,
        scope: "ALL",
        source: { type: "USER", userId: 7 },
    };
}

function noGrantDecision(
    capability: (typeof EMPLOYEE_MIGRATED_CAPABILITIES)[number],
): AuthorizationDecision {
    return decision(capability, false, [], "NO_APPLICABLE_GRANT");
}

function deniedDecision(
    capability: (typeof EMPLOYEE_MIGRATED_CAPABILITIES)[number],
): AuthorizationDecision {
    return decision(capability, false, [], "CHANNEL_NOT_SUPPORTED");
}

function mockDecisions(
    getDecision: (
        capability: (typeof EMPLOYEE_MIGRATED_CAPABILITIES)[number],
    ) => AuthorizationDecision,
): void {
    mocks.resolveMany.mockImplementation(
        async (_actor: unknown, capabilities: readonly string[]) => new Map(
            capabilities.map((capability) => [
                capability,
                getDecision(
                    capability as (typeof EMPLOYEE_MIGRATED_CAPABILITIES)[number],
                ),
            ]),
        ),
    );
}

describe("Employee presentation capability projection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDecisions(noGrantDecision);
    });

    it("uses one batched resolver call for the exact Employee inventory", async () => {
        const projection = await getEmployeePresentationCapabilities(DASHBOARD_USER);

        expect(projection).toEqual({
            canReadEmployees: true,
            canReadStats: true,
            canCreateEmployees: false,
            canUpdateEmployees: false,
            canDeleteEmployees: false,
            canImportEmployees: false,
            canExportEmployees: true,
        });
        expect(Object.isFrozen(projection)).toBe(true);
        expect(mocks.resolveMany).toHaveBeenCalledTimes(1);
        expect(mocks.resolveMany).toHaveBeenCalledWith(
            DASHBOARD_USER.authorizationActor,
            EMPLOYEE_MIGRATED_CAPABILITIES,
        );
    });

    it("projects the ADMIN compatibility floor for all seven capabilities", async () => {
        await expect(
            getEmployeePresentationCapabilities(
                buildEmployeeAuthorizationContext({ id: 7, role: "ADMIN" }, 21),
            ),
        ).resolves.toEqual({
            canReadEmployees: true,
            canReadStats: true,
            canCreateEmployees: true,
            canUpdateEmployees: true,
            canDeleteEmployees: true,
            canImportEmployees: true,
            canExportEmployees: true,
        });
    });

    it.each([
        ["employee.create", "canCreateEmployees"],
        ["employee.update", "canUpdateEmployees"],
        ["employee.delete", "canDeleteEmployees"],
        ["employee.import", "canImportEmployees"],
    ] as const)(
        "projects an explicit USER %s grant independently",
        async (grantedCapability, field) => {
            mockDecisions((capability) => capability === grantedCapability
                ? decision(
                    capability,
                    true,
                    ["ALL"],
                    undefined,
                    [userGrant(capability)],
                )
                : noGrantDecision(capability));

            const projection = await getEmployeePresentationCapabilities(
                DASHBOARD_USER,
            );

            expect(projection[field]).toBe(true);
            expect(projection.canReadEmployees).toBe(true);
            expect(projection.canReadStats).toBe(true);
            expect(projection.canExportEmployees).toBe(true);
            for (const candidate of [
                "canCreateEmployees",
                "canUpdateEmployees",
                "canDeleteEmployees",
                "canImportEmployees",
            ] as const) {
                if (candidate !== field) {
                    expect(projection[candidate]).toBe(false);
                }
            }
        },
    );

    it("does not infer mutation access from export access", async () => {
        mockDecisions((capability) => capability === "employee.export"
            ? decision(
                capability,
                true,
                ["ALL"],
                undefined,
                [userGrant(capability)],
            )
            : deniedDecision(capability));

        await expect(
            getEmployeePresentationCapabilities(DASHBOARD_USER),
        ).resolves.toMatchObject({
            canExportEmployees: true,
            canCreateEmployees: false,
            canUpdateEmployees: false,
            canDeleteEmployees: false,
            canImportEmployees: false,
        });
    });

    it("projects expected authorization denials as false", async () => {
        mockDecisions((capability) => capability === "employee.update"
            ? deniedDecision(capability)
            : noGrantDecision(capability));

        await expect(
            getEmployeePresentationCapabilities(DASHBOARD_USER),
        ).resolves.toMatchObject({
            canReadEmployees: true,
            canReadStats: true,
            canUpdateEmployees: false,
            canExportEmployees: true,
        });
    });

    it("does not mask resolver failures or unknown and omitted decisions", async () => {
        const configurationError = new Error("invalid persisted authorization");
        mocks.resolveMany.mockRejectedValue(configurationError);
        await expect(
            getEmployeePresentationCapabilities(DASHBOARD_USER),
        ).rejects.toBe(configurationError);

        mockDecisions((capability) => capability === "employee.read"
            ? decision(capability, false, [], "UNKNOWN_CAPABILITY")
            : deniedDecision(capability));
        await expect(
            getEmployeePresentationCapabilities(DASHBOARD_USER),
        ).rejects.toMatchObject({
            authorizationReason: "UNKNOWN_CAPABILITY",
            capability: "employee.read",
            statusCode: 403,
        });

        mocks.resolveMany.mockImplementation(
            async () => new Map([
                ["employee.read", noGrantDecision("employee.read")],
            ]),
        );
        await expect(
            getEmployeePresentationCapabilities(DASHBOARD_USER),
        ).rejects.toThrow("Authorization resolver omitted Employee capability");
    });

    it("retains the immutable contract shape including the projected delete field", async () => {
        const projection = await getEmployeePresentationCapabilities(DASHBOARD_USER);

        expect(Object.keys(projection)).toEqual([
            "canReadEmployees",
            "canReadStats",
            "canCreateEmployees",
            "canUpdateEmployees",
            "canDeleteEmployees",
            "canImportEmployees",
            "canExportEmployees",
        ]);
        expect(Object.isFrozen(projection)).toBe(true);
        expect(projection satisfies EmployeePresentationCapabilities).toBeTruthy();
    });
});
