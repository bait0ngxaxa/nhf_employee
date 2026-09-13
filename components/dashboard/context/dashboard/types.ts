import { type useRouter } from "next/navigation";
import { type MenuGroup } from "@/types/dashboard";
import type { RoutinePresentationCapabilities } from "@/modules/routine/client";
import type { StockPresentationCapabilities } from "@/modules/stock/client";
import type { LeavePresentationCapabilities } from "@/modules/leave/client";
import type { EmployeePresentationCapabilities } from "@/modules/employee/client";
import type { DepartmentPresentationCapabilities } from "@/modules/department";
import type { AuditPresentationCapabilities } from "@/modules/audit/client";
import type { NotificationPresentationCapabilities } from "@/modules/notification/client";

export interface DashboardUser {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
    department?: string;
    isManager?: boolean;
    canApproveLeave?: boolean;
    canViewLeaveReports?: boolean;
    leaveCapabilities?: LeavePresentationCapabilities;
    routineCapabilities?: RoutinePresentationCapabilities;
    stockCapabilities?: StockPresentationCapabilities;
    employeeCapabilities?: EmployeePresentationCapabilities;
    departmentCapabilities?: DepartmentPresentationCapabilities;
    auditCapabilities?: AuditPresentationCapabilities;
    notificationCapabilities?: NotificationPresentationCapabilities;
}

export interface DashboardDataContextValue {
    // Session & User Data
    status: "loading" | "authenticated" | "unauthenticated";
    user?: DashboardUser;
    isAdmin: boolean;

    // Navigation Data
    availableMenuGroups: MenuGroup[];
}

export interface DashboardUIContextValue {
    // Navigation State
    selectedMenu: string;
    mobileNavOpen: boolean;
    setMobileNavOpen: (open: boolean) => void;
    desktopSidebarCollapsed: boolean;
    setDesktopSidebarCollapsed: (collapsed: boolean) => void;
    handleMenuClick: (menuId: string) => void;

    // Actions
    handleSignOut: () => Promise<void>;

    // Router
    router: ReturnType<typeof useRouter>;
}

export interface DashboardContextValue
    extends DashboardDataContextValue, DashboardUIContextValue {}
