"use client";

import { useState, useCallback, type ReactNode } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
    DASHBOARD_MENU_ITEMS,
    getAvailableMenuItems,
} from "@/constants/dashboard";
import { DashboardContext } from "./DashboardContext";
import { type EmployeeStats, type DashboardContextValue } from "./types";

interface DashboardProviderProps {
    children: ReactNode;
}

const defaultStats: EmployeeStats = {
    total: 0,
    active: 0,
    admin: 0,
    academic: 0,
};

export function DashboardProvider({ children }: DashboardProviderProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const user = session?.user;
    const isAdmin = user?.role === "ADMIN";

    const [selectedMenu, setSelectedMenu] = useState<string>("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const availableMenuItems = getAvailableMenuItems(isAdmin);

    const { data: statsData, mutate: mutateStats } = useSWR<{
        stats: EmployeeStats;
    }>(isAdmin ? "/api/employees/stats" : null);

    const employeeStats = statsData?.stats || defaultStats;

    const handleEmployeeAdded = useCallback(() => {
        mutateStats();
        setRefreshTrigger((prev) => prev + 1);
    }, [mutateStats]);

    const handleMenuClick = useCallback(
        (menuId: string) => {
            const menuItem = DASHBOARD_MENU_ITEMS.find(
                (item) => item.id === menuId,
            );
            if (menuItem?.requiredRole === "ADMIN" && !isAdmin) {
                router.push("/access-denied");
                return;
            }

            setSelectedMenu(menuId);

            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            }
        },
        [isAdmin, router],
    );

    const handleSignOut = useCallback(() => {
        signOut({ callbackUrl: "/login" });
    }, []);

    const value: DashboardContextValue = {
        status,
        user,
        isAdmin,
        selectedMenu,
        setSelectedMenu,
        sidebarOpen,
        setSidebarOpen,
        availableMenuItems,
        handleMenuClick,
        handleSignOut,
        employeeStats,
        refreshTrigger,
        handleEmployeeAdded,
        router,
    };

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
}
