"use client";

import { useState } from "react";
import useSWR from "swr";
import {
    AlertCircle,
    Bell,
    Check,
    ExternalLink,
    Info,
    Loader2,
    MessageSquare,
    XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { getRelativeTime } from "@/lib/helpers/date-helpers";
import {
    API_ROUTES,
    APP_DASHBOARD_TABS,
    toDashboardTabPath,
} from "@/lib/ssot/routes";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    actionUrl: string | null;
    createdAt: string;
}

interface NotificationsData {
    notifications: Notification[];
    unreadCount: number;
}

function normalizeNotificationActionUrl(actionUrl: string | null): string | null {
    if (!actionUrl) {
        return null;
    }

    return actionUrl.replace("tab=it-equipment", "tab=stock");
}

const fetcher = async <T,>(url: string): Promise<T> => {
    const result = await apiGet<T>(url);
    if (!result.success) {
        throw new Error(result.error);
    }
    return result.data;
};

export function NotificationDropdown() {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const { data, error, isLoading, mutate } = useSWR<NotificationsData>(
        API_ROUTES.notifications.list,
        fetcher,
        {
            refreshInterval: 60_000,
            revalidateOnFocus: false,
            shouldRetryOnError: false,
            dedupingInterval: 30_000,
        },
    );
    const notifications = data?.notifications ?? [];
    const unreadCount = data?.unreadCount ?? 0;

    const handleMarkAsRead = async (
        id: string,
        actionUrl: string | null,
    ): Promise<void> => {
        try {
            await apiPatch(API_ROUTES.notifications.read(id));
            mutate();

            if (actionUrl) {
                const normalizedActionUrl =
                    normalizeNotificationActionUrl(actionUrl);
                setOpen(false);
                if (normalizedActionUrl) {
                    router.push(normalizedActionUrl);
                }
            }
        } catch (requestError) {
            console.error("Failed to mark notification as read", requestError);
            toast.error("เกิดข้อผิดพลาด", {
                description: "ไม่สามารถอัปเดตสถานะการอ่านได้",
            });
        }
    };

    const handleMarkAllAsRead = async (): Promise<void> => {
        try {
            await apiPost(API_ROUTES.notifications.markAllRead);
            mutate();
        } catch (requestError) {
            console.error("Failed to mark all as read", requestError);
            toast.error("เกิดข้อผิดพลาด", {
                description: "ไม่สามารถอัปเดตสถานะการอ่านได้",
            });
        }
    };

    const getIconPrefix = (type: string) => {
        switch (type) {
            case "TICKET_CREATED":
            case "TICKET_UPDATED":
                return <AlertCircle className="h-4 w-4 text-orange-500" />;
            case "STOCK_REQUEST_NEW":
                return <Bell className="h-4 w-4 text-amber-500" />;
            case "STOCK_ISSUED":
                return <Check className="h-4 w-4 text-emerald-500" />;
            case "STOCK_CANCELLED":
                return <XCircle className="h-4 w-4 text-rose-500" />;
            case "NEW_COMMENT":
                return <MessageSquare className="h-4 w-4 text-blue-500" />;
            case "SYSTEM_ALERT":
            default:
                return <Info className="h-4 w-4 text-gray-500" />;
        }
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-10 w-10 rounded-xl bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all duration-300 shadow-sm"
                >
                    <Bell className="h-5 w-5 text-slate-500" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-slate-900 text-white text-[9px] font-black leading-none shadow-lg shadow-slate-200">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-96 p-0 overflow-hidden shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] rounded-[2rem] border-slate-100 bg-white/95 backdrop-blur-xl"
            >
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 bg-slate-50/30">
                    <div className="space-y-0.5">
                        <DropdownMenuLabel className="p-0 text-lg font-black text-slate-900 tracking-tight">
                            Activity
                        </DropdownMenuLabel>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Notifications</p>
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                        >
                            <Check className="h-3 w-3 mr-1.5" />
                            Mark all read
                        </Button>
                    )}
                </div>

                <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col justify-center items-center py-12 text-slate-400 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-200" />
                            <span className="text-xs font-bold uppercase tracking-widest opacity-50">Loading Feed</span>
                        </div>
                    ) : error ? (
                        <div className="py-12 text-center text-xs font-bold text-rose-500 uppercase tracking-widest">
                            Connection Error
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-200">
                                <Bell className="h-8 w-8" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-black text-slate-900">All caught up</p>
                                <p className="text-xs font-medium text-slate-400">No new notifications for now</p>
                            </div>
                        </div>
                    ) : (
                        <DropdownMenuGroup className="p-2 space-y-1">
                            {notifications.map((notification) => (
                                <DropdownMenuItem
                                    key={notification.id}
                                    className={cn(
                                        "flex items-start gap-4 p-4 cursor-pointer rounded-2xl transition-all duration-300",
                                        notification.isRead
                                            ? "opacity-60 grayscale-[0.5] hover:bg-slate-50"
                                            : "bg-white border border-slate-50 hover:border-slate-100 hover:shadow-sm"
                                    )}
                                    onClick={() =>
                                        handleMarkAsRead(
                                            notification.id,
                                            notification.actionUrl,
                                        )
                                    }
                                >
                                    <div className={cn(
                                        "mt-1 shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm",
                                        notification.isRead ? "bg-slate-50 border-slate-100" : "bg-white border-slate-50"
                                    )}>
                                        {getIconPrefix(notification.type)}
                                    </div>
                                    <div className="flex flex-col gap-1 overflow-hidden w-full">
                                        <div className="flex justify-between items-start w-full">
                                            <span
                                                className={cn(
                                                    "text-sm tracking-tight truncate pr-4",
                                                    notification.isRead
                                                        ? "font-bold text-slate-600"
                                                        : "font-black text-slate-900"
                                                )}
                                            >
                                                {notification.title}
                                            </span>
                                            {!notification.isRead && (
                                                <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0 mt-2 shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed mb-1">
                                            {notification.message}
                                        </span>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                                {getRelativeTime(notification.createdAt)}
                                            </span>
                                            {!notification.isRead && (
                                                <span className="text-[8px] font-black uppercase tracking-widest text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">New</span>
                                            )}
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                    )}
                </div>

                <div className="p-4 bg-slate-50/50 border-t border-slate-50">
                    <Button
                        variant="ghost"
                        className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl h-10 transition-all"
                        onClick={() => {
                            setOpen(false);
                            router.push(toDashboardTabPath(APP_DASHBOARD_TABS.notifications));
                        }}
                    >
                        View Full History
                        <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
