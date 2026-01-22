import { type useRouter } from "next/navigation";
import { type MenuItem } from "@/types/dashboard";

export interface EmployeeStats {
    total: number;
    active: number;
    admin: number;
    academic: number;
}

export interface DashboardUser {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
    department?: string;
}

export interface DashboardDataContextValue {
    // Session & User Data
    status: "loading" | "authenticated" | "unauthenticated";
    user?: DashboardUser;
    isAdmin: boolean;

    // Employee Stats & Data
    employeeStats: EmployeeStats;
    refreshTrigger: number;
    handleEmployeeAdded: () => void;

    // Navigation Data
    availableMenuItems: MenuItem[];
}

export interface DashboardUIContextValue {
    // Navigation State
    selectedMenu: string;
    setSelectedMenu: (menu: string) => void;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    handleMenuClick: (menuId: string) => void;

    // Actions
    handleSignOut: () => void;

    // Router
    router: ReturnType<typeof useRouter>;
}

export interface DashboardContextValue
    extends DashboardDataContextValue, DashboardUIContextValue {}
