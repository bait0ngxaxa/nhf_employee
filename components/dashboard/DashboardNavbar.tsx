"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu, User, LogOut, ChevronDown, Smartphone } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import { NotificationDropdown } from "./NotificationDropdown";
import { getRoleLabelThai } from "@/lib/ssot/permissions";

export function DashboardNavbar() {
    const { sidebarOpen, setSidebarOpen, handleSignOut, handleMenuClick } =
        useDashboardUIContext();
    const { user } = useDashboardDataContext();
    const [showLogoutDialog, setShowLogoutDialog] = useState(false);

    const confirmLogout = () => {
        setShowLogoutDialog(false);
        handleSignOut();
    };

    return (
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-50">
            <div className="flex items-center justify-between h-20 px-6 md:px-10">
                {/* Left: Mobile menu + Page title */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden h-10 w-10 rounded-2xl bg-white border border-slate-100 shadow-sm"
                        aria-label="เปิดเมนู"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        <Menu className="h-5 w-5 text-slate-600" />
                    </Button>
                </div>

                {/* Right: User menu */}
                <div className="flex items-center gap-4">
                    {/* Notifications */}
                    <div className="p-1 rounded-2xl bg-white border border-slate-100 transition-transform hover:-translate-y-0.5 shadow-sm">
                        <NotificationDropdown />
                    </div>

                    <div className="h-8 w-px bg-slate-100 mx-1 hidden sm:block" />

                    {/* User Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "h-12 gap-3 px-1 pr-4 rounded-[1.25rem] transition-all duration-500",
                                    "bg-white border border-slate-100 hover:border-sky-100 shadow-sm hover:shadow-md",
                                    "hidden sm:flex group",
                                )}
                            >
                                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 transition-transform duration-500 group-hover:rotate-6 shadow-lg shadow-sky-100">
                                    <User className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex flex-col items-start text-left">
                                    <span className="text-sm font-black text-slate-900 tracking-tight">
                                        {user?.name || "User"}
                                    </span>
                                    <span className="text-[10px] font-bold text-sky-600 uppercase tracking-widest leading-none">
                                        {getRoleLabelThai(user?.role)}
                                    </span>
                                </div>
                                <ChevronDown className="h-3 w-3 text-slate-400 group-hover:text-sky-600 transition-colors" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="w-64 p-2 rounded-2xl border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)] bg-white/95 backdrop-blur-xl"
                        >
                            <div className="px-4 py-4 mb-2 rounded-xl bg-sky-50/50 border border-sky-100/50">
                                <p className="text-sm font-black text-slate-900 leading-none mb-1">
                                    {user?.name}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-widest">
                                    {user?.email}
                                </p>
                                <div className="mt-3 pt-3 border-t border-sky-100/30 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-sky-600">
                                        {user?.department}
                                    </span>
                                    <span className="text-[8px] px-2 py-0.5 rounded-full bg-sky-500 text-white font-black uppercase tracking-widest">
                                        {user?.role}
                                    </span>
                                </div>
                            </div>

                            <DropdownMenuItem
                                onClick={() => handleMenuClick("sessions")}
                                className="h-11 rounded-xl focus:bg-sky-50 cursor-pointer group"
                            >
                                <Smartphone className="h-4 w-4 mr-3 text-slate-400 group-hover:text-sky-600 transition-colors" />
                                <span className="text-sm font-bold text-slate-600 group-hover:text-sky-900">
                                    จัดการเซสชัน
                                </span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-slate-50" />
                            <DropdownMenuItem
                                onClick={() => setShowLogoutDialog(true)}
                                className="h-11 rounded-xl focus:bg-rose-50 cursor-pointer text-rose-600 focus:text-rose-600"
                            >
                                <LogOut className="h-4 w-4 mr-3" />
                                <span className="text-sm font-bold">
                                    ออกจากระบบ
                                </span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Mobile user dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="sm:hidden h-10 w-10 rounded-2xl bg-white border border-slate-100"
                                aria-label="เมนูผู้ใช้"
                            >
                                <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500">
                                    <User className="h-4 w-4 text-white" />
                                </div>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="w-56 p-2 rounded-2xl border-slate-100"
                        >
                            <DropdownMenuItem
                                onClick={() => handleMenuClick("sessions")}
                                className="h-11 rounded-xl focus:bg-sky-50"
                            >
                                <Smartphone className="h-4 w-4 mr-3 text-slate-400" />
                                <span className="text-sm font-bold text-slate-600">
                                    จัดการเซสชัน
                                </span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-slate-50" />
                            <DropdownMenuItem
                                onClick={() => setShowLogoutDialog(true)}
                                className="h-11 rounded-xl text-rose-600"
                            >
                                <LogOut className="h-4 w-4 mr-3" />
                                <span className="text-sm font-bold">
                                    ออกจากระบบ
                                </span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Logout Confirmation Dialog - Clean Refined */}
            <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none rounded-[2.5rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.18)]">
                    <div className="bg-white p-10">
                        <div className="w-16 h-16 rounded-3xl bg-rose-50 flex items-center justify-center text-rose-500 mb-6 shadow-inner border border-rose-100/50">
                            <LogOut className="w-8 h-8" />
                        </div>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                                Confirm Logout
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 font-medium leading-relaxed">
                                คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบบัญชีของคุณ?
                                การดำเนินการนี้จะสิ้นสุดเซสชันปัจจุบันของคุณ
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="bg-slate-50/50 p-6 flex gap-3 justify-end px-10 pb-10">
                        <Button
                            variant="ghost"
                            onClick={() => setShowLogoutDialog(false)}
                            className="h-12 px-6 rounded-xl font-bold text-slate-400 hover:text-slate-900 hover:bg-white"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            onClick={confirmLogout}
                            className="h-12 px-8 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-200"
                        >
                            ออกจากระบบ
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </header>
    );
}
