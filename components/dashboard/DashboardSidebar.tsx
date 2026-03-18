import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Menu, X, User, Settings, LogOut } from "lucide-react";

import { getMenuTheme } from "@/constants/dashboard";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

export function DashboardSidebar() {
    const {
        selectedMenu,
        sidebarOpen,
        handleMenuClick,
        setSidebarOpen,
        handleSignOut,
    } = useDashboardUIContext();
    const { user, availableMenuItems: menuItems } = useDashboardDataContext();

    const dashboardTheme = getMenuTheme("dashboard");

    const onToggle = () => setSidebarOpen(!sidebarOpen);

    return (
        <div
            className={cn(
                "h-full bg-white shadow-lg border-r border-gray-200/50 flex flex-col z-20 overflow-hidden will-change-transform",
                sidebarOpen ? "w-64" : "w-16",
            )}
            style={{
                transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
        >
            {/* Header */}
            <div
                className={cn(
                    "border-b border-gray-100",
                    sidebarOpen ? "p-4" : "p-2",
                )}
                style={{
                    transition: "padding 300ms cubic-bezier(0.4, 0, 0.2, 1)",
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
                            NHF Platform
                        </h1>
                    ) : null}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggle}
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
                    "flex-1 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar",
                    sidebarOpen ? "p-4" : "p-2",
                )}
                style={{
                    transition: "padding 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
            >
                <div className="relative group">
                    {/* Decorative Glow for Active State */}
                    {selectedMenu === "dashboard" && sidebarOpen ? (
                        <div
                            className={cn(
                                `absolute inset-0 bg-gradient-to-r ${dashboardTheme.glow} opacity-20 rounded-xl`,
                            )}
                            style={{ filter: "blur(16px)" }}
                        />
                    ) : null}
                    <Button
                        variant="ghost"
                        className={cn(
                            "relative w-full justify-start overflow-hidden group/btn",
                            selectedMenu === "dashboard"
                                ? `${dashboardTheme.activeBg} ${dashboardTheme.text} shadow-sm border-r-4 ${dashboardTheme.border}`
                                : `${dashboardTheme.hover} text-gray-600 hover:text-gray-900`,
                            !sidebarOpen && "justify-center px-0 border-r-0",
                        )}
                        style={{
                            transition: "all 200ms ease-out",
                        }}
                        onClick={() => handleMenuClick("dashboard")}
                    >
                        {/* Decorative Blob for Active State */}
                        {selectedMenu === "dashboard" && sidebarOpen ? (
                            <div
                                className="absolute -right-2 -top-2 w-12 h-12 bg-blue-200/50 rounded-full pointer-events-none"
                                style={{ filter: "blur(12px)" }}
                            />
                        ) : null}

                        <div
                            className={cn(
                                "relative z-10 flex items-center w-full",
                                !sidebarOpen && "justify-center",
                            )}
                        >
                            <div
                                className={cn(
                                    "p-2 rounded-lg",
                                    selectedMenu === "dashboard"
                                        ? "bg-white shadow-sm"
                                        : `${dashboardTheme.lightBg} group-hover/btn:scale-110`,
                                )}
                                style={{
                                    transition:
                                        "transform 200ms ease-out, background-color 200ms ease-out",
                                }}
                            >
                                <span
                                    style={{
                                        transition: "color 200ms ease-out",
                                    }}
                                >
                                    <Settings
                                        className={cn(
                                            "h-4 w-4",
                                            selectedMenu === "dashboard"
                                                ? dashboardTheme.text
                                                : "text-gray-500 group-hover/btn:text-gray-900",
                                        )}
                                    />
                                </span>
                            </div>
                            {sidebarOpen ? (
                                <span className="ml-3 font-medium whitespace-nowrap">
                                    แดชบอร์ด
                                </span>
                            ) : null}
                        </div>
                    </Button>
                </div>

                <Separator className="my-2" />

                {menuItems.map((item) => {
                    const IconComponent = item.icon;
                    const isActive = selectedMenu === item.id;
                    const theme = getMenuTheme(item.id);

                    return (
                        <div key={item.id} className="relative group">
                            {/* Decorative Glow for Active State */}
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
                                className={cn(
                                    "relative w-full justify-start overflow-hidden group/btn",
                                    isActive
                                        ? `${theme.activeBg} ${theme.text} shadow-sm border-r-4 ${theme.border}`
                                        : `${theme.hover} text-gray-600 hover:text-gray-900`,
                                    !sidebarOpen &&
                                        "justify-center px-0 border-r-0",
                                )}
                                style={{
                                    transition: "all 200ms ease-out",
                                }}
                                onClick={() => handleMenuClick(item.id)}
                            >
                                {/* Decorative Blob for Active State - visible only when open to prevent overflow */}
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
                                            "p-2 rounded-lg",
                                            isActive
                                                ? "bg-white shadow-sm"
                                                : `${theme.lightBg} group-hover/btn:scale-110`,
                                        )}
                                        style={{
                                            transition:
                                                "transform 200ms ease-out, background-color 200ms ease-out",
                                        }}
                                    >
                                        <span
                                            style={{
                                                transition:
                                                    "color 200ms ease-out",
                                            }}
                                        >
                                            <IconComponent
                                                className={cn(
                                                    "h-4 w-4",
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
                            </Button>
                        </div>
                    );
                })}
            </nav>

            {/* User Info & Logout */}
            <div
                className={cn(
                    "border-t border-gray-100",
                    sidebarOpen ? "p-4" : "p-2",
                )}
                style={{
                    transition: "padding 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
            >
                {sidebarOpen && user && (
                    <div className="mb-3 p-3 bg-gradient-to-br from-gray-50 to-blue-50/50 rounded-xl border border-blue-100/50 overflow-hidden">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">
                                <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">
                                    {user.name}
                                </p>
                                <p className="text-xs text-blue-600 font-medium truncate">
                                    {user.role === "ADMIN"
                                        ? "ผู้ดูแลระบบ"
                                        : "ผู้ใช้งาน"}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <Button
                    variant="ghost"
                    className={cn(
                        "w-full text-red-600 hover:text-red-700 hover:bg-red-50 group",
                        sidebarOpen ? "justify-start" : "justify-center px-0",
                    )}
                    onClick={handleSignOut}
                    title={!sidebarOpen ? "ออกจากระบบ" : undefined}
                >
                    <div className="p-2 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors shrink-0">
                        <LogOut className="h-4 w-4" />
                    </div>
                    {sidebarOpen && (
                        <span className="ml-3 font-medium whitespace-nowrap">
                            ออกจากระบบ
                        </span>
                    )}
                </Button>
            </div>
        </div>
    );
}
