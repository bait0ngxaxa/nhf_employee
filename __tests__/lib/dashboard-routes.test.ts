import { describe, expect, it } from "vitest";

import {
    APP_DASHBOARD_TABS,
    APP_ROUTES,
    getDashboardMenuIdFromPathname,
    resolveLegacyDashboardRedirect,
    toDashboardMenuPath,
    toDashboardRoutineTaskPath,
    toDashboardStockTabPath,
} from "@/lib/ssot/routes";

describe("dashboard route SSOT", () => {
    it("maps dashboard menu IDs to canonical App Router paths", () => {
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.dashboard)).toBe(
            APP_ROUTES.dashboard,
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.leaveManagement)).toBe(
            APP_ROUTES.dashboardLeave,
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.stock)).toBe(
            APP_ROUTES.dashboardStock,
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.routine)).toBe(
            APP_ROUTES.dashboardRoutine,
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.employeeManagement)).toBe(
            APP_ROUTES.dashboardEmployees,
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.addEmployee)).toBe(
            APP_ROUTES.dashboardEmployeeNew,
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.importEmployee)).toBe(
            APP_ROUTES.dashboardEmployeeImport,
        );
    });

    it("resolves active menu state from the deepest canonical pathname", () => {
        expect(getDashboardMenuIdFromPathname(APP_ROUTES.dashboard)).toBe(
            APP_DASHBOARD_TABS.dashboard,
        );
        expect(getDashboardMenuIdFromPathname(APP_ROUTES.dashboardStock)).toBe(
            APP_DASHBOARD_TABS.stock,
        );
        expect(
            getDashboardMenuIdFromPathname(`${APP_ROUTES.dashboardEmployees}/new`),
        ).toBe(APP_DASHBOARD_TABS.addEmployee);
        expect(
            getDashboardMenuIdFromPathname(`${APP_ROUTES.dashboardEmployees}/import`),
        ).toBe(APP_DASHBOARD_TABS.importEmployee);
        expect(getDashboardMenuIdFromPathname("/dashboard/unknown")).toBe(
            APP_DASHBOARD_TABS.dashboard,
        );
    });

    it("keeps feature-local query state on canonical stock routes", () => {
        expect(toDashboardStockTabPath("inventory")).toBe(
            "/dashboard/stock?stockTab=inventory",
        );
        expect(toDashboardRoutineTaskPath(71, 91)).toBe(
            "/dashboard/routine?taskId=71&occurrenceId=91",
        );
    });
});

describe("legacy dashboard query-tab compatibility", () => {
    it.each([
        ["dashboard", "/dashboard"],
        ["leave-management", "/dashboard/leave"],
        ["routine", "/dashboard/routine"],
        ["email-request", "/dashboard/email-request"],
        ["employee-management", "/dashboard/employees"],
        ["add-employee", "/dashboard/employees/new"],
        ["import-employee", "/dashboard/employees/import"],
        ["audit-logs", "/dashboard/audit"],
        ["notifications", "/dashboard/notifications"],
        ["sessions", "/dashboard/sessions"],
    ])("redirects %s to %s", (tab, expected) => {
        expect(resolveLegacyDashboardRedirect({ tab })).toBe(expected);
    });

    it("preserves safe stock query state and removes the legacy tab", () => {
        expect(
            resolveLegacyDashboardRedirect({
                tab: "stock",
                stockTab: "inventory",
                stockInventoryPage: "2",
                stockSearch: "paper",
                unrelated: "discard-me",
            }),
        ).toBe(
            "/dashboard/stock?stockTab=inventory&stockInventoryPage=2&stockSearch=paper",
        );
    });

    it("maps legacy stock aliases and leave tabs", () => {
        expect(resolveLegacyDashboardRedirect({ tab: "it-equipment" })).toBe(
            "/dashboard/stock",
        );
        expect(resolveLegacyDashboardRedirect({ tab: "manager-approval" })).toBe(
            "/dashboard/leave?leaveTab=approvals",
        );
        expect(resolveLegacyDashboardRedirect({ tab: "leave-history" })).toBe(
            "/dashboard/leave?leaveTab=my-leave",
        );
    });

    it("falls back safely for unknown or malformed tabs", () => {
        expect(resolveLegacyDashboardRedirect({ tab: "unknown" })).toBe(
            "/dashboard",
        );
        expect(resolveLegacyDashboardRedirect({ tab: ["stock", "routine"] })).toBe(
            "/dashboard",
        );
        expect(resolveLegacyDashboardRedirect({})).toBeNull();
    });
});
