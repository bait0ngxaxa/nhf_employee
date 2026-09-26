import {
    Boxes,
    Mail,
    Users,
    UserPlus,
    Upload,
    CalendarRange,
    FileText,
    AppWindow,
    ShieldCheck,
    ClipboardCheck,
    KeyRound,
    Headset,
} from "lucide-react";
import { type MenuItem, type MenuGroup } from "@/types/dashboard";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import type { RoutinePresentationCapabilities } from "@/modules/routine/client";
import type { StockPresentationCapabilities } from "@/modules/stock/client";
import type { LeavePresentationCapabilities } from "@/modules/leave/client";
import type { EmployeePresentationCapabilities } from "@/modules/employee/client";
import type { AuditPresentationCapabilities } from "@/modules/audit/client";
import type { EmailRequestPresentationCapabilities } from "@/modules/it/client";
import {
    canAccessITWorkspaceDashboard,
    type ITPresentationCapabilities,
} from "@/modules/it/client";

export { canAccessITWorkspaceDashboard };

/** Flat lookup used by handleMenuClick for feature and capability validation */
export const DASHBOARD_MENU_ITEMS: MenuItem[] = [
    {
        id: "leave-management",
        label: "NHF Leave",
        sidebarLabel: "การลา",
        icon: CalendarRange,
        description: "ยื่นใบลาและตรวจสอบโควต้าวันลา",
        feature: FEATURE_KEYS.leave,
    },
    {
        id: "stock",
        label: "NHF Stock",
        sidebarLabel: "วัสดุและคลัง",
        icon: Boxes,
        description: "เบิกวัสดุจากคลัง",
    },
    {
        id: "routine",
        label: "NHF Routine",
        sidebarLabel: "งานประจำ",
        icon: ClipboardCheck,
        description: "บันทึกและติดตามงานประจำขององค์กร",
        feature: FEATURE_KEYS.routine,
    },
    {
        id: "it-workspace",
        label: "บริการ IT",
        sidebarLabel: "บริการ IT",
        icon: Headset,
        description: "แจ้งปัญหา ติดตามคำขอ และจัดการงานบริการ IT",
    },
    {
        id: "email-request",
        label: "ส่งคำร้องพนักงานใหม่",
        sidebarLabel: "คำร้องบริการ IT",
        icon: Mail,
        description: "ส่งคำร้องอีเมล สารบรรณ และ Shared Drive ให้ทีมไอที",
    },
    {
        id: "employee-management",
        label: "ข้อมูลพนักงาน",
        icon: Users,
        description: "ดูข้อมูลพนักงานในองค์กร",
    },
    {
        id: "add-employee",
        label: "เพิ่มพนักงาน",
        icon: UserPlus,
        description: "เพิ่มข้อมูลพนักงานใหม่",
    },
    {
        id: "import-employee",
        label: "นำเข้าจาก CSV",
        icon: Upload,
        description: "นำเข้าข้อมูลพนักงานจากไฟล์ CSV",
    },
    {
        id: "audit-logs",
        label: "บันทึกการใช้งาน",
        icon: FileText,
        description: "ดูประวัติการใช้งานระบบ",
    },
    {
        id: "authorization-administration",
        label: "จัดการสิทธิ์การใช้งาน",
        icon: KeyRound,
        description: "จัดการ Team, TeamRole และสิทธิ์การเข้าถึง",
        requiredRole: "ADMIN",
    },
];

function getDashboardMenuItem(menuId: string): MenuItem {
    const menuItem = DASHBOARD_MENU_ITEMS.find((item) => item.id === menuId);
    if (!menuItem) {
        throw new Error(`Unknown dashboard menu item: ${menuId}`);
    }

    return menuItem;
}

const DASHBOARD_PAGE_LABELS: Readonly<Record<string, string>> = {
    dashboard: "หน้าหลัก",
    "manager-approval": "อนุมัติการลา",
    "leave-history": "ประวัติการลา",
    notifications: "การแจ้งเตือน",
    sessions: "จัดการเซสชัน",
    routine: "NHF Routine",
    "authorization-administration": "จัดการสิทธิ์การใช้งาน",
};

export function getDashboardPageLabel(menuId: string): string {
    return (
        DASHBOARD_PAGE_LABELS[menuId] ??
        DASHBOARD_MENU_ITEMS.find((item) => item.id === menuId)?.label ??
        "NHFapp"
    );
}

export const DASHBOARD_MENU_GROUPS: MenuGroup[] = [
    {
        id: "internal-services",
        label: "บริการภายใน",
        icon: AppWindow,
        items: [
            getDashboardMenuItem("leave-management"),
            getDashboardMenuItem("stock"),
            getDashboardMenuItem("routine"),
            getDashboardMenuItem("it-workspace"),
        ],
    },
    {
        id: "people",
        label: "บุคลากร",
        icon: Users,
        items: [
            getDashboardMenuItem("employee-management"),
            getDashboardMenuItem("add-employee"),
            getDashboardMenuItem("email-request"),
        ],
    },
    {
        id: "system-access",
        label: "ระบบและสิทธิ์",
        icon: ShieldCheck,
        items: [
            getDashboardMenuItem("audit-logs"),
            getDashboardMenuItem("authorization-administration"),
        ],
    },
];

export function canAccessStockDashboard(
    capabilities?: StockPresentationCapabilities,
): boolean {
    return capabilities?.canReadCatalog === true
        || capabilities?.canReadOwnRequests === true
        || capabilities?.canReadAllRequests === true
        || capabilities?.canExportReports === true;
}

export function canAccessEmployeeDashboard(
    capabilities?: EmployeePresentationCapabilities,
): boolean {
    return capabilities?.canReadEmployees === true
        || capabilities?.canReadStats === true;
}

export function canAccessEmailRequestDashboard(
    capabilities?: EmailRequestPresentationCapabilities,
): boolean {
    return capabilities?.canReadRequests === true
        || capabilities?.canCreateRequests === true;
}

export function canAccessITTicketDashboard(
    capabilities?: ITPresentationCapabilities,
): boolean {
    return capabilities?.canReadOwnTickets === true
        || capabilities?.canCreateOwnTickets === true;
}

export function canAccessITTicketQueue(
    capabilities?: ITPresentationCapabilities,
): boolean {
    return capabilities?.canReadAllTickets === true;
}

export function canAccessITAnalytics(
    capabilities?: ITPresentationCapabilities,
): boolean {
    return capabilities?.canReadAnalytics === true;
}

export const LEAVE_DASHBOARD_TABS = [
    "my-leave",
    "approvals",
    "recovery",
    "reports",
    "approver-settings",
] as const;

export type LeaveDashboardTab = (typeof LEAVE_DASHBOARD_TABS)[number];

export interface LeaveDashboardAvailabilityInput {
    leaveCapabilities?: LeavePresentationCapabilities;
    canApproveLeave?: boolean;
    canViewLeaveReports?: boolean;
}

export type LeaveDashboardTabVisibility = Record<
    LeaveDashboardTab,
    boolean
>;

/**
 * Project the Dashboard Leave surfaces from granular capabilities plus the
 * existing Leave-owned relationship/deferred-policy projections.
 */
export function getLeaveDashboardTabVisibility({
    leaveCapabilities,
    canApproveLeave,
    canViewLeaveReports,
}: LeaveDashboardAvailabilityInput): LeaveDashboardTabVisibility {
    return {
        "my-leave": leaveCapabilities?.canReadOwnRequests === true,
        approvals:
            leaveCapabilities?.canReadAssignedApprovals === true
            && canApproveLeave === true,
        recovery: leaveCapabilities?.canManageRecovery === true,
        reports: canViewLeaveReports === true,
        "approver-settings": leaveCapabilities?.canManageApprovers === true,
    };
}

export function canAccessLeaveDashboard(
    input: LeaveDashboardAvailabilityInput,
): boolean {
    const visibility = getLeaveDashboardTabVisibility(input);
    return LEAVE_DASHBOARD_TABS.some((tab) => visibility[tab]);
}

export function normalizeLeaveDashboardTab(
    requestedTab: string | undefined,
    input: LeaveDashboardAvailabilityInput,
): LeaveDashboardTab {
    const visibility = getLeaveDashboardTabVisibility(input);
    const visibleTabs = LEAVE_DASHBOARD_TABS.filter((tab) => visibility[tab]);

    return visibleTabs.find((tab) => tab === requestedTab)
        ?? visibleTabs[0]
        ?? "my-leave";
}

/**
 * Filter groups by role, capability, and feature availability. Routine,
 * Stock, Leave, and Employee use server-derived presentation projections
 * when supplied.
 */
export function getAvailableMenuGroups(
    isAdmin: boolean,
    routineCapabilities?: RoutinePresentationCapabilities,
    stockCapabilities?: StockPresentationCapabilities,
    leaveAvailability?: LeaveDashboardAvailabilityInput,
    employeeCapabilities?: EmployeePresentationCapabilities,
    auditCapabilities?: AuditPresentationCapabilities,
    emailRequestCapabilities?: EmailRequestPresentationCapabilities,
    itCapabilities?: ITPresentationCapabilities,
): MenuGroup[] {
    const stockAvailable = canAccessStockDashboard(stockCapabilities);
    const employeeAvailable = canAccessEmployeeDashboard(employeeCapabilities);
    const leaveAvailable = canAccessLeaveDashboard({
        ...(leaveAvailability ?? {}),
    });

    return DASHBOARD_MENU_GROUPS.map((group) => {
        const filteredItems = group.items.filter((item) => {
            if (item.id === "employee-management") {
                return employeeAvailable;
            }
            if (item.id === "add-employee") {
                return employeeCapabilities?.canCreateEmployees === true;
            }
            if (item.id === "audit-logs") {
                return auditCapabilities?.canReadAuditLogs === true;
            }
            if (item.id === "email-request") {
                return canAccessEmailRequestDashboard(emailRequestCapabilities);
            }
            if (item.id === "it-workspace") {
                return canAccessITWorkspaceDashboard(itCapabilities);
            }
            return !item.requiredRole
                || (item.requiredRole === "ADMIN" && isAdmin);
        })
            .filter(
                (item) => !item.feature || isFeatureEnabled(item.feature),
            )
            .filter(
                (item) => item.id !== "routine"
                    || routineCapabilities?.canReadTasks === true,
            );
        const stockFilteredItems = filteredItems.filter(
            (item) => item.id !== "stock" || stockAvailable,
        );
        const leaveFilteredItems = stockFilteredItems.filter(
            (item) => item.id !== "leave-management" || leaveAvailable,
        );
        if (leaveFilteredItems.length === 0) return null;
        return { ...group, items: leaveFilteredItems };
    }).filter((g): g is MenuGroup => g !== null);
}

export const getMenuTheme = (menuId: string) => {
    switch (menuId) {
        case "dashboard":
            return {
                gradient: "from-blue-500 to-cyan-500",
                lightBg: "bg-blue-50",
                text: "text-blue-600",
                border: "border-blue-600",
                hover: "hover:bg-blue-50",
                activeBg: "bg-blue-50/80",
                glow: "from-blue-400 via-cyan-400 to-teal-400",
            };
        case "employee-management":
            return {
                gradient: "from-sky-600 to-blue-700",
                lightBg: "bg-sky-50",
                text: "text-sky-700",
                border: "border-sky-700",
                hover: "hover:bg-sky-50",
                activeBg: "bg-sky-50/80",
                glow: "from-sky-400 via-blue-400 to-cyan-400",
            };
        case "email-request":
            return {
                gradient: "from-indigo-600 to-violet-700",
                lightBg: "bg-indigo-50",
                text: "text-indigo-700",
                border: "border-indigo-700",
                hover: "hover:bg-indigo-50",
                activeBg: "bg-indigo-50/80",
                glow: "from-indigo-400 via-violet-400 to-purple-400",
            };
        case "it-workspace":
            return {
                gradient: "from-sky-600 to-cyan-700",
                lightBg: "bg-sky-50",
                text: "text-sky-700",
                border: "border-sky-700",
                hover: "hover:bg-sky-50",
                activeBg: "bg-sky-50/80",
                glow: "from-sky-400 via-cyan-400 to-blue-400",
            };
        case "stock":
            return {
                gradient: "from-orange-500 to-red-600",
                lightBg: "bg-orange-50",
                text: "text-orange-600",
                border: "border-orange-600",
                hover: "hover:bg-orange-50",
                activeBg: "bg-orange-50/80",
                glow: "from-orange-400 via-red-400 to-amber-400",
            };
        case "routine":
            return {
                gradient: "from-teal-600 to-cyan-600",
                lightBg: "bg-teal-50",
                text: "text-teal-700",
                border: "border-teal-700",
                hover: "hover:bg-teal-50",
                activeBg: "bg-teal-50/80",
                glow: "from-teal-400 via-cyan-400 to-sky-400",
            };
        case "leave-management":
            return {
                gradient: "from-indigo-500 to-sky-500",
                lightBg: "bg-indigo-50",
                text: "text-indigo-600",
                border: "border-indigo-600",
                hover: "hover:bg-indigo-50",
                activeBg: "bg-indigo-50/80",
                glow: "from-indigo-400 via-sky-400 to-cyan-400",
            };
        case "add-employee":
            return {
                gradient: "from-pink-500 to-rose-600",
                lightBg: "bg-pink-50",
                text: "text-pink-600",
                border: "border-pink-600",
                hover: "hover:bg-pink-50",
                activeBg: "bg-pink-50/80",
                glow: "from-pink-400 via-rose-400 to-red-400",
            };
        case "import-employee":
            return {
                gradient: "from-teal-500 to-cyan-600",
                lightBg: "bg-teal-50",
                text: "text-teal-600",
                border: "border-teal-600",
                hover: "hover:bg-teal-50",
                activeBg: "bg-teal-50/80",
                glow: "from-teal-400 via-cyan-400 to-sky-400",
            };
        case "audit-logs":
            return {
                gradient: "from-yellow-500 to-amber-600",
                lightBg: "bg-yellow-50",
                text: "text-amber-600",
                border: "border-amber-600",
                hover: "hover:bg-yellow-50",
                activeBg: "bg-yellow-50/80",
                glow: "from-yellow-400 via-amber-400 to-orange-400",
            };
        case "sessions":
            return {
                gradient: "from-cyan-600 to-teal-700",
                lightBg: "bg-cyan-50",
                text: "text-cyan-700",
                border: "border-cyan-700",
                hover: "hover:bg-cyan-50",
                activeBg: "bg-cyan-50/80",
                glow: "from-cyan-400 via-teal-400 to-emerald-400",
            };
        case "authorization-administration":
            return {
                gradient: "from-indigo-600 to-blue-700",
                lightBg: "bg-indigo-50",
                text: "text-indigo-700",
                border: "border-indigo-700",
                hover: "hover:bg-indigo-50",
                activeBg: "bg-indigo-50/80",
                glow: "from-indigo-400 via-blue-400 to-cyan-400",
            };
        default:
            return {
                gradient: "from-gray-500 to-slate-500",
                lightBg: "bg-gray-50",
                text: "text-gray-600",
                border: "border-gray-600",
                hover: "hover:bg-gray-50",
                activeBg: "bg-gray-50/80",
                glow: "from-gray-400 via-slate-400 to-zinc-400",
            };
    }
};
