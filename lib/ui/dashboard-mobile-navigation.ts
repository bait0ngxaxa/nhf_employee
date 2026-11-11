import { House, MoreHorizontal } from "lucide-react";
import { APP_ROUTES, toDashboardMenuPath } from "@/lib/ssot/routes";
import type { MenuGroup, MenuItem } from "@/types/dashboard";

export interface DashboardMobileTab {
    id: string;
    label: string;
    href: string;
    icon: MenuItem["icon"];
}

const PRIMARY_ORDER = ["routine", "stock", "leave-management", "it-workspace"] as const;
const SHORT_LABELS: Readonly<Record<string, string>> = {
    routine: "งานประจำ",
    stock: "วัสดุ",
    "leave-management": "วันลา",
    "it-workspace": "IT",
};

/** Presentation only: accepts the existing server-capability-filtered menu. */
export function projectDashboardMobileTabs(groups: readonly MenuGroup[]): DashboardMobileTab[] {
    const items = groups.flatMap((group) => group.items);
    const eligible = items.filter((item) => !item.unavailable && !item.comingSoon);
    const primary = PRIMARY_ORDER.flatMap((id) => eligible.filter((item) => item.id === id));
    const remaining = eligible.filter((item) => !primary.some((candidate) => candidate.id === item.id));
    return [
        { id: "dashboard", label: "หน้าแรก", href: APP_ROUTES.dashboard, icon: House },
        ...[...primary, ...remaining].slice(0, 3).map((item) => ({
            id: item.id,
            label: SHORT_LABELS[item.id] ?? item.sidebarLabel ?? item.label,
            href: toDashboardMenuPath(item.id),
            icon: item.icon,
        })),
        { id: "more", label: "เพิ่มเติม", href: APP_ROUTES.dashboardMore, icon: MoreHorizontal },
    ];
}

/** Query state belongs to the module; changing it never activates Home. */
export function resolveDashboardMobileTab(
    requestedPath: string | null,
    tabs: readonly DashboardMobileTab[],
): string | null {
    if (!requestedPath) return null;
    const pathname = requestedPath.split(/[?#]/, 1)[0].replace(/\/+$/, "");
    const matches = tabs.filter((tab) => {
        const base = tab.href.split("?", 1)[0];
        return pathname === base || (tab.id !== "dashboard" && pathname.startsWith(`${base}/`));
    });
    return matches.sort((a, b) => b.href.length - a.href.length)[0]?.id ?? null;
}
