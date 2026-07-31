import { type ReactElement } from "react";
import {
    useDashboardDataContext,
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import {
    SidebarFooter,
    SidebarHeader,
    SidebarNav,
    useExpandedSidebarGroups,
} from "@/components/dashboard/layout/DashboardSidebarPrimitives";
import { cn } from "@/lib/ui/utils";
import { getRoleLabelThai } from "@/lib/ssot/permissions";

type DashboardSidebarProps = {
    variant?: "desktop" | "mobile";
};

export function DashboardSidebar({
    variant = "desktop",
}: DashboardSidebarProps): ReactElement {
    const {
        selectedMenu,
        desktopSidebarCollapsed,
        handleMenuClick,
        setDesktopSidebarCollapsed,
    } = useDashboardUIContext();
    const { user, availableMenuGroups } = useDashboardDataContext();
    const { expandedGroups, toggleGroup } =
        useExpandedSidebarGroups(availableMenuGroups);
    const displayName = user?.name?.trim() || "ผู้ใช้งาน";
    const roleLabel = getRoleLabelThai(user?.role);
    const sidebarOpen = variant === "mobile" || !desktopSidebarCollapsed;

    return (
        <aside
            className={cn(
                "z-20 flex h-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
                variant === "mobile"
                    ? "w-full"
                    : "transition-[width] duration-200",
                variant === "desktop" &&
                    (sidebarOpen ? "w-64 2xl:w-72" : "w-20"),
            )}
            aria-label="แถบนำทางหลัก"
        >
            <SidebarHeader
                sidebarOpen={sidebarOpen}
                collapsible={variant === "desktop"}
                onToggle={() =>
                    setDesktopSidebarCollapsed(!desktopSidebarCollapsed)
                }
            />
            <SidebarNav
                sidebarOpen={sidebarOpen}
                selectedMenu={selectedMenu}
                availableMenuGroups={availableMenuGroups}
                expandedGroups={expandedGroups}
                toggleGroup={toggleGroup}
                handleMenuClick={handleMenuClick}
            />
            <SidebarFooter
                sidebarOpen={sidebarOpen}
                name={displayName}
                role={roleLabel}
            />
        </aside>
    );
}
