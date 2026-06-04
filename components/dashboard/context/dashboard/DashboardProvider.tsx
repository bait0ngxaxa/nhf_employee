"use client";

import {
    useState,
    useCallback,
    useEffect,
    useMemo,
    startTransition,
    type ReactNode,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import useSWR from "swr";
import {
    DASHBOARD_MENU_ITEMS,
    getAvailableMenuGroups,
} from "@/constants/dashboard";
import { DashboardDataContext, DashboardUIContext } from "./DashboardContext";
import {
    type EmployeeStats,
    type DashboardDataContextValue,
    type DashboardUIContextValue,
} from "./types";
import {
    API_ROUTES,
    APP_ROUTES,
    toDashboardTabPath,
} from "@/lib/ssot/routes";
import { isAdminRole, USER_ROLES } from "@/lib/ssot/permissions";
import { useAuth } from "@/components/auth/HybridAuthProvider";

interface DashboardProviderProps {
    children: ReactNode;
    initialUser?: DashboardDataContextValue["user"];
}

const STOCK_BROWSE_CART_STORAGE_KEY_PREFIX = "stock:browse-cart:v1:user:";
const STOCK_BROWSE_CART_LEGACY_KEY = "stock:browse-cart:v1";

const defaultStats: EmployeeStats = {
    total: 0,
    active: 0,
    admin: 0,
    academic: 0,
};

function normalizeDashboardTab(tab: string | null): string {
    if (tab === "it-equipment") {
        return "stock";
    }

    return tab ?? "dashboard";
}

export function DashboardProvider({
    children,
    initialUser,
}: DashboardProviderProps) {
    const { user: authUser, status, signOut } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const user = authUser ?? initialUser;
    const isAdmin = isAdminRole(user?.role);
    const effectiveStatus =
        status === "authenticated" || initialUser
            ? "authenticated"
            : status;

    // Initialize selectedMenu from URL ?tab= param, fallback to "dashboard"
    const initialTab = normalizeDashboardTab(searchParams.get("tab"));
    const [selectedMenu, setSelectedMenu] = useState<string>(initialTab);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Sync selectedMenu when URL ?tab= changes (e.g. notification click or browser back/forward)
    useEffect(() => {
        const tabFromUrl = normalizeDashboardTab(searchParams.get("tab"));
        startTransition(() => {
            setSelectedMenu(tabFromUrl);
        });
    }, [searchParams]);

    const availableMenuGroups = useMemo(
        () => getAvailableMenuGroups(isAdmin),
        [isAdmin],
    );



    const { data: statsData, mutate: mutateStats } = useSWR<{
        stats: EmployeeStats;
    }>(API_ROUTES.employees.stats);

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
            if (menuItem?.requiredRole === USER_ROLES.ADMIN && !isAdmin) {
                router.push(APP_ROUTES.accessDenied);
                return;
            }

            // Sync with URL to support browser history and bookmarks
            if (pathname !== APP_ROUTES.dashboard || searchParams.get("tab") !== menuId) {
                router.push(toDashboardTabPath(menuId), { scroll: false });
            }

            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            }
        },
        [isAdmin, router, searchParams, pathname],
    );

    const handleSignOut = useCallback(() => {
        void (async () => {
            const userId =
                typeof user?.id === "string"
                    ? user.id.trim()
                    : typeof user?.id === "number"
                      ? String(user.id)
                      : "";
            if (typeof window !== "undefined") {
                if (userId) {
                    window.localStorage.removeItem(
                        `${STOCK_BROWSE_CART_STORAGE_KEY_PREFIX}${userId}`,
                    );
                }
                window.localStorage.removeItem(STOCK_BROWSE_CART_LEGACY_KEY);
            }
            await signOut();
        })();
    }, [signOut, user?.id]);

    const dataValue = useMemo<DashboardDataContextValue>(
        () => ({
            status: effectiveStatus,
            user,
            isAdmin,
            employeeStats,
            refreshTrigger,
            handleEmployeeAdded,
            availableMenuGroups,
        }),
        [
            effectiveStatus,
            user,
            isAdmin,
            employeeStats,
            refreshTrigger,
            handleEmployeeAdded,
            availableMenuGroups,
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
