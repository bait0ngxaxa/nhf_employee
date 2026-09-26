import {
    IT_DASHBOARD_TABS,
    type ITDashboardTab,
} from "@/lib/ssot/routes";
import type { ITPresentationCapabilities } from "../../contracts";

export const IT_DASHBOARD_TAB_ORDER: readonly ITDashboardTab[] = Object.freeze([
    IT_DASHBOARD_TABS.myTickets,
    IT_DASHBOARD_TABS.queue,
    IT_DASHBOARD_TABS.analytics,
]);

export function getVisibleITDashboardTabs(
    capabilities: ITPresentationCapabilities | undefined,
): ITDashboardTab[] {
    if (!capabilities) return [];
    return IT_DASHBOARD_TAB_ORDER.filter((tab) => {
        switch (tab) {
            case IT_DASHBOARD_TABS.myTickets:
                return capabilities.canReadOwnTickets || capabilities.canCreateOwnTickets;
            case IT_DASHBOARD_TABS.queue:
                return capabilities.canReadAllTickets;
            case IT_DASHBOARD_TABS.analytics:
                return capabilities.canReadAnalytics;
        }
    });
}

export function canAccessITWorkspaceDashboard(
    capabilities: ITPresentationCapabilities | undefined,
): boolean {
    return getVisibleITDashboardTabs(capabilities).length > 0;
}

export function normalizeITDashboardTab(
    requestedTab: string | null | undefined,
    capabilities: ITPresentationCapabilities | undefined,
): ITDashboardTab | "" {
    const visibleTabs = getVisibleITDashboardTabs(capabilities);
    return visibleTabs.find((tab) => tab === requestedTab) ?? visibleTabs[0] ?? "";
}
