import { describe, expect, it, vi } from "vitest";

import {
    CAPABILITY_REGISTRY,
    type AuthorizationActor,
    type AuthorizationDecision,
    type AuthorizationGrantSource,
    type CapabilityKey,
} from "@/modules/authorization";

import {
    authorizationAdministrationEffectiveAccessProvider,
} from "@/app/api/authorization/administration/_lib/effective-access";

function noGrantDecision(capability: CapabilityKey): AuthorizationDecision {
    return {
        capability,
        allowed: false,
        scopes: [],
        grants: [],
        reason: "NO_APPLICABLE_GRANT",
    };
}

function allowedDecision(
    capability: CapabilityKey,
    scope: "OWN" | "ASSIGNED" | "CREATED" | "ALL",
    source: AuthorizationGrantSource,
): AuthorizationDecision {
    return {
        capability,
        allowed: true,
        scopes: [scope],
        grants: [{ capability, scope, source }],
    };
}

function noGrantMap(): ReadonlyMap<string, AuthorizationDecision> {
    return new Map(
        CAPABILITY_REGISTRY.definitions.map(({ key }) => [key, noGrantDecision(key)]),
    );
}

type EffectiveAccessInspection =
    Awaited<ReturnType<typeof authorizationAdministrationEffectiveAccessProvider.inspect>>[number];

function findRow(
    rows: readonly EffectiveAccessInspection[],
    capability: string,
    contextKey: string,
) {
    return rows.find((row) =>
        row.capability === capability && row.context.key === contextKey,
    );
}

const USER_DASHBOARD_ACTOR: AuthorizationActor = {
    userId: 7,
    employeeId: 1007,
    systemRole: "USER",
    channel: "DASHBOARD",
};

describe("Authorization Administration effective-access composition", () => {
    it("projects migrated domain defaults and trusted context variants without a second policy engine", async () => {
        const resolveMany = vi.fn(async (
            _actor: AuthorizationActor,
            capabilityKeys: readonly CapabilityKey[],
        ) => new Map(capabilityKeys.map((key) => [key, noGrantDecision(key)])));

        const rows = await authorizationAdministrationEffectiveAccessProvider.inspect({
            actor: USER_DASHBOARD_ACTOR,
            dashboardDecisions: noGrantMap(),
            resolver: { resolveMany },
        });

        expect(findRow(rows, "department.read", "dashboard")).toMatchObject({
            defaultScopes: ["ALL"],
            composedScopes: ["ALL"],
            effectiveScopes: ["ALL"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "notification.inbox.read", "dashboard")).toMatchObject({
            defaultScopes: ["OWN"],
            effectiveScopes: ["OWN"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "employee.read", "dashboard")).toMatchObject({
            defaultScopes: ["ALL"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "employee.create", "dashboard")).toMatchObject({
            defaultScopes: [],
            effectiveScopes: [],
            state: "UNAVAILABLE",
        });

        expect(findRow(rows, "routine.task.read", "dashboard.management")).toMatchObject({
            defaultScopes: ["CREATED", "ASSIGNED"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "routine.task.read", "dashboard.work-item.mine")).toMatchObject({
            defaultScopes: ["ASSIGNED"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "routine.task.read", "dashboard.work-item.all")).toMatchObject({
            defaultScopes: ["CREATED", "ASSIGNED"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "routine.summary.read", "dashboard.summary.mine")).toMatchObject({
            defaultScopes: ["ASSIGNED"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "routine.summary.read", "dashboard.summary.all")).toMatchObject({
            defaultScopes: ["ASSIGNED"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "routine.reference.read", "dashboard")).toMatchObject({
            defaultScopes: ["OWN"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "routine.task.export", "liff.self-service")).toMatchObject({
            configuredDecision: null,
            state: "UNSUPPORTED",
        });

        expect(findRow(rows, "stock.catalog.read", "dashboard")).toMatchObject({
            defaultScopes: ["ALL"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "stock.request.read", "dashboard")).toMatchObject({
            defaultScopes: ["OWN"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "stock.request.process", "dashboard")).toMatchObject({
            defaultScopes: [],
            state: "UNAVAILABLE",
        });
        expect(findRow(rows, "stock.request.process", "liff.self-service")).toMatchObject({
            defaultScopes: [],
            state: "UNAVAILABLE",
        });

        expect(findRow(rows, "leave.request.read", "dashboard")).toMatchObject({
            defaultScopes: ["OWN"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "leave.approval.read", "dashboard")).toMatchObject({
            defaultScopes: ["ASSIGNED"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "leave.request.not_taken", "dashboard")).toMatchObject({
            defaultScopes: ["OWN", "ASSIGNED"],
            state: "AVAILABLE",
        });
        expect(findRow(rows, "leave.approver.manage", "dashboard")).toMatchObject({
            defaultScopes: [],
            state: "UNAVAILABLE",
        });
        expect(findRow(rows, "leave.recovery.manage", "dashboard")).toMatchObject({
            defaultScopes: [],
            effectiveScopes: [],
            state: "UNAVAILABLE",
        });
        expect(findRow(rows, "leave.cancellation.decide", "dashboard")).toBeDefined();
        expect(findRow(rows, "leave.cancellation.decide", "liff.self-service")).toBeUndefined();

        expect(findRow(rows, "audit.read", "dashboard")).toMatchObject({
            defaultScopes: [],
            state: "UNAVAILABLE",
        });
        expect(findRow(rows, "email.request.read", "dashboard")).toMatchObject({
            configuredDecision: noGrantDecision("email.request.read"),
            defaultScopes: [],
            effectiveScopes: [],
            state: "UNAVAILABLE",
        });
        expect(findRow(rows, "email.request.create", "dashboard")).toMatchObject({
            configuredDecision: noGrantDecision("email.request.create"),
            defaultScopes: [],
            effectiveScopes: [],
            state: "UNAVAILABLE",
        });
        expect(resolveMany).toHaveBeenCalledTimes(1);
        expect(resolveMany.mock.calls[0]?.[1]).not.toContain("email.request.read");
    });

    it("keeps configured broader authority visible and preserves Stock LIFF processor semantics", async () => {
        const directStockRead: AuthorizationDecision = allowedDecision(
            "stock.request.read",
            "ALL",
            { type: "USER", userId: 7 },
        );
        const directAuditRead: AuthorizationDecision = allowedDecision(
            "audit.read",
            "ALL",
            { type: "USER", userId: 7 },
        );
        const dashboardDecisions = new Map(noGrantMap());
        dashboardDecisions.set("stock.request.read", directStockRead);
        dashboardDecisions.set("audit.read", directAuditRead);

        const resolveMany = vi.fn(async (
            actor: AuthorizationActor,
            capabilityKeys: readonly CapabilityKey[],
        ) => new Map(capabilityKeys.map((key) => [
            key,
            actor.systemRole === "ADMIN" && key === "stock.request.process"
                ? allowedDecision(key, "ALL", { type: "SYSTEM_ROLE", role: "ADMIN" })
                : noGrantDecision(key),
        ])));

        const rows = await authorizationAdministrationEffectiveAccessProvider.inspect({
            actor: USER_DASHBOARD_ACTOR,
            dashboardDecisions,
            resolver: { resolveMany },
        });
        expect(findRow(rows, "stock.request.read", "dashboard")).toMatchObject({
            defaultScopes: ["OWN"],
            configuredDecision: directStockRead,
            composedScopes: ["ALL"],
            effectiveScopes: ["ALL"],
        });
        expect(findRow(rows, "audit.read", "dashboard")).toMatchObject({
            defaultScopes: [],
            configuredDecision: directAuditRead,
            effectiveScopes: ["ALL"],
            state: "AVAILABLE",
        });

        const adminDashboardDecisions = new Map(noGrantMap());
        const adminStockProcess = allowedDecision(
            "stock.request.process",
            "ALL",
            { type: "SYSTEM_ROLE", role: "ADMIN" },
        );
        adminDashboardDecisions.set("stock.request.process", adminStockProcess);
        const adminRows = await authorizationAdministrationEffectiveAccessProvider.inspect({
            actor: { ...USER_DASHBOARD_ACTOR, systemRole: "ADMIN" },
            dashboardDecisions: adminDashboardDecisions,
            resolver: { resolveMany },
        });
        expect(findRow(adminRows, "stock.request.process", "dashboard")).toMatchObject({
            defaultScopes: [],
            configuredDecision: adminStockProcess,
            effectiveScopes: ["ALL"],
            state: "AVAILABLE",
        });
        expect(findRow(adminRows, "stock.request.process", "liff.self-service")).toMatchObject({
            defaultScopes: [],
            configuredDecision: {
                allowed: true,
                scopes: ["ALL"],
                grants: [{ source: { type: "SYSTEM_ROLE", role: "ADMIN" } }],
            },
            effectiveScopes: ["ALL"],
            state: "AVAILABLE",
        });
        expect(findRow(adminRows, "routine.summary.read", "liff.self-service")).toMatchObject({
            defaultScopes: ["ASSIGNED"],
            effectiveScopes: ["ASSIGNED"],
            state: "AVAILABLE",
        });
    });
});
