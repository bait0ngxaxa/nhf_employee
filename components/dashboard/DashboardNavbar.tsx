"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu, Bell, User, LogOut, ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

const MENU_LABELS: Record<string, string> = {
    dashboard: "แดชบอร์ด",
    "it-equipment": "อุปกรณ์ IT",
    "it-support": "IT Support",
    "email-request": "ขอ Email",
    "employee-management": "จัดการพนักงาน",
    "add-employee": "เพิ่มพนักงาน",
    "import-employee": "นำเข้า CSV",
    "audit-logs": "ประวัติการใช้งาน",
};

export function DashboardNavbar() {
    const { selectedMenu, sidebarOpen, setSidebarOpen, handleSignOut } =
        useDashboardUIContext();
    const { user } = useDashboardDataContext();

    const currentPageLabel = MENU_LABELS[selectedMenu] || "แดชบอร์ด";

    return (
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
            <div className="flex items-center justify-between h-14 px-4 md:px-6">
                {/* Left: Mobile menu + Page title */}
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden h-9 w-9"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                    <div className="hidden md:block">
                        <h1 className="text-lg font-semibold text-gray-800">
                            {currentPageLabel}
                        </h1>
                    </div>
                </div>

                {/* Right: User menu */}
                <div className="flex items-center gap-2">
                    {/* Notifications */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-gray-600 hover:text-gray-900"
                    >
                        <Bell className="h-5 w-5" />
                    </Button>

                    {/* User Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "h-9 gap-2 px-2 text-gray-700 hover:text-gray-900",
                                    "hidden sm:flex",
                                )}
                            >
                                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
                                    <User className="h-4 w-4 text-white" />
                                </div>
                                <div className="flex flex-col items-start text-left">
                                    <span className="text-sm font-medium truncate max-w-[120px]">
                                        {user?.name || "ผู้ใช้งาน"}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {user?.role === "ADMIN"
                                            ? "ผู้ดูแลระบบ"
                                            : "ผู้ใช้งาน"}
                                    </span>
                                </div>
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <div className="px-3 py-2">
                                <p className="text-sm font-medium">
                                    {user?.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {user?.email}
                                </p>
                                <p className="text-xs text-blue-600 mt-1">
                                    {user?.role === "ADMIN"
                                        ? "ผู้ดูแลระบบ"
                                        : "ผู้ใช้งาน"}{" "}
                                    | {user?.department}
                                </p>
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={handleSignOut}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                ออกจากระบบ
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Mobile user button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="sm:hidden h-9 w-9"
                        onClick={handleSignOut}
                    >
                        <LogOut className="h-5 w-5 text-red-500" />
                    </Button>
                </div>
            </div>

            {/* Mobile: Page title */}
            <div className="md:hidden px-4 pb-2">
                <h1 className="text-base font-semibold text-gray-800">
                    {currentPageLabel}
                </h1>
            </div>
        </header>
    );
}
