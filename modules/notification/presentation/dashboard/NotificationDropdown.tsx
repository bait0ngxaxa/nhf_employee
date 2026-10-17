"use client";

import type React from "react";
import { useRef, useState } from "react";
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
    toDashboardMenuPath,
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
} from "./NotificationShared";
import type {
    NotificationItem,
    NotificationsData,
} from "./NotificationShared";

function getNotificationButtonLabel(unreadCount: number): string {
    if (unreadCount <= 0) {
        return "เปิดการแจ้งเตือน";
    }

    return `เปิดการแจ้งเตือน มี ${unreadCount} รายการที่ยังไม่อ่าน`;
}

export interface NotificationDropdownProps {
    readonly canUpdateInbox: boolean;
}

export function NotificationDropdown({
    canUpdateInbox,
}: NotificationDropdownProps): React.ReactElement {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const pendingIdsRef = useRef<Set<string>>(new Set<string>());
    const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
        () => new Set<string>(),
    );
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

    const persistReadState = async (notificationId: string): Promise<void> => {
        const result = await apiPatch(
            API_ROUTES.notifications.read(notificationId),
        );
        if (!result.success) {
            throw new Error(result.errorThai);
        }

        await mutate((current) => {
            if (!current) return current;
            const wasUnread = current.notifications.some(
                (item) => item.id === notificationId && !item.isRead,
            );
            return {
                notifications: current.notifications.map((item) =>
                    item.id === notificationId ? { ...item, isRead: true } : item,
                ),
                unreadCount: wasUnread
                    ? Math.max(0, current.unreadCount - 1)
                    : current.unreadCount,
            };
        }, { revalidate: false });
        void mutate().catch(() => undefined);
    };

    const addPendingId = (notificationId: string): boolean => {
        if (pendingIdsRef.current.has(notificationId)) return false;
        pendingIdsRef.current.add(notificationId);
        setPendingIds(new Set(pendingIdsRef.current));
        return true;
    };

    const removePendingId = (notificationId: string): void => {
        if (!pendingIdsRef.current.delete(notificationId)) return;
        setPendingIds(new Set(pendingIdsRef.current));
    };

    const handleMarkAsRead = async (
        notification: NotificationItem,
    ): Promise<void> => {
        const normalizedActionUrl = normalizeNotificationActionUrl(
            notification.actionUrl,
        );

        if (normalizedActionUrl) {
            setOpen(false);
            router.push(normalizedActionUrl);

            if (canUpdateInbox && addPendingId(notification.id)) {
                void persistReadState(notification.id)
                    .catch(() => undefined)
                    .finally(() => removePendingId(notification.id));
            }
            return;
        }

        if (!canUpdateInbox || pendingIdsRef.current.size > 0 || isMarkingAll) {
            return;
        }

        if (!addPendingId(notification.id)) return;
        try {
            await persistReadState(notification.id);
        } catch {
            toast.error("อัปเดตการแจ้งเตือนไม่สำเร็จ", {
                description: "ลองเปิดรายการนี้อีกครั้ง หรือโหลดข้อมูลใหม่",
            });
        } finally {
            removePendingId(notification.id);
        }
    };

    const handleMarkAllAsRead = async (): Promise<void> => {
        if (!canUpdateInbox || isMarkingAll || unreadCount <= 0) {
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
                        "relative rounded-xl border border-border-subtle bg-surface text-content-secondary shadow-sm transition-colors",
                        "hover:border-border-subtle hover:bg-surface-subtle hover:text-content-heading",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                    aria-label={getNotificationButtonLabel(unreadCount)}
                >
                    <Bell className="h-5 w-5" aria-hidden="true" />
                    {unreadCount > 0 ? (
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-status-danger-solid px-1.5 text-xs font-bold leading-none text-content-on-brand ring-2 ring-surface">
                            {formatNotificationBadge(unreadCount)}
                        </span>
                    ) : null}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="w-[min(calc(100vw-1rem),24rem)] overflow-hidden rounded-xl border-border-subtle bg-surface-raised p-0 shadow-lg"
            >
                <div className="flex items-start justify-between gap-3 border-b border-border-subtle bg-surface-subtle px-5 py-4">
                    <div className="min-w-0">
                        <DropdownMenuLabel className="p-0 text-base font-semibold text-content-heading">
                            การแจ้งเตือน
                        </DropdownMenuLabel>
                        <p className="mt-1 text-sm text-content-secondary">
                            {unreadCount > 0
                                ? `${unreadCount} รายการที่ยังไม่อ่าน`
                                : "ไม่มีรายการค้างอ่าน"}
                        </p>
                    </div>
                    {canUpdateInbox ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleMarkAllAsRead()}
                            disabled={unreadCount <= 0 || isMarkingAll}
                            className="shrink-0 rounded-lg border-border-subtle bg-surface text-sm font-semibold text-content-body"
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
                    ) : null}
                </div>

                <div className="max-h-[min(26rem,calc(100dvh-12rem))] overflow-y-auto">
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
                                    isPending={pendingIds.has(notification.id)}
                                    isDisabled={canUpdateInbox
                                        && !normalizeNotificationActionUrl(notification.actionUrl)
                                        && (pendingIds.has(notification.id)
                                            || pendingIds.size > 0
                                            || isMarkingAll)}
                                    onOpen={handleMarkAsRead}
                                />
                            ))}
                        </DropdownMenuGroup>
                    )}
                </div>

                <div className="border-t border-border-subtle bg-surface-raised p-3">
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-11 w-full rounded-lg text-sm font-semibold text-content-body hover:bg-surface-subtle hover:text-content-heading"
                        onClick={() => {
                            setOpen(false);
                            router.push(
                                toDashboardMenuPath(
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
                "focus:bg-surface-subtle data-[disabled]:opacity-70",
                notification.isRead
                    ? "bg-surface-raised text-content-body"
                    : "border border-border-subtle bg-surface-subtle text-content-heading",
            )}
            onSelect={(event) => {
                event.preventDefault();
                void onOpen(notification);
            }}
        >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-raised">
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
                            className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-solid"
                            aria-label="ยังไม่อ่าน"
                        />
                    ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-content-secondary [overflow-wrap:anywhere]">
                    {notification.message}
                </p>
                <p className="mt-2 text-xs font-medium text-content-muted">
                    {getRelativeTime(notification.createdAt)}
                </p>
            </div>
        </DropdownMenuItem>
    );
}
