import { House, MoreHorizontal } from "lucide-react";
import { APP_ROUTES, DASHBOARD_MENU_PATHS, getDashboardMenuIdFromPathname, toDashboardMenuPath } from "@/lib/ssot/routes";
import { canAccessITAnalytics, canAccessITTicketQueue } from "@/constants/dashboard";
import type { ITPresentationCapabilities } from "@/modules/it/client";
import type { NotificationPresentationCapabilities } from "@/modules/notification/client";
import type { EmployeePresentationCapabilities } from "@/modules/employee/client";
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

function isKnownITTicketPath(base: string, pathname: string): boolean {
    const routePrefix = base === APP_ROUTES.dashboardIT
        ? `${APP_ROUTES.dashboardIT}/`
        : base === APP_ROUTES.dashboardITQueue
            ? `${APP_ROUTES.dashboardITQueue}/`
            : null;
    if (!routePrefix || !pathname.startsWith(routePrefix)) return false;
    const ticketId = pathname.slice(routePrefix.length);
    return /^\d+$/.test(ticketId)
        && Number.isSafeInteger(Number(ticketId))
        && Number(ticketId) > 0;
}

/** Presentation only: accepts the existing server-capability-filtered menu. */
export function projectDashboardMobileTabs(groups: readonly MenuGroup[]): DashboardMobileTab[] {
    const items = groups.flatMap((group) => group.items);
    const eligible = items.filter((item) => !item.unavailable && !item.comingSoon);
    const primary = PRIMARY_ORDER.flatMap((id) => eligible.filter((item) => item.id === id));
    const remaining = eligible.filter((item) => item.id !== "import-employee"
        && !primary.some((candidate) => candidate.id === item.id));
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

/** Query state belongs to its module; ownership uses all authorized destinations, not just visible tabs. */
export function resolveDashboardMobileTab(
    requestedPath: string | null,
    tabs: readonly DashboardMobileTab[],
    groups: readonly MenuGroup[],
    capabilities: {
        itCapabilities?: ITPresentationCapabilities;
        notificationCapabilities?: NotificationPresentationCapabilities;
        employeeCapabilities?: EmployeePresentationCapabilities;
    } = {},
): string | null {
    if (!requestedPath) return null;
    const pathname = requestedPath.split(/[?#]/, 1)[0].replace(/\/+$/, "");
    // Resolve the most specific canonical destination BEFORE checking availability.
    // An unauthorized /employees/new must never fall back to the authorized /employees parent.
    const base = Object.values(DASHBOARD_MENU_PATHS)
        .map((href) => href.split("?", 1)[0])
        .filter((path) => pathname === path || (
            path !== APP_ROUTES.dashboard && path !== APP_ROUTES.dashboardMore
            && pathname.startsWith(`${path}/`)
        ))
        .sort((a, b) => b.length - a.length)[0];
    if (!base) return null;
    const owner = getDashboardMenuIdFromPathname(base);
    if (owner === "dashboard" || owner === "more") return owner;
    if (pathname !== base && !isKnownITTicketPath(base, pathname)) return null;

    const availableIds = new Set(groups.flatMap((group) => group.items)
        .filter((item) => !item.comingSoon).map((item) => item.id));
    const authorized = owner === "sessions"
        || (owner === "notifications" ? capabilities.notificationCapabilities?.canReadInbox === true
            : owner === "import-employee" ? capabilities.employeeCapabilities?.canImportEmployees === true
                : owner === "add-employee" ? capabilities.employeeCapabilities?.canCreateEmployees === true
                    : availableIds.has(owner));
    if (!authorized) return null;
    if (owner === "import-employee") return "more";
    // The IT workspace consolidates several destinations with existing, narrower access contracts.
    if (base === APP_ROUTES.dashboardITQueue && !canAccessITTicketQueue(capabilities.itCapabilities)) return null;
    if (base === APP_ROUTES.dashboardITAnalytics && !canAccessITAnalytics(capabilities.itCapabilities)) return null;
    if (base === APP_ROUTES.dashboardIT && pathname !== base && capabilities.itCapabilities?.canReadOwnTickets !== true) return null;
    return tabs.find((tab) => tab.id === owner)?.id ?? "more";
}
