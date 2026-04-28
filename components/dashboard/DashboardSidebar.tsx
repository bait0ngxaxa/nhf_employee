import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Menu, X, User, Home, ChevronDown } from "lucide-react";

import { getMenuTheme } from "@/constants/dashboard";
import { getRoleLabelThai } from "@/lib/ssot/permissions";
import { type MenuGroup } from "@/types/dashboard";
import { type MenuItem } from "@/types/dashboard";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

const TRANSITION_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

function SidebarMenuItem({
    item,
    isActive,
    sidebarOpen,
    indented,
    onClick,
}: {
    item: MenuItem;
    isActive: boolean;
    sidebarOpen: boolean;
    indented: boolean;
    onClick: () => void;
}) {
    const IconComponent = item.icon;
    const theme = getMenuTheme(item.id);
    const disabled = item.comingSoon === true;

    return (
        <div className="relative group">
            {isActive && sidebarOpen ? (
                <div
                    className={cn(
                        `absolute inset-0 bg-gradient-to-r ${theme.glow} opacity-20 rounded-xl`,
                    )}
                    style={{ filter: "blur(16px)" }}
                />
            ) : null}
            <Button
                variant="ghost"
                disabled={disabled}
                className={cn(
                    "relative w-full justify-start overflow-hidden group/btn",
                    isActive
                        ? `${theme.activeBg} ${theme.text} shadow-sm border-r-4 ${theme.border}`
                        : `${theme.hover} text-gray-600 hover:text-gray-900`,
                    !sidebarOpen && "justify-center px-0 border-r-0",
                    indented && sidebarOpen && "pl-9 h-9",
                    // Dim but keep visible for coming-soon items
                    disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
                )}
                style={{ transition: "all 200ms ease-out" }}
                onClick={disabled ? undefined : onClick}
            >
                {isActive && sidebarOpen && (
                    <div
                        className={cn(
                            "absolute -right-2 -top-2 w-12 h-12 rounded-full pointer-events-none",
                            theme.activeBg,
                        )}
                        style={{ filter: "blur(12px)" }}
                    />
                )}

                <div
                    className={cn(
                        "relative z-10 flex items-center w-full",
                        !sidebarOpen && "justify-center",
                    )}
                >
                    <div
                        className={cn(
                            "rounded-lg",
                            indented && sidebarOpen ? "p-1.5" : "p-2",
                            isActive
                                ? "bg-white shadow-sm"
                                : `${theme.lightBg} group-hover/btn:scale-110`,
                            disabled && "group-hover/btn:scale-100",
                        )}
                        style={{
                            transition: `transform 200ms ease-out, background-color 200ms ease-out`,
                        }}
                    >
                        <span style={{ transition: "color 200ms ease-out" }}>
                            <IconComponent
                                className={cn(
                                    indented && sidebarOpen
                                        ? "h-4 w-4"
                                        : "h-4 w-4",
                                    isActive
                                        ? theme.text
                                        : "text-gray-500 group-hover/btn:text-gray-900",
                                )}
                            />
                        </span>
                    </div>
                    {sidebarOpen && (
                        <span className="ml-3 font-medium whitespace-nowrap">
                            {item.label}
                        </span>
                    )}
                </div>
                {/* Coming-soon badge — absolute so it never shifts the label */}
                {sidebarOpen && disabled && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 pointer-events-none">
                        เร็วๆ นี้
                    </span>
                )}
            </Button>
        </div>
    );
}

function SidebarMenuGroup({
    group,
    selectedMenu,
    sidebarOpen,
    isExpanded,
    onToggle,
    onItemClick,
}: {
    group: MenuGroup;
    selectedMenu: string;
    sidebarOpen: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    onItemClick: (menuId: string) => void;
}) {
    const GroupIcon = group.icon;
    // Check if any child in this group is active
    const hasActiveChild = group.items.some((item) => item.id === selectedMenu);

    // In collapsed sidebar mode, show only child item icons
    if (!sidebarOpen) {
        return (
            <div className="space-y-0.5">
                {group.items.map((item) => (
                    <SidebarMenuItem
                        key={item.id}
                        item={item}
                        isActive={selectedMenu === item.id}
                        sidebarOpen={false}
                        indented={false}
                        onClick={() => onItemClick(item.id)}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-0.5">
            {/* Group Header */}
            <button
                type="button"
                onClick={onToggle}
                className={cn(
                    "flex items-center w-full px-3 py-1.5 rounded-lg text-left transition-colors duration-200",
                    hasActiveChild
                        ? "text-gray-900 bg-gray-100/60"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                )}
            >
                <GroupIcon
                    className={cn(
                        "h-4 w-4 mr-2.5 shrink-0",
                        hasActiveChild ? "text-gray-700" : "text-gray-400",
                    )}
                />
                <span className="text-sm font-semibold uppercase tracking-wider flex-1 whitespace-nowrap">
                    {group.label}
                </span>
                <ChevronDown
                    className={cn(
                        "h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform duration-200",
                        isExpanded && "rotate-180",
                    )}
                />
            </button>

            {/* Collapsible Children */}
            <div
                className="overflow-hidden"
                style={{
                    maxHeight: isExpanded
                        ? `${group.items.length * 40}px`
                        : "0px",
                    opacity: isExpanded ? 1 : 0,
                    transition: `max-height 250ms ${TRANSITION_EASE}, opacity 200ms ${TRANSITION_EASE}`,
                }}
            >
                <div className="ml-2 border-l-2 border-gray-200/70 pl-1 space-y-px py-0.5">
                    {group.items.map((item) => (
                        <SidebarMenuItem
                            key={item.id}
                            item={item}
                            isActive={selectedMenu === item.id}
                            sidebarOpen
                            indented
                            onClick={() => onItemClick(item.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export function DashboardSidebar() {
    const { selectedMenu, sidebarOpen, handleMenuClick, setSidebarOpen } =
        useDashboardUIContext();
    const { user, availableMenuGroups, sessionMenuItem } =
        useDashboardDataContext();

    // Default: expand all groups
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        () => new Set(availableMenuGroups.map((g) => g.id)),
    );

    const toggleGroup = (groupId: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const onToggle = () => setSidebarOpen(!sidebarOpen);

    return (
        <div
            className={cn(
                "h-full bg-white shadow-lg border-r border-gray-200/50 flex flex-col z-20 overflow-hidden will-change-transform",
                sidebarOpen ? "w-64" : "w-16",
            )}
            style={{
                transition: `width 300ms ${TRANSITION_EASE}`,
            }}
        >
            {/* Header */}
            <div
                className={cn(
                    "border-b border-gray-100",
                    sidebarOpen ? "p-4" : "p-2",
                )}
                style={{
                    transition: `padding 300ms ${TRANSITION_EASE}`,
                }}
            >
                <div
                    className={cn(
                        "flex items-center",
                        sidebarOpen ? "justify-between" : "justify-center",
                    )}
                >
                    {sidebarOpen ? (
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent whitespace-nowrap overflow-hidden">
                            NHFapp
                        </h1>
                    ) : null}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggle}
                        aria-label={
                            sidebarOpen ? "ปิด Sidebar" : "เปิด Sidebar"
                        }
                        className={cn(!sidebarOpen && "h-10 w-10 p-0")}
                    >
                        {sidebarOpen ? (
                            <X className="h-4 w-4" />
                        ) : (
                            <Menu className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Navigation */}
            <nav
                className={cn(
                    "flex-1 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar",
                    sidebarOpen ? "px-4 py-3" : "p-2",
                )}
                style={{
                    transition: `padding 300ms ${TRANSITION_EASE}`,
                }}
            >
                {/* Dashboard Button (standalone) */}
                <SidebarMenuItem
                    item={{
                        id: "dashboard",
                        label: "หน้าแรก",
                        icon: Home,
                        description: "หน้าหลัก",
                    }}
                    isActive={selectedMenu === "dashboard"}
                    sidebarOpen={sidebarOpen}
                    indented={false}
                    onClick={() => handleMenuClick("dashboard")}
                />

                <Separator className="my-1.5" />

                {/* Menu Groups */}
                {availableMenuGroups.map((group) => (
                    <SidebarMenuGroup
                        key={group.id}
                        group={group}
                        selectedMenu={selectedMenu}
                        sidebarOpen={sidebarOpen}
                        isExpanded={expandedGroups.has(group.id)}
                        onToggle={() => toggleGroup(group.id)}
                        onItemClick={handleMenuClick}
                    />
                ))}

                <Separator className="my-1.5" />

                {/* Session Management (standalone) */}
                <SidebarMenuItem
                    item={sessionMenuItem}
                    isActive={selectedMenu === "sessions"}
                    sidebarOpen={sidebarOpen}
                    indented={false}
                    onClick={() => handleMenuClick("sessions")}
                />
            </nav>

            {/* User Info */}
            {sidebarOpen && user && (
                <div className="border-t border-gray-100 p-4">
                    <div className="p-3 bg-gradient-to-br from-gray-50 to-blue-50/50 rounded-xl border border-blue-100/50 overflow-hidden">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">
                                <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">
                                    {user.name}
                                </p>
                                <p className="text-xs text-blue-600 font-medium truncate">
                                    {getRoleLabelThai(user.role)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
