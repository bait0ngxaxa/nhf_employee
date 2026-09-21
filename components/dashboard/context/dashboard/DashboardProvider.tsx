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
    canAccessEmailRequestDashboard,
    canAccessEmployeeDashboard,
    canAccessLeaveDashboard,
    canAccessStockDashboard,
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
import { isAdminRole } from "@/lib/ssot/permissions";
import { useAuth } from "@/modules/auth/client";
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
    const signOutUserId =
        typeof user?.id === "string"
            ? user.id.trim()
            : typeof user?.id === "number"
              ? String(user.id)
              : "";
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
        () => getAvailableMenuGroups(
            isAdmin,
            user?.routineCapabilities,
            user?.stockCapabilities,
            {
                leaveCapabilities: user?.leaveCapabilities,
                canApproveLeave: user?.canApproveLeave,
                canViewLeaveReports: user?.canViewLeaveReports,
            },
            user?.employeeCapabilities,
            user?.auditCapabilities,
            user?.emailRequestCapabilities,
        ),
        [
            isAdmin,
            user?.routineCapabilities,
            user?.stockCapabilities,
            user?.leaveCapabilities,
            user?.canApproveLeave,
            user?.canViewLeaveReports,
            user?.employeeCapabilities,
            user?.auditCapabilities,
            user?.emailRequestCapabilities,
        ],
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
            if (
                menuId === "routine"
                && user?.routineCapabilities?.canReadTasks !== true
            ) {
                router.push(APP_ROUTES.accessDenied);
                return;
            }
            if (
                menuId === "stock"
                && !canAccessStockDashboard(user?.stockCapabilities)
            ) {
                router.push(APP_ROUTES.accessDenied);
                return;
            }
            if (
                menuId === "leave-management"
                && !canAccessLeaveDashboard({
                    leaveCapabilities: user?.leaveCapabilities,
                    canApproveLeave: user?.canApproveLeave,
                    canViewLeaveReports: user?.canViewLeaveReports,
                })
            ) {
                router.push(APP_ROUTES.accessDenied);
                return;
            }
            if (
                menuId === "employee-management"
                && !canAccessEmployeeDashboard(user?.employeeCapabilities)
            ) {
                router.push(APP_ROUTES.accessDenied);
                return;
            }
            if (
                menuId === "add-employee"
                && user?.employeeCapabilities?.canCreateEmployees !== true
            ) {
                router.push(APP_ROUTES.accessDenied);
                return;
            }
            if (
                menuId === "import-employee"
                && user?.employeeCapabilities?.canImportEmployees !== true
            ) {
                router.push(APP_ROUTES.accessDenied);
                return;
            }
            if (
                menuId === "audit-logs"
                && user?.auditCapabilities?.canReadAuditLogs !== true
            ) {
                router.push(APP_ROUTES.accessDenied);
                return;
            }
            if (
                menuId === "email-request"
                && !canAccessEmailRequestDashboard(user?.emailRequestCapabilities)
            ) {
                router.push(APP_ROUTES.accessDenied);
                return;
            }
            if (menuId === "authorization-administration" && !isAdmin) {
                router.push(APP_ROUTES.accessDenied);
                return;
            }

            const targetPath = toDashboardMenuPath(menuId);
            if (pathname !== targetPath) {
                router.push(targetPath, { scroll: false });
            }
        },
        [
            isAdmin,
            pathname,
            router,
            user?.routineCapabilities,
            user?.stockCapabilities,
            user?.leaveCapabilities,
            user?.canApproveLeave,
            user?.canViewLeaveReports,
            user?.employeeCapabilities,
            user?.auditCapabilities,
            user?.emailRequestCapabilities,
        ],
    );

    const handleSignOut = useCallback(async (): Promise<void> => {
        clearStockBrowseCart(signOutUserId);
        await signOut();
    }, [signOut, signOutUserId]);

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
