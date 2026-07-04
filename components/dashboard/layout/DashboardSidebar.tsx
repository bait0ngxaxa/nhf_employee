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

export function DashboardSidebar(): ReactElement {
    const { selectedMenu, sidebarOpen, handleMenuClick, setSidebarOpen } =
        useDashboardUIContext();
    const { user, availableMenuGroups } = useDashboardDataContext();
    const { expandedGroups, toggleGroup } =
        useExpandedSidebarGroups(availableMenuGroups);
    const displayName = user?.name?.trim() || "ผู้ใช้งาน";
    const roleLabel = getRoleLabelThai(user?.role);

    return (
        <aside
            className={cn(
                "z-20 flex h-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
                sidebarOpen ? "w-64 2xl:w-72" : "w-20",
            )}
            aria-label="แถบนำทางหลัก"
        >
            <SidebarHeader
                sidebarOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
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
