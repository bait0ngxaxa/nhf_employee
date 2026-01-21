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

export interface DashboardContextValue {
    // Session
    status: "loading" | "authenticated" | "unauthenticated";
    user?: DashboardUser;
    isAdmin: boolean;

    // Navigation
    selectedMenu: string;
    setSelectedMenu: (menu: string) => void;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    availableMenuItems: MenuItem[];
    handleMenuClick: (menuId: string) => void;
    handleSignOut: () => void;

    // Employee Stats
    employeeStats: EmployeeStats;
    refreshTrigger: number;
    handleEmployeeAdded: () => void;

    // Router
    router: ReturnType<typeof useRouter>;
}
