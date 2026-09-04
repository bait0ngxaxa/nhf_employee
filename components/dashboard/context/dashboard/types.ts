import { type useRouter } from "next/navigation";
import { type MenuGroup } from "@/types/dashboard";

export interface DashboardUser {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
    department?: string;
    isManager?: boolean;
    canApproveLeave?: boolean;
    canViewLeaveReports?: boolean;
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
