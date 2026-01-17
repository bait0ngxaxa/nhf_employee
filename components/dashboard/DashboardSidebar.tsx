import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Menu, X, User, Settings, LogOut } from "lucide-react";
import { type MenuItem } from "@/types/dashboard";

interface UserInfo {
    name?: string | null;
    email?: string | null;
    role?: string;
    department?: string;
}

interface DashboardSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    selectedMenu: string;
    onMenuClick: (menuId: string) => void;
    menuItems: MenuItem[];
    user?: UserInfo;
    onSignOut: () => void;
}

export function DashboardSidebar({
    isOpen,
    onToggle,
    selectedMenu,
    onMenuClick,
    menuItems,
    user,
    onSignOut,
}: DashboardSidebarProps) {
    return (
        <div
            className={cn(
                "bg-white/80 backdrop-blur-xl shadow-lg border-r border-gray-200/50 transition-all duration-300 flex flex-col z-20",
                isOpen ? "w-64" : "w-16"
            )}
        >
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    {isOpen && (
                        <h1 className="text-xl font-bold text-gray-800">
                            ระบบจัดการ
                        </h1>
                    )}
                    <Button variant="ghost" size="sm" onClick={onToggle}>
                        {isOpen ? (
                            <X className="h-4 w-4" />
                        ) : (
                            <Menu className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
                <Button
                    variant={selectedMenu === "dashboard" ? "default" : "ghost"}
                    className={cn(
                        "w-full justify-start",
                        selectedMenu === "dashboard"
                            ? "bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 hover:from-blue-100 hover:to-cyan-100 border-r-4 border-blue-600 shadow-sm"
                            : "hover:bg-gray-50 text-gray-600 hover:text-gray-900",
                        !isOpen && "justify-center px-2"
                    )}
                    onClick={() => onMenuClick("dashboard")}
                >
                    <Settings className="h-4 w-4" />
                    {isOpen && <span className="ml-2">แดชบอร์ด</span>}
                </Button>

                <Separator className="my-2" />

                {menuItems.map((item) => {
                    const IconComponent = item.icon;
                    return (
                        <Button
                            key={item.id}
                            variant={
                                selectedMenu === item.id ? "default" : "ghost"
                            }
                            className={cn(
                                "w-full justify-start",
                                selectedMenu === item.id
                                    ? "bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 hover:from-blue-100 hover:to-cyan-100 border-r-4 border-blue-600 shadow-sm"
                                    : "hover:bg-gray-50 text-gray-600 hover:text-gray-900",
                                !isOpen && "justify-center px-2"
                            )}
                            onClick={() => onMenuClick(item.id)}
                        >
                            <IconComponent className="h-4 w-4" />
                            {isOpen && (
                                <span className="ml-2">{item.label}</span>
                            )}
                        </Button>
                    );
                })}
            </nav>

            {/* User Info & Logout */}
            <div className="p-4 border-t border-gray-100">
                {isOpen && user && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-600" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {user.name}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                    {user.email}
                                </p>
                                <p className="text-xs text-blue-600">
                                    {user.role === "ADMIN"
                                        ? "ผู้ดูแลระบบ"
                                        : "ผู้ใช้งาน"}{" "}
                                    | {user.department}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <Button
                    variant="ghost"
                    className={cn(
                        "w-full text-red-600 hover:text-red-700 hover:bg-red-50",
                        isOpen ? "justify-start" : "justify-center px-2"
                    )}
                    onClick={onSignOut}
                >
                    <LogOut className="h-4 w-4" />
                    {isOpen && <span className="ml-2">ออกจากระบบ</span>}
                </Button>
            </div>
        </div>
    );
}
