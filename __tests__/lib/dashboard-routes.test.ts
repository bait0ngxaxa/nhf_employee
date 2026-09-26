import { describe, expect, it } from "vitest";

import {
    APP_DASHBOARD_TABS,
    APP_ROUTES,
    API_ROUTES,
    getDashboardMenuIdFromPathname,
    resolveLegacyDashboardRedirect,
    toDashboardLeaveTabPath,
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
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.itTickets)).toBe(
            APP_ROUTES.dashboardIT,
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.itTicketQueue)).toBe(
            APP_ROUTES.dashboardITQueue,
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.itAnalytics)).toBe(
            APP_ROUTES.dashboardITAnalytics,
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.routine)).toBe(
            APP_ROUTES.dashboardRoutine,
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.employeeManagement)).toBe(
            APP_ROUTES.dashboardEmployees,
        );
        expect(toDashboardLeaveTabPath("reports")).toBe(
            "/dashboard/leave?leaveTab=reports",
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.addEmployee)).toBe(
            APP_ROUTES.dashboardEmployeeNew,
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.importEmployee)).toBe(
            APP_ROUTES.dashboardEmployeeImport,
        );
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.authorizationAdministration)).toBe(
            APP_ROUTES.dashboardAuthorizationAdministration,
        );
    });

    it("resolves active menu state from the deepest canonical pathname", () => {
        expect(getDashboardMenuIdFromPathname(APP_ROUTES.dashboard)).toBe(
            APP_DASHBOARD_TABS.dashboard,
        );
        expect(getDashboardMenuIdFromPathname(APP_ROUTES.dashboardStock)).toBe(
            APP_DASHBOARD_TABS.stock,
        );
        expect(getDashboardMenuIdFromPathname(APP_ROUTES.dashboardIT)).toBe(
            APP_DASHBOARD_TABS.itTickets,
        );
        expect(getDashboardMenuIdFromPathname(APP_ROUTES.dashboardITAnalytics)).toBe(
            APP_DASHBOARD_TABS.itAnalytics,
        );
        expect(getDashboardMenuIdFromPathname(`${APP_ROUTES.dashboardITAnalytics}/details`)).toBe(
            APP_DASHBOARD_TABS.itAnalytics,
        );
        expect(getDashboardMenuIdFromPathname(`${APP_ROUTES.dashboardITQueue}/19`)).toBe(
            APP_DASHBOARD_TABS.itTicketQueue,
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
        expect(getDashboardMenuIdFromPathname(APP_ROUTES.dashboardAuthorizationAdministration)).toBe(
            APP_DASHBOARD_TABS.authorizationAdministration,
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

    it("centralizes Authorization Administration API paths", () => {
        const routes = API_ROUTES.authorizationAdministration;

        expect(routes.overview).toBe("/api/authorization/administration");
        expect(routes.userSearch("alice@example.com")).toBe(
            "/api/authorization/administration/users?query=alice%40example.com",
        );
        expect(routes.teamById(11)).toBe(
            "/api/authorization/administration/teams/11",
        );
        expect(routes.teamRoles(11)).toBe(
            "/api/authorization/administration/teams/11/roles",
        );
        expect(routes.teamRoleById(11, 21)).toBe(
            "/api/authorization/administration/teams/11/roles/21",
        );
        expect(routes.teamMembers(11)).toBe(
            "/api/authorization/administration/teams/11/members",
        );
        expect(routes.teamMemberById(11, 7)).toBe(
            "/api/authorization/administration/teams/11/members/7",
        );
        expect(routes.teamGrants(11)).toBe(
            "/api/authorization/administration/teams/11/grants",
        );
        expect(routes.teamRoleGrants(11, 21)).toBe(
            "/api/authorization/administration/teams/11/roles/21/grants",
        );
        expect(routes.userById(7)).toBe(
            "/api/authorization/administration/users/7",
        );
        expect(routes.userGrants(7)).toBe(
            "/api/authorization/administration/users/7/grants",
        );
    });

    it("centralizes internal IT Ticket API routes without changing the Stock alias", () => {
        expect(API_ROUTES.itTickets.list).toBe("/api/it/tickets");
        expect(API_ROUTES.itTickets.byId(27)).toBe("/api/it/tickets/27");
        expect(API_ROUTES.line.itTickets).toBe("/api/line/it/tickets");
        expect(API_ROUTES.line.itTicketById(27)).toBe("/api/line/it/tickets/27");
        expect(API_ROUTES.line.itTicketTimelineById(27))
            .toBe("/api/line/it/tickets/27/timeline");
        expect(API_ROUTES.line.itTicketCommentsById(27))
            .toBe("/api/line/it/tickets/27/comments");
        expect(API_ROUTES.line.itAttachmentById("attachment-id"))
            .toBe("/api/line/it/attachments/attachment-id");
        expect(toDashboardMenuPath(APP_DASHBOARD_TABS.itEquipment)).toBe(
            APP_ROUTES.dashboardStock,
        );
    });

    it("centralizes the internal IT analytics API path", () => {
        expect(API_ROUTES.itAnalytics.dashboard).toBe("/api/it/analytics");
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
        ["authorization-administration", "/dashboard/authorization"],
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
