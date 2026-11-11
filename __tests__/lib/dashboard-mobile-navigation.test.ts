import { afterEach, describe, expect, it, vi } from "vitest";
import { getAvailableMenuGroups, DASHBOARD_MENU_GROUPS } from "@/constants/dashboard";
import { projectDashboardMobileTabs, resolveDashboardMobileTab } from "@/lib/ui/dashboard-mobile-navigation";

afterEach(() => vi.unstubAllEnvs());

describe("Dashboard mobile navigation projection", () => {
    it("pins three eligible modules between Home and More", () => {
        const tabs = projectDashboardMobileTabs(DASHBOARD_MENU_GROUPS);
        expect(tabs.map((tab) => tab.id)).toEqual(["dashboard", "routine", "stock", "leave-management", "more"]);
        expect(tabs.every((tab) => tab.href.startsWith("/dashboard"))).toBe(true);
    });

    it("promotes IT deterministically and does not fill slots with unavailable modules", () => {
        const groups = DASHBOARD_MENU_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => item.id !== "routine") }));
        expect(projectDashboardMobileTabs(groups).map((tab) => tab.id)).toEqual(["dashboard", "stock", "leave-management", "it-workspace", "more"]);
        expect(projectDashboardMobileTabs([]).map((tab) => tab.id)).toEqual(["dashboard", "more"]);
    });

    it("consumes actual capability and feature filtering, leaving unavailable Leave discoverable in More", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");
        const groups = getAvailableMenuGroups(false);
        expect(groups.flatMap((group) => group.items).find((item) => item.id === "leave-management")?.unavailable).toBe(true);
        expect(projectDashboardMobileTabs(groups).map((tab) => tab.id)).toEqual(["dashboard", "more"]);
    });

    it("reprojects permission updates without retaining removed modules", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");
        expect(projectDashboardMobileTabs(getAvailableMenuGroups(false)).map((tab) => tab.id)).toEqual(["dashboard", "more"]);
        const admin = projectDashboardMobileTabs(getAvailableMenuGroups(true));
        expect(admin.some((tab) => tab.id === "authorization-administration")).toBe(true);
    });

    it.each([
        ["/dashboard", "dashboard"],
        ["/dashboard/routine?taskId=3&occurrenceId=4", "routine"],
        ["/dashboard/stock/requests/3?stockTab=my-requests", "stock"],
        ["/dashboard/leave?leaveTab=approvals", "leave-management"],
        ["/dashboard/leave?leaveTab=reports", "leave-management"],
        ["/dashboard/more/", "more"],
        ["/dashboard/stock-other", null],
        ["/dashboard/unknown", null],
        ["/dashboard/it/queue/3", "more"],
        ["/liff/stock", null],
    ])("matches %s without an unrelated Home fallback", (path, expected) => {
        expect(resolveDashboardMobileTab(path, projectDashboardMobileTabs(DASHBOARD_MENU_GROUPS), DASHBOARD_MENU_GROUPS, { itCapabilities: { canReadOwnTickets: true, canReadAllTickets: true, canCreateOwnTickets: true, canCommentOwnTickets: true, canCommentAllTickets: true, canManageTickets: true, canReadAnalytics: true } })).toBe(expected);
    });
    it.each([
        "/dashboard/it", "/dashboard/it?itTab=queue", "/dashboard/it/queue",
        "/dashboard/it/queue/19?source=notification", "/dashboard/employees", "/dashboard/employees/new",
        "/dashboard/audit?cursor=next", "/dashboard/authorization", "/dashboard/sessions",
    ])("selects More for the authorized overflow destination %s", (path) => {
        const tabs = projectDashboardMobileTabs(DASHBOARD_MENU_GROUPS);
        expect(resolveDashboardMobileTab(path, tabs, DASHBOARD_MENU_GROUPS, { itCapabilities: { canReadOwnTickets: true, canReadAllTickets: true, canCreateOwnTickets: true, canCommentOwnTickets: true, canCommentAllTickets: true, canManageTickets: true, canReadAnalytics: true } })).toBe("more");
    });

    it("follows notification capabilities without granting an unknown or unauthorized destination ownership", () => {
        const tabs = projectDashboardMobileTabs(DASHBOARD_MENU_GROUPS);
        const resolve = (path: string, canReadInbox: boolean): string | null => resolveDashboardMobileTab(path, tabs, DASHBOARD_MENU_GROUPS, { notificationCapabilities: { canReadInbox, canUpdateInbox: false } });
        expect(resolve("/dashboard/notifications?cursor=2", true)).toBe("more");
        expect(resolve("/dashboard/notifications", false)).toBeNull();
        for (const path of ["/dashboard/unknown", "/dashboard-other", "/dashboard/audit-other", "/dashboard/more/unknown", "/dashboard/home"]) expect(resolve(path, true)).toBeNull();
    });

    it("resolves specific employee routes before access, without an authorized-parent fallback", () => {
        const groups = DASHBOARD_MENU_GROUPS.map(group => ({ ...group, items: group.items.filter(item => item.id === "employee-management") }));
        const tabs = projectDashboardMobileTabs(groups);
        expect(resolveDashboardMobileTab("/dashboard/employees", tabs, groups)).toBe("employee-management");
        expect(resolveDashboardMobileTab("/dashboard/employees/new", tabs, groups)).toBeNull();
        expect(resolveDashboardMobileTab("/dashboard/employees/import", tabs, groups)).toBeNull();
        expect(resolveDashboardMobileTab("/dashboard/audit", tabs, groups)).toBeNull();
        expect(resolveDashboardMobileTab("/dashboard/authorization", tabs, groups)).toBeNull();
    });

    it("does not retain overflow or primary ownership after permission changes", () => {
        const tabs = projectDashboardMobileTabs(DASHBOARD_MENU_GROUPS);
        expect(resolveDashboardMobileTab("/dashboard/employees", tabs, DASHBOARD_MENU_GROUPS)).toBe("more");
        expect(resolveDashboardMobileTab("/dashboard/employees", tabs, [])).toBeNull();
        expect(resolveDashboardMobileTab("/dashboard/stock", tabs, [])).toBeNull();
        expect(resolveDashboardMobileTab("/dashboard/it/queue/19", tabs, DASHBOARD_MENU_GROUPS)).toBeNull();
    });

    it("keeps an eligible primary IT module active on its authorized nested routes", () => {
        const groups = DASHBOARD_MENU_GROUPS.map(group => ({ ...group, items: group.items.filter(item => item.id !== "routine") }));
        const tabs = projectDashboardMobileTabs(groups);
        const capabilities = { itCapabilities: { canReadOwnTickets: true, canReadAllTickets: true, canCreateOwnTickets: true, canCommentOwnTickets: true, canCommentAllTickets: true, canManageTickets: true, canReadAnalytics: true } };
        expect(resolveDashboardMobileTab("/dashboard/it/queue/19", tabs, groups, capabilities)).toBe("it-workspace");
        expect(resolveDashboardMobileTab("/dashboard/it/19", tabs, groups, capabilities)).toBe("it-workspace");
        expect(resolveDashboardMobileTab("/dashboard/it/analytics", tabs, groups, capabilities)).toBe("it-workspace");
    });

});
