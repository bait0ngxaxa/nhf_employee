"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
    Bell,
    Check,
    Loader2,
    AlertCircle,
    Info,
    MessageSquare,
    Filter,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { getRelativeTime } from "@/lib/helpers/date-helpers";
import { API_ROUTES } from "@/lib/ssot/routes";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    actionUrl: string | null;
    createdAt: string;
}

interface NotificationsResponse {
    notifications: Notification[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
}

type FilterType = "all" | "unread";

const fetcher = async <T,>(url: string): Promise<T> => {
    const result = await apiGet<T>(url);
    if (!result.success) throw new Error(result.error);
    return result.data;
};



function getNotificationIcon(type: string) {
    switch (type) {
        case "TICKET_CREATED":
        case "TICKET_UPDATED":
            return <AlertCircle className="h-5 w-5 text-orange-500" />;
        case "STOCK_REQUEST_NEW":
            return <Bell className="h-5 w-5 text-amber-500" />;
        case "STOCK_ISSUED":
            return <Check className="h-5 w-5 text-emerald-500" />;
        case "STOCK_CANCELLED":
            return <XCircle className="h-5 w-5 text-rose-500" />;
        case "NEW_COMMENT":
            return <MessageSquare className="h-5 w-5 text-blue-500" />;
        case "SYSTEM_ALERT":
        default:
            return <Info className="h-5 w-5 text-gray-500" />;
    }
}

export function NotificationsSection() {
    const router = useRouter();
    const [filter, setFilter] = useState<FilterType>("all");
    const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const apiUrl = `${API_ROUTES.notifications.all}?filter=${filter}`;

    const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
        apiUrl,
        fetcher,
        {
            revalidateOnFocus: false,
            shouldRetryOnError: false,
            onSuccess: (responseData) => {
                setAllNotifications(responseData.notifications);
                setCursor(responseData.nextCursor);
                setHasMore(responseData.hasMore);
            },
        },
    );

    const loadMore = useCallback(async () => {
        if (!cursor || isLoadingMore) return;
        setIsLoadingMore(true);

        try {
            const result = await apiGet<NotificationsResponse>(
                `${apiUrl}&cursor=${encodeURIComponent(cursor)}`,
            );
            if (!result.success) throw new Error(result.error);
            const moreData = result.data;

            setAllNotifications((prev) => [...prev, ...moreData.notifications]);
            setCursor(moreData.nextCursor);
            setHasMore(moreData.hasMore);
        } catch (err) {
            console.error("Failed to load more notifications:", err);
            toast.error("เกิดข้อผิดพลาด", { description: "ไม่สามารถโหลดข้อมูลเพิ่มเติมได้" });
        } finally {
            setIsLoadingMore(false);
        }
    }, [cursor, isLoadingMore, apiUrl]);

    const handleMarkAsRead = async (
        id: string,
        actionUrl: string | null,
    ) => {
        try {
            await apiPatch(API_ROUTES.notifications.read(id));
            setAllNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
            );
            mutate();
            if (actionUrl) router.push(actionUrl);
        } catch (err) {
            console.error("Failed to mark as read:", err);
            toast.error("เกิดข้อผิดพลาด", { description: "ไม่สามารถอัปเดตสถานะการอ่านได้" });
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await apiPost(API_ROUTES.notifications.markAllRead);
            setAllNotifications((prev) =>
                prev.map((n) => ({ ...n, isRead: true })),
            );
            mutate();
        } catch (err) {
            console.error("Failed to mark all as read:", err);
            toast.error("เกิดข้อผิดพลาด", { description: "ไม่สามารถอัปเดตสถานะการอ่านได้" });
        }
    };

    const handleFilterChange = (newFilter: FilterType) => {
        setFilter(newFilter);
        setAllNotifications([]);
        setCursor(null);
    };

    const unreadCount = data?.totalCount ?? 0;

    return (
        <div className="relative min-h-[calc(100vh-6rem)] bg-slate-50/50 rounded-3xl overflow-hidden border border-white/60 shadow-inner">
            {/* Background Aesthetic Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(219,234,254,0.6)_0%,transparent_70%)] -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(224,231,255,0.6)_0%,transparent_70%)] translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="relative z-10 p-4 md:p-8 space-y-8">
                {/* Header */}
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2
                                className={cn(
                                    "text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br pb-1",
                                    "from-gray-900 via-gray-800 to-gray-600",
                                )}
                            >
                                การแจ้งเตือน
                            </h2>
                            <p className="text-gray-500 font-medium">
                                {filter === "unread"
                                    ? `${unreadCount} รายการที่ยังไม่อ่าน`
                                    : `ทั้งหมด ${unreadCount} รายการ`}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            className="text-xs gap-1.5 rounded-xl"
                        >
                            <Check className="h-3.5 w-3.5" />
                            อ่านทั้งหมด
                        </Button>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out delay-100">
                    <Button
                        variant={filter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleFilterChange("all")}
                        className="text-xs gap-1.5 rounded-xl"
                    >
                        <Filter className="h-3.5 w-3.5" />
                        ทั้งหมด
                    </Button>
                    <Button
                        variant={filter === "unread" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleFilterChange("unread")}
                        className="text-xs gap-1.5 rounded-xl"
                    >
                        <Bell className="h-3.5 w-3.5" />
                        ยังไม่อ่าน
                    </Button>
                </div>

                {/* Notification List */}
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out delay-150">
                    {isLoading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : error ? (
                        <Card className="rounded-2xl">
                            <CardContent className="p-6 text-center text-red-500">
                                โหลดข้อมูลล้มเหลว
                            </CardContent>
                        </Card>
                    ) : allNotifications.length === 0 ? (
                        <Card className="rounded-2xl">
                            <CardContent className="p-12 text-center text-gray-500 flex flex-col items-center">
                                <Bell className="h-12 w-12 text-gray-300 mb-3" />
                                <p className="text-sm font-medium">
                                    ไม่มีการแจ้งเตือน
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="max-w-3xl space-y-2">
                            {allNotifications.map((notification) => (
                                <Card
                                    key={notification.id}
                                    className={cn(
                                        "rounded-2xl cursor-pointer transition-[box-shadow,border-color,opacity] duration-200 hover:shadow-md",
                                        notification.isRead
                                            ? "bg-white/70 border-gray-100 opacity-75"
                                            : "bg-white border-blue-100 shadow-sm",
                                    )}
                                    onClick={() =>
                                        handleMarkAsRead(
                                            notification.id,
                                            notification.actionUrl,
                                        )
                                    }
                                >
                                    <CardContent className="p-4 flex items-start gap-3">
                                        <div className="mt-0.5 shrink-0 bg-gray-50 p-2 rounded-xl border border-gray-100">
                                            {getNotificationIcon(
                                                notification.type,
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1 overflow-hidden flex-1">
                                            <div className="flex justify-between items-start">
                                                <span
                                                    className={cn(
                                                        "text-sm font-semibold truncate pr-2",
                                                        notification.isRead
                                                            ? "text-gray-600"
                                                            : "text-gray-900",
                                                    )}
                                                >
                                                    {notification.title}
                                                </span>
                                                {!notification.isRead && (
                                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1" />
                                                )}
                                            </div>
                                            <span className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                                {notification.message}
                                            </span>
                                            <span className="text-[11px] text-gray-400 font-medium">
                                                {getRelativeTime(
                                                    notification.createdAt,
                                                )}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {/* Load More */}
                            {hasMore && (
                                <div className="flex justify-center pt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={loadMore}
                                        disabled={isLoadingMore}
                                        className="text-xs gap-1.5 rounded-xl"
                                    >
                                        {isLoadingMore && (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        )}
                                        {isLoadingMore
                                            ? "กำลังโหลด..."
                                            : "โหลดเพิ่มเติม"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
