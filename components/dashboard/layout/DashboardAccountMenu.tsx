"use client";

import { cn } from "@/lib/ui/utils";
import { Button } from "@/components/ui/button";
import {
    AlertCircle,
    ChevronDown,
    Loader2,
    LogOut,
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
import { useState, type ReactElement } from "react";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import {
    NO_TEAM_PRESENTATION,
    formatTeamSummary,
} from "@/shared/identity/team-presentation";

export function DashboardAccountMenu(): ReactElement {
    const { handleSignOut, handleMenuClick } = useDashboardUIContext();
    const { user } = useDashboardDataContext();
    const teamSummary = formatTeamSummary(user?.teams);
    const teamNames = user?.teams
        ?.map((team) => team.name.trim())
        .filter(Boolean) ?? [];
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
        <>
                {/* Right: User menu */}
                <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                    {/* User Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "h-12 gap-3 px-1 pr-4 rounded-[1.25rem] transition-colors",
                                    "border border-border-muted bg-surface hover:border-brand-border",
                                    "hidden sm:flex group",
                                )}
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-solid">
                                    <User className="h-5 w-5 text-content-on-brand" />
                                </div>
                                <div className="flex flex-col items-start text-left">
                                    <span className="text-sm font-semibold text-content-primary">
                                        {user?.name || "ผู้ใช้"}
                                    </span>
                                    <span className="text-xs font-medium leading-5 text-content-secondary">
                                        {teamSummary}
                                    </span>
                                </div>
                                <ChevronDown className="h-3 w-3 text-content-subtle transition-colors group-hover:text-brand-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="w-64 rounded-2xl border-border-muted bg-surface-raised p-2 shadow-lg"
                        >
                            <div className="mb-2 border-b border-border-subtle px-3 pb-3 pt-2">
                                <p className="text-sm font-semibold leading-5 text-content-primary">
                                    {user?.name}
                                </p>
                                <p className="mt-1 truncate text-xs text-content-secondary">
                                    {user?.email}
                                </p>
                                <dl className="mt-3 space-y-2 text-xs">
                                    <div>
                                        <dt className="text-content-muted">หน่วยงาน</dt>
                                        <dd className="mt-0.5 text-content-body">{user?.department || "ไม่ระบุหน่วยงาน"}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-content-muted">ทีม</dt>
                                        <dd className="mt-0.5 text-content-body">
                                            {teamNames.length > 0 ? teamNames.join(" · ") : NO_TEAM_PRESENTATION}
                                        </dd>
                                    </div>
                                </dl>
                            </div>

                            <DropdownMenuItem
                                onClick={() => handleMenuClick("sessions")}
                                className="h-11 cursor-pointer rounded-xl focus:bg-brand-surface group"
                            >
                                <Smartphone className="mr-3 h-4 w-4 text-content-subtle transition-colors group-hover:text-brand-foreground" />
                                <span className="text-sm font-bold text-content-secondary group-hover:text-brand-strong">
                                    จัดการเซสชัน
                                </span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-surface-subtle" />
                            <ThemeSelector />
                            <DropdownMenuSeparator className="my-1 bg-surface-subtle" />
                            <DropdownMenuItem
                                onClick={openLogoutDialog}
                                className="h-11 cursor-pointer rounded-xl text-status-danger-foreground focus:bg-status-danger-surface focus:text-status-danger-foreground"
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
                                className="rounded-2xl border border-border-muted bg-surface sm:hidden"
                                aria-label="เมนูผู้ใช้"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-solid">
                                    <User className="h-4 w-4 text-content-on-brand" />
                                </div>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="w-56 rounded-2xl border-border-muted p-2"
                        >
                            <div className="border-b border-border-subtle px-3 pb-3 pt-2">
                                <p className="truncate text-sm font-semibold text-content-primary">{user?.name || "ผู้ใช้"}</p>
                                <p className="mt-1 truncate text-xs text-content-secondary">{user?.email || "ไม่ระบุอีเมล"}</p>
                                <p className="mt-2 text-xs text-content-secondary">{teamSummary}</p>
                            </div>
                            <DropdownMenuItem
                                onClick={() => handleMenuClick("sessions")}
                                className="h-11 rounded-xl focus:bg-brand-surface"
                            >
                                <Smartphone className="mr-3 h-4 w-4 text-content-subtle" />
                                <span className="text-sm font-bold text-content-secondary">
                                    จัดการเซสชัน
                                </span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-surface-subtle" />
                            <ThemeSelector />
                            <DropdownMenuSeparator className="my-1 bg-surface-subtle" />
                            <DropdownMenuItem
                                onClick={openLogoutDialog}
                                className="h-11 rounded-xl text-status-danger-foreground"
                            >
                                <LogOut className="h-4 w-4 mr-3" />
                                <span className="text-sm font-bold">
                                    ออกจากระบบ
                                </span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            <Dialog open={showLogoutDialog} onOpenChange={(open) => {
                if (!open) {
                    closeLogoutDialog();
                    return;
                }
                setShowLogoutDialog(true);
            }}>
                <DialogContent
                    scrollMode="content"
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
                    className="rounded-2xl border border-border-subtle p-0 shadow-xl sm:max-w-[26rem]"
                >
                    <div className="space-y-5 bg-surface-raised px-6 pb-5 pt-6 sm:px-7">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-status-danger-border bg-status-danger-surface text-status-danger-foreground">
                                <LogOut className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <DialogHeader className="min-w-0 flex-1 text-left">
                                <DialogTitle className="text-lg font-semibold leading-7 text-content-heading [overflow-wrap:anywhere]">
                                    ออกจากระบบบัญชีนี้?
                                </DialogTitle>
                                <DialogDescription className="text-sm font-medium leading-6 text-content-secondary [overflow-wrap:anywhere]">
                                    ระบบจะสิ้นสุดเซสชันบนอุปกรณ์นี้ และพาคุณกลับไปหน้าเข้าสู่ระบบ
                                </DialogDescription>
                            </DialogHeader>
                        </div>

                        <div className="rounded-xl border border-border-subtle bg-surface-subtle px-4 py-3 text-sm leading-6 text-content-body">
                            งานที่ยังไม่ได้บันทึกในหน้านี้อาจหายไป ตรวจสอบข้อมูลให้เรียบร้อยก่อนออกจากระบบ
                        </div>

                        {logoutError ? (
                            <div
                                className="flex items-start gap-2 rounded-xl border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm font-medium leading-6 text-status-danger-strong"
                                role="alert"
                            >
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>{logoutError}</span>
                            </div>
                        ) : null}
                    </div>

                    <DialogFooter className="border-t border-border-subtle bg-surface-subtle px-6 py-4 sm:px-7">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={closeLogoutDialog}
                            disabled={isLoggingOut}
                            className="h-11 rounded-lg border-border-subtle bg-surface px-5 font-semibold text-content-body hover:bg-surface-muted hover:text-content-primary"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void confirmLogout()}
                            disabled={isLoggingOut}
                            className="h-11 rounded-lg bg-status-danger-solid px-6 font-semibold text-content-on-brand hover:bg-status-danger-solid-hover disabled:opacity-80"
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
        </>
    );
}
