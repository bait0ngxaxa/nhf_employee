"use client";

import type React from "react";
import { useState } from "react";
import useSWR from "swr";
import { Bell, Check, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cn } from "@/lib/ui/utils";
import { apiPatch, apiPost } from "@/lib/client/api-client";
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
import {
    formatNotificationBadge,
    NotificationEmptyState,
    NotificationErrorState,
    NotificationIcon,
    NotificationInlineLoading,
    NotificationLoadingState,
    normalizeNotificationActionUrl,
    notificationFetcher,
} from "@/components/dashboard/notifications/NotificationShared";
import type {
    NotificationItem,
    NotificationsData,
} from "@/components/dashboard/notifications/NotificationShared";

function getNotificationButtonLabel(unreadCount: number): string {
    if (unreadCount <= 0) {
        return "เปิดการแจ้งเตือน";
    }

    return `เปิดการแจ้งเตือน มี ${unreadCount} รายการที่ยังไม่อ่าน`;
}

export function NotificationDropdown(): React.ReactElement {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [isMarkingAll, setIsMarkingAll] = useState(false);

    const { data, error, isLoading, mutate } = useSWR<NotificationsData>(
        API_ROUTES.notifications.list,
        notificationFetcher,
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
        notification: NotificationItem,
    ): Promise<void> => {
        if (pendingId || isMarkingAll) {
            return;
        }

        setPendingId(notification.id);
        try {
            await apiPatch(API_ROUTES.notifications.read(notification.id));
            await mutate();

            const normalizedActionUrl = normalizeNotificationActionUrl(
                notification.actionUrl,
            );
            if (normalizedActionUrl) {
                setOpen(false);
                router.push(normalizedActionUrl);
            }
        } catch {
            toast.error("อัปเดตการแจ้งเตือนไม่สำเร็จ", {
                description: "ลองเปิดรายการนี้อีกครั้ง หรือโหลดข้อมูลใหม่",
            });
        } finally {
            setPendingId(null);
        }
    };

    const handleMarkAllAsRead = async (): Promise<void> => {
        if (isMarkingAll || unreadCount <= 0) {
            return;
        }

        setIsMarkingAll(true);
        try {
            await apiPost(API_ROUTES.notifications.markAllRead);
            await mutate();
        } catch {
            toast.error("อ่านทั้งหมดไม่สำเร็จ", {
                description: "ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง",
            });
        } finally {
            setIsMarkingAll(false);
        }
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "relative h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors",
                        "hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950",
                        "focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2",
                    )}
                    aria-label={getNotificationButtonLabel(unreadCount)}
                >
                    <Bell className="h-5 w-5" aria-hidden="true" />
                    {unreadCount > 0 ? (
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[0.6875rem] font-bold leading-none text-white ring-2 ring-white">
                            {formatNotificationBadge(unreadCount)}
                        </span>
                    ) : null}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="w-[min(calc(100vw-1rem),24rem)] overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-lg"
            >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="min-w-0">
                        <DropdownMenuLabel className="p-0 text-base font-semibold text-slate-950">
                            การแจ้งเตือน
                        </DropdownMenuLabel>
                        <p className="mt-1 text-sm text-slate-600">
                            {unreadCount > 0
                                ? `${unreadCount} รายการที่ยังไม่อ่าน`
                                : "ไม่มีรายการค้างอ่าน"}
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleMarkAllAsRead()}
                        disabled={unreadCount <= 0 || isMarkingAll}
                        className="h-9 shrink-0 rounded-lg border-slate-200 bg-white text-sm font-semibold text-slate-700"
                        aria-busy={isMarkingAll}
                    >
                        {isMarkingAll ? (
                            <NotificationInlineLoading label="กำลังอ่าน" />
                        ) : (
                            <>
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                อ่านทั้งหมด
                            </>
                        )}
                    </Button>
                </div>

                <div className="max-h-[min(26rem,calc(100vh-12rem))] overflow-y-auto">
                    {isLoading ? (
                        <NotificationLoadingState compact />
                    ) : error ? (
                        <NotificationErrorState
                            compact
                            onRetry={() => void mutate()}
                        />
                    ) : notifications.length === 0 ? (
                        <NotificationEmptyState compact />
                    ) : (
                        <DropdownMenuGroup className="space-y-1 p-2">
                            {notifications.map((notification) => (
                                <NotificationDropdownItem
                                    key={notification.id}
                                    notification={notification}
                                    isPending={pendingId === notification.id}
                                    isDisabled={Boolean(pendingId) || isMarkingAll}
                                    onOpen={handleMarkAsRead}
                                />
                            ))}
                        </DropdownMenuGroup>
                    )}
                </div>

                <div className="border-t border-slate-200 bg-white p-3">
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-10 w-full rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                        onClick={() => {
                            setOpen(false);
                            router.push(
                                toDashboardTabPath(
                                    APP_DASHBOARD_TABS.notifications,
                                ),
                            );
                        }}
                    >
                        ดูประวัติทั้งหมด
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function NotificationDropdownItem({
    notification,
    isPending,
    isDisabled,
    onOpen,
}: {
    notification: NotificationItem;
    isPending: boolean;
    isDisabled: boolean;
    onOpen: (notification: NotificationItem) => Promise<void>;
}): React.ReactElement {
    return (
        <DropdownMenuItem
            disabled={isDisabled}
            className={cn(
                "items-start gap-3 rounded-lg p-3 outline-none transition-colors",
                "focus:bg-slate-50 data-[disabled]:opacity-70",
                notification.isRead
                    ? "bg-white text-slate-700"
                    : "border border-slate-200 bg-slate-50 text-slate-950",
            )}
            onSelect={(event) => {
                event.preventDefault();
                void onOpen(notification);
            }}
        >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
                {isPending ? (
                    <NotificationInlineLoading label="" />
                ) : (
                    <NotificationIcon
                        type={notification.type}
                        className="h-4 w-4"
                    />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start gap-2">
                    <span
                        className={cn(
                            "min-w-0 flex-1 truncate text-sm leading-5",
                            notification.isRead ? "font-medium" : "font-semibold",
                        )}
                    >
                        {notification.title}
                    </span>
                    {!notification.isRead ? (
                        <span
                            className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-500"
                            aria-label="ยังไม่อ่าน"
                        />
                    ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                    {notification.message}
                </p>
                <p className="mt-2 text-xs font-medium text-slate-500">
                    {getRelativeTime(notification.createdAt)}
                </p>
            </div>
        </DropdownMenuItem>
    );
}
