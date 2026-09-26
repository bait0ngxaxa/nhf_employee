import { describe, expect, it } from "vitest";

import { IT_DASHBOARD_TABS } from "@/lib/ssot/routes";
import type { ITPresentationCapabilities } from "../../contracts";
import { getVisibleITDashboardTabs, normalizeITDashboardTab } from "./workspace-projection";

const noCapabilities: ITPresentationCapabilities = {
    canReadOwnTickets: false,
    canReadAllTickets: false,
    canCreateOwnTickets: false,
    canCommentOwnTickets: false,
    canCommentAllTickets: false,
    canManageTickets: false,
    canReadAnalytics: false,
};

describe("IT Dashboard workspace capability projection", () => {
    it("shows only requester self-service tabs for a requester", () => {
        expect(getVisibleITDashboardTabs({
            ...noCapabilities,
            canReadOwnTickets: true,
        })).toEqual([IT_DASHBOARD_TABS.myTickets]);
    });

    it("shows the queue only with read ALL", () => {
        expect(getVisibleITDashboardTabs({
            ...noCapabilities,
            canReadAllTickets: true,
        })).toEqual([IT_DASHBOARD_TABS.queue]);
    });

    it("shows the report only with analytics read capability", () => {
        expect(getVisibleITDashboardTabs({
            ...noCapabilities,
            canReadAnalytics: true,
        })).toEqual([IT_DASHBOARD_TABS.analytics]);
    });

    it("shows multiple surfaces when the actor has mixed capabilities", () => {
        expect(getVisibleITDashboardTabs({
            ...noCapabilities,
            canCreateOwnTickets: true,
            canReadAllTickets: true,
            canReadAnalytics: true,
        })).toEqual([
            IT_DASHBOARD_TABS.myTickets,
            IT_DASHBOARD_TABS.queue,
            IT_DASHBOARD_TABS.analytics,
        ]);
    });

    it("falls back from invalid or inaccessible requested tabs to the first visible tab", () => {
        const requester = { ...noCapabilities, canReadOwnTickets: true };
        expect(normalizeITDashboardTab("queue", requester)).toBe(IT_DASHBOARD_TABS.myTickets);
        expect(normalizeITDashboardTab("hidden-value", requester)).toBe(IT_DASHBOARD_TABS.myTickets);
        expect(normalizeITDashboardTab("queue", {
            ...noCapabilities,
            canReadAnalytics: true,
        })).toBe(IT_DASHBOARD_TABS.analytics);
    });

    it("returns no tab when no Dashboard presentation surface is available", () => {
        expect(getVisibleITDashboardTabs(noCapabilities)).toEqual([]);
        expect(normalizeITDashboardTab(IT_DASHBOARD_TABS.queue, noCapabilities)).toBe("");
    });
});
