import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { User, Home, ChevronDown, PanelLeftClose, PanelLeft } from "lucide-react";

import { getRoleLabelThai } from "@/lib/ssot/permissions";
import { type MenuGroup } from "@/types/dashboard";
import { type MenuItem } from "@/types/dashboard";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

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
    const disabled = item.comingSoon === true;

    return (
        <div className="relative group px-2">
            <Button
                variant="ghost"
                disabled={disabled}
                className={cn(
                    "relative w-full justify-start overflow-hidden group/btn h-12 rounded-[1rem] transition-all duration-500",
                    isActive
                        ? "bg-sky-50 text-sky-600 shadow-sm border border-sky-100/50"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                    !sidebarOpen && "justify-center px-0",
                    indented && sidebarOpen && "pl-10 h-10",
                    disabled && "opacity-40 cursor-not-allowed",
                )}
                onClick={disabled ? undefined : onClick}
            >
                <div
                    className={cn(
                        "relative z-10 flex items-center w-full",
                        !sidebarOpen && "justify-center",
                    )}
                >
                    <div
                        className={cn(
                            "flex items-center justify-center shrink-0 transition-transform duration-500",
                            indented && sidebarOpen ? "w-5 h-5" : "w-6 h-6",
                            isActive ? "scale-110" : "group-hover/btn:scale-110",
                        )}
                    >
                        <IconComponent
                            className={cn(
                                indented && sidebarOpen ? "h-3.5 w-3.5" : "h-5 w-5",
                                isActive ? "text-sky-600" : "text-slate-400 group-hover/btn:text-slate-900",
                            )}
                        />
                    </div>
                    {sidebarOpen && (
                        <span className={cn(
                            "ml-3 whitespace-nowrap tracking-tight transition-all duration-300",
                            isActive ? "font-black text-sm" : "font-semibold text-sm opacity-80 group-hover/btn:opacity-100"
                        )}>
                            {item.label}
                        </span>
                    )}
                </div>
                
                {/* Active Indicator Bar */}
                {isActive && sidebarOpen && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-sky-500 rounded-full" />
                )}

                {/* Coming-soon badge */}
                {sidebarOpen && disabled && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 pointer-events-none">
                        Soon
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
    const hasActiveChild = group.items.some((item) => item.id === selectedMenu);

    if (!sidebarOpen) {
        return (
            <div className="space-y-1 mb-2">
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
        <div className="space-y-1 mb-4">
            {/* Group Header */}
            <button
                type="button"
                onClick={onToggle}
                className={cn(
                    "flex items-center w-full px-5 py-2 rounded-lg text-left transition-all duration-300 group/header",
                    hasActiveChild ? "text-slate-900" : "text-slate-400 hover:text-slate-600",
                )}
            >
                <span className="text-[10px] font-black uppercase tracking-[0.2em] flex-1 whitespace-nowrap">
                    {group.label}
                </span>
                <ChevronDown
                    className={cn(
                        "h-3 w-3 transition-transform duration-500",
                        isExpanded && "rotate-180",
                    )}
                />
            </button>

            {/* Collapsible Children */}
            <div
                className="overflow-hidden transition-all duration-500 ease-in-out"
                style={{
                    maxHeight: isExpanded ? `${group.items.length * 48}px` : "0px",
                    opacity: isExpanded ? 1 : 0,
                }}
            >
                <div className="space-y-1 mt-1">
                    {group.items.map((item) => (
                        <SidebarMenuItem
                            key={item.id}
                            item={item}
                            isActive={selectedMenu === item.id}
                            sidebarOpen={true}
                            indented={true}
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
    const { user, availableMenuGroups } =
        useDashboardDataContext();

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
                "h-full bg-white border-r border-slate-100 flex flex-col z-20 overflow-hidden transition-all duration-500 ease-in-out",
                sidebarOpen ? "w-72" : "w-20",
            )}
        >
            {/* Header / Logo Section */}
            <div className={cn(
                "flex items-center gap-4 transition-all duration-500",
                sidebarOpen ? "p-8" : "p-4 flex-col gap-3"
            )}>
                <div className="relative group/logo">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-[0_8px_16px_-4px_rgba(14,165,233,0.3)] transition-transform duration-500 group-hover/logo:rotate-12">
                        <span className="text-xl font-black">N</span>
                    </div>
                </div>
                {sidebarOpen && (
                    <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2 duration-500">
                        <h1 className="text-xl font-black tracking-tighter text-slate-900 leading-none">
                            NHF<span className="text-sky-500">app</span>
                        </h1>
                    </div>
                )}
                {/* Sidebar Toggle Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="hidden md:flex h-8 w-8 rounded-xl bg-slate-50 border border-slate-100 hover:bg-sky-50 hover:border-sky-100 transition-all duration-300 shrink-0"
                    aria-label={sidebarOpen ? "ย่อเมนู" : "ขยายเมนู"}
                    onClick={onToggle}
                >
                    {sidebarOpen ? (
                        <PanelLeftClose className="h-4 w-4 text-slate-500" />
                    ) : (
                        <PanelLeft className="h-4 w-4 text-slate-500" />
                    )}
                </Button>
            </div>

            {/* Navigation Area */}
            <nav className={cn(
                "flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar",
                sidebarOpen ? "px-2" : "px-0"
            )}>
                <div className="space-y-1 mb-6">
                    <SidebarMenuItem
                        item={{
                            id: "dashboard",
                            label: "Overview",
                            icon: Home,
                            description: "Main Dashboard",
                        }}
                        isActive={selectedMenu === "dashboard"}
                        sidebarOpen={sidebarOpen}
                        indented={false}
                        onClick={() => handleMenuClick("dashboard")}
                    />
                </div>

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
            </nav>

            {/* Footer / User Profile Section */}
            <div className={cn(
                "transition-all duration-500 border-t border-slate-50",
                sidebarOpen ? "p-6" : "p-4"
            )}>
                {sidebarOpen ? (
                    <div className="relative group/profile p-1 rounded-[1.5rem] bg-slate-50/50 border border-slate-100 hover:border-sky-100 transition-all duration-500">
                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0 border border-sky-100/50">
                                <User className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate tracking-tight">
                                    {user?.name}
                                </p>
                                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">
                                    {getRoleLabelThai(user?.role)}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-sky-500 hover:text-white transition-all duration-500 cursor-pointer">
                            <User className="h-5 w-5" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
