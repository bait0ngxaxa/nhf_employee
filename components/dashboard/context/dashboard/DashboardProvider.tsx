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
import { Smartphone } from "lucide-react";
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
import { logoutHybridSession, refreshHybridSession } from "@/lib/client-auth";
import { AUTH_MUTATION_HEADERS } from "@/lib/auth-csrf";
import {
    API_ROUTES,
    APP_ROUTES,
    toDashboardTabPath,
} from "@/lib/ssot/routes";
import { isAdminRole, USER_ROLES } from "@/lib/ssot/permissions";

interface DashboardProviderProps {
    children: ReactNode;
    initialUser?: DashboardDataContextValue["user"];
}

const SESSION_MENU_ITEM = {
    id: "sessions",
    label: "จัดการเซสชัน",
    icon: Smartphone,
    description: "จัดการอุปกรณ์ที่ล็อกอินอยู่และยกเลิกเซสชันได้",
} as const;

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
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const user = session?.user ?? initialUser;
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
    const [hybridBootstrapped, setHybridBootstrapped] = useState(false);

    // Sync selectedMenu when URL ?tab= changes (e.g. notification click or browser back/forward)
    useEffect(() => {
        const tabFromUrl = normalizeDashboardTab(searchParams.get("tab"));
        startTransition(() => {
            setSelectedMenu(tabFromUrl);
        });
    }, [searchParams]);

    useEffect(() => {
        if (status !== "authenticated" || hybridBootstrapped) {
            return;
        }

        void (async () => {
            try {
                await fetch(API_ROUTES.auth.bootstrap, {
                    method: "POST",
                    credentials: "include",
                    headers: AUTH_MUTATION_HEADERS,
                });
            } finally {
                setHybridBootstrapped(true);
            }
        })();
    }, [status, hybridBootstrapped]);

    useEffect(() => {
        if (status !== "authenticated") {
            return;
        }

        const refreshSession = (): void => {
            void refreshHybridSession();
        };

        refreshSession();

        const intervalId = window.setInterval(refreshSession, 5 * 60 * 1000);
        const onVisibilityChange = (): void => {
            if (document.visibilityState === "visible") {
                refreshSession();
            }
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [status]);

    const availableMenuGroups = useMemo(
        () => getAvailableMenuGroups(isAdmin),
        [isAdmin],
    );

    const sessionMenuItem = SESSION_MENU_ITEM;

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
            await logoutHybridSession();
            await signOut({ callbackUrl: "/login" });
        })();
    }, []);

    const dataValue = useMemo<DashboardDataContextValue>(
        () => ({
            status: effectiveStatus,
            user,
            isAdmin,
            employeeStats,
            refreshTrigger,
            handleEmployeeAdded,
            availableMenuGroups,
            sessionMenuItem,
        }),
        [
            effectiveStatus,
            user,
            isAdmin,
            employeeStats,
            refreshTrigger,
            handleEmployeeAdded,
            availableMenuGroups,
            sessionMenuItem,
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
