"use client";

import {
    useState,
    useCallback,
    useMemo,
    type ReactElement,
    type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    DASHBOARD_MENU_ITEMS,
    getAvailableMenuGroups,
} from "@/constants/dashboard";
import { DashboardDataContext, DashboardUIContext } from "./DashboardContext";
import {
    type DashboardDataContextValue,
    type DashboardUIContextValue,
} from "./types";
import {
    APP_ROUTES,
    getDashboardMenuIdFromPathname,
    toDashboardMenuPath,
} from "@/lib/ssot/routes";
import { isDashboardTabEnabled } from "@/lib/ssot/features";
import { isAdminRole, USER_ROLES } from "@/lib/ssot/permissions";
import { useAuth } from "@/components/auth/HybridAuthProvider";
import { clearStockBrowseCart } from "@/modules/stock/client";

interface DashboardProviderProps {
    children: ReactNode;
    initialUser?: DashboardDataContextValue["user"];
}

export function DashboardProvider({
    children,
    initialUser,
}: DashboardProviderProps): ReactElement {
    const { user: authUser, status, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const user = authUser ?? initialUser;
    const isAdmin = isAdminRole(user?.role);
    const effectiveStatus =
        status === "authenticated" || initialUser
            ? "authenticated"
            : status;

    const selectedMenu = getDashboardMenuIdFromPathname(pathname);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] =
        useState(false);

    const availableMenuGroups = useMemo(
        () => getAvailableMenuGroups(isAdmin),
        [isAdmin],
    );

    const handleMenuClick = useCallback(
        (menuId: string) => {
            setMobileNavOpen(false);

            const menuItem = DASHBOARD_MENU_ITEMS.find(
                (item) => item.id === menuId,
            );
            if (menuItem?.feature && !isDashboardTabEnabled(menuId)) {
                router.push(APP_ROUTES.dashboard, { scroll: false });
                return;
            }
            if (menuItem?.requiredRole === USER_ROLES.ADMIN && !isAdmin) {
                router.push(APP_ROUTES.accessDenied);
                return;
            }

            const targetPath = toDashboardMenuPath(menuId);
            if (pathname !== targetPath) {
                router.push(targetPath, { scroll: false });
            }
        },
        [isAdmin, pathname, router],
    );

    const handleSignOut = useCallback(async (): Promise<void> => {
        const userId =
            typeof user?.id === "string"
                ? user.id.trim()
                : typeof user?.id === "number"
                  ? String(user.id)
                  : "";

        clearStockBrowseCart(userId);
        await signOut();
    }, [signOut, user?.id]);

    const dataValue = useMemo<DashboardDataContextValue>(
        () => ({
            status: effectiveStatus,
            user,
            isAdmin,
            availableMenuGroups,
        }),
        [
            effectiveStatus,
            user,
            isAdmin,
            availableMenuGroups,
        ],
    );

    const uiValue = useMemo<DashboardUIContextValue>(
        () => ({
            selectedMenu,
            mobileNavOpen,
            setMobileNavOpen,
            desktopSidebarCollapsed,
            setDesktopSidebarCollapsed,
            handleMenuClick,
            handleSignOut,
            router,
        }),
        [
            selectedMenu,
            mobileNavOpen,
            setMobileNavOpen,
            desktopSidebarCollapsed,
            setDesktopSidebarCollapsed,
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
