"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    AlertCircle,
    ChevronDown,
    Loader2,
    LogOut,
    Menu,
    Smartphone,
    User,
} from "lucide-react";
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
    DialogFooter,
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
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState("");

    const openLogoutDialog = () => {
        setLogoutError("");
        setShowLogoutDialog(true);
    };

    const closeLogoutDialog = () => {
        if (isLoggingOut) {
            return;
        }

        setLogoutError("");
        setShowLogoutDialog(false);
    };

    const confirmLogout = async () => {
        if (isLoggingOut) {
            return;
        }

        setIsLoggingOut(true);
        setLogoutError("");
        try {
            await handleSignOut();
        } catch {
            setIsLoggingOut(false);
            setLogoutError("ไม่สามารถออกจากระบบได้ กรุณาลองใหม่อีกครั้ง");
        }
    };

    return (
        <header className="sticky top-0 z-30 bg-white/95 border-b border-slate-50">
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
                                    "h-12 gap-3 px-1 pr-4 rounded-[1.25rem] transition-colors",
                                    "bg-white border border-slate-100 hover:border-sky-100 shadow-sm hover:shadow-md",
                                    "hidden sm:flex group",
                                )}
                            >
                                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 shadow-lg shadow-sky-100">
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
                            className="w-64 p-2 rounded-2xl border-slate-100 bg-white shadow-lg"
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
                                onClick={openLogoutDialog}
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
                                onClick={openLogoutDialog}
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

            <Dialog open={showLogoutDialog} onOpenChange={(open) => {
                if (!open) {
                    closeLogoutDialog();
                    return;
                }
                setShowLogoutDialog(true);
            }}>
                <DialogContent
                    showCloseButton={!isLoggingOut}
                    onEscapeKeyDown={(event) => {
                        if (isLoggingOut) {
                            event.preventDefault();
                        }
                    }}
                    onPointerDownOutside={(event) => {
                        if (isLoggingOut) {
                            event.preventDefault();
                        }
                    }}
                    className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 p-0 shadow-xl sm:max-w-[26rem]"
                >
                    <div className="space-y-5 bg-white px-6 pb-5 pt-6 sm:px-7">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600">
                                <LogOut className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <DialogHeader className="min-w-0 flex-1 text-left">
                                <DialogTitle className="text-lg font-semibold leading-7 text-slate-950 [overflow-wrap:anywhere]">
                                    ออกจากระบบบัญชีนี้?
                                </DialogTitle>
                                <DialogDescription className="text-sm font-medium leading-6 text-slate-600 [overflow-wrap:anywhere]">
                                    ระบบจะสิ้นสุดเซสชันบนอุปกรณ์นี้ และพาคุณกลับไปหน้าเข้าสู่ระบบ
                                </DialogDescription>
                            </DialogHeader>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                            งานที่ยังไม่ได้บันทึกในหน้านี้อาจหายไป ตรวจสอบข้อมูลให้เรียบร้อยก่อนออกจากระบบ
                        </div>

                        {logoutError ? (
                            <div
                                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium leading-6 text-rose-700"
                                role="alert"
                            >
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>{logoutError}</span>
                            </div>
                        ) : null}
                    </div>

                    <DialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4 sm:px-7">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={closeLogoutDialog}
                            disabled={isLoggingOut}
                            className="h-11 rounded-lg border-slate-200 bg-white px-5 font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void confirmLogout()}
                            disabled={isLoggingOut}
                            className="h-11 rounded-lg bg-rose-600 px-6 font-semibold text-white hover:bg-rose-700 disabled:opacity-80"
                            aria-busy={isLoggingOut}
                        >
                            {isLoggingOut ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    กำลังออกจากระบบ
                                </>
                            ) : (
                                "ออกจากระบบ"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </header>
    );
}
