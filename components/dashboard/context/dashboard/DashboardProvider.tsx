"use client";

import {
    useState,
    useCallback,
    useEffect,
    useMemo,
    startTransition,
    type ReactNode,
} from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import useSWR from "swr";
import {
    DASHBOARD_MENU_ITEMS,
    getAvailableMenuItems,
} from "@/constants/dashboard";
import { DashboardDataContext, DashboardUIContext } from "./DashboardContext";
import {
    type EmployeeStats,
    type DashboardDataContextValue,
    type DashboardUIContextValue,
} from "./types";

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
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const user = session?.user;
    const isAdmin = user?.role === "ADMIN";

    // Initialize selectedMenu from URL ?tab= param, fallback to "dashboard"
    const initialTab = searchParams.get("tab") ?? "dashboard";
    const [selectedMenu, setSelectedMenu] = useState<string>(initialTab);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Sync selectedMenu when URL ?tab= changes (e.g. notification click or browser back/forward)
    useEffect(() => {
        const tabFromUrl = searchParams.get("tab");
        startTransition(() => {
            setSelectedMenu(tabFromUrl || "dashboard");
        });
    }, [searchParams]);

    const availableMenuItems = getAvailableMenuItems(isAdmin);

    const { data: statsData, mutate: mutateStats } = useSWR<{
        stats: EmployeeStats;
    }>("/api/employees/stats");

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

            // Sync with URL to support browser history and bookmarks
            if (pathname !== "/dashboard" || searchParams.get("tab") !== menuId) {
                router.push(`/dashboard?tab=${menuId}`, { scroll: false });
            }

            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            }
        },
        [isAdmin, router, searchParams, pathname],
    );

    const handleSignOut = useCallback(() => {
        signOut({ callbackUrl: "/login" });
    }, []);

    const dataValue = useMemo<DashboardDataContextValue>(
        () => ({
            status,
            user,
            isAdmin,
            employeeStats,
            refreshTrigger,
            handleEmployeeAdded,
            availableMenuItems,
        }),
        [
            status,
            user,
            isAdmin,
            employeeStats,
            refreshTrigger,
            handleEmployeeAdded,
            availableMenuItems,
        ],
    );

    const uiValue = useMemo<DashboardUIContextValue>(
        () => ({
            selectedMenu,
            setSelectedMenu,
            sidebarOpen,
            setSidebarOpen,
            handleMenuClick,
            handleSignOut,
            router,
        }),
        [
            selectedMenu,
            setSelectedMenu,
            sidebarOpen,
            setSidebarOpen,
            handleMenuClick,
            handleSignOut,
            router,
        ],
    );

    return (
        <DashboardDataContext.Provider value={dataValue}>
            <DashboardUIContext.Provider value={uiValue}>
                {children}
            </DashboardUIContext.Provider>
        </DashboardDataContext.Provider>
    );
}
