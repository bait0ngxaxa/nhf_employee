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
        ["/dashboard/it/queue/3", null],
        ["/liff/stock", null],
    ])("matches %s without an unrelated Home fallback", (path, expected) => {
        expect(resolveDashboardMobileTab(path, projectDashboardMobileTabs(DASHBOARD_MENU_GROUPS))).toBe(expected);
    });
});
