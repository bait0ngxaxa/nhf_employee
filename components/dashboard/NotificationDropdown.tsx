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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
    DropdownMenuSeparator,
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

    const handleMarkAsRead = async (id: string, actionUrl: string | null): Promise<void> => {
        try {
            await apiPatch(API_ROUTES.notifications.read(id));
            mutate();

            if (actionUrl) {
                setOpen(false);
                router.push(actionUrl);
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
                    className="relative h-9 w-9 text-gray-600 hover:text-gray-900"
                >
                    <Bell className="h-5 w-5" />
                    {data && data.unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                            {data.unreadCount > 9 ? "9+" : data.unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-80 p-0 overflow-hidden shadow-2xl rounded-2xl border-gray-100"
            >
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 border-b border-gray-100">
                    <DropdownMenuLabel className="p-0 font-bold text-gray-900">
                        แจ้งเตือน
                    </DropdownMenuLabel>
                    {data && data.unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                            <Check className="h-3 w-3 mr-1" />
                            อ่านทั้งหมด
                        </Button>
                    )}
                </div>

                <div className="max-h-[350px] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center items-center py-8 text-gray-400">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="py-8 text-center text-sm text-red-500">โหลดข้อมูลล้มเหลว</div>
                    ) : data?.notifications.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-500 flex flex-col items-center">
                            <Bell className="h-8 w-8 text-gray-300 mb-2" />
                            ไม่มีการแจ้งเตือนใหม่
                        </div>
                    ) : (
                        <DropdownMenuGroup className="p-1">
                            {data?.notifications.map((notification) => (
                                <DropdownMenuItem
                                    key={notification.id}
                                    className={`flex items-start gap-3 p-3 cursor-pointer rounded-xl transition-colors ${
                                        notification.isRead
                                            ? "bg-transparent opacity-70"
                                            : "bg-blue-50/50"
                                    }`}
                                    onClick={() =>
                                        handleMarkAsRead(notification.id, notification.actionUrl)
                                    }
                                >
                                    <div className="mt-1 shrink-0 bg-white p-1.5 rounded-full shadow-sm border border-gray-100">
                                        {getIconPrefix(notification.type)}
                                    </div>
                                    <div className="flex flex-col gap-1 overflow-hidden w-full">
                                        <div className="flex justify-between items-start w-full">
                                            <span
                                                className={`text-sm font-semibold truncate pr-2 ${
                                                    notification.isRead
                                                        ? "text-gray-700"
                                                        : "text-gray-900"
                                                }`}
                                            >
                                                {notification.title}
                                            </span>
                                            {!notification.isRead && (
                                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                                            {notification.message}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-medium">
                                            {getRelativeTime(notification.createdAt)}
                                        </span>
                                    </div>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                    )}
                </div>

                <DropdownMenuSeparator className="m-0 border-gray-100" />
                <div className="p-2 bg-gray-50/50">
                    <Button
                        variant="ghost"
                        className="w-full text-xs text-gray-500 justify-center h-8 hover:bg-gray-100 rounded-lg gap-1"
                        onClick={() => {
                            setOpen(false);
                            router.push(toDashboardTabPath(APP_DASHBOARD_TABS.notifications));
                        }}
                    >
                        <ExternalLink className="h-3 w-3" />
                        ดูการแจ้งเตือนทั้งหมด
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
