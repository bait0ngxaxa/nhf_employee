"use client";

import type React from "react";
import { useCallback, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";

import { Button } from "@/components/ui/button";
import {
    NotificationFilterTabs,
    NotificationPageList,
    NotificationsHeader,
} from "@/components/dashboard/NotificationPageParts";
import {
    NotificationEmptyState,
    NotificationErrorState,
    NotificationInlineLoading,
    NotificationLoadingState,
    normalizeNotificationActionUrl,
    notificationFetcher,
} from "@/components/dashboard/NotificationShared";
import type {
    NotificationFilter,
    NotificationItem,
    NotificationsResponse,
} from "@/components/dashboard/NotificationShared";

function getApiUrl(filter: NotificationFilter): string {
    return `${API_ROUTES.notifications.all}?filter=${filter}`;
}

export function NotificationsSection(): React.ReactElement {
    const router = useRouter();
    const [filter, setFilter] = useState<NotificationFilter>("all");
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [isMarkingAll, setIsMarkingAll] = useState(false);

    const apiUrl = getApiUrl(filter);
    const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
        apiUrl,
        notificationFetcher,
        {
            revalidateOnFocus: false,
            shouldRetryOnError: false,
            onSuccess: (responseData) => {
                setItems(responseData.notifications);
                setCursor(responseData.nextCursor);
                setHasMore(responseData.hasMore);
            },
        },
    );
    const hasUnread = items.some((item) => !item.isRead);
    const totalCount = data?.totalCount ?? 0;

    const loadMore = useCallback(async (): Promise<void> => {
        if (!cursor || isLoadingMore) {
            return;
        }

        setIsLoadingMore(true);
        try {
            const result = await apiGet<NotificationsResponse>(
                `${apiUrl}&cursor=${encodeURIComponent(cursor)}`,
            );
            if (!result.success) {
                throw new Error(result.error);
            }

            setItems((current) => [...current, ...result.data.notifications]);
            setCursor(result.data.nextCursor);
            setHasMore(result.data.hasMore);
        } catch {
            toast.error("โหลดข้อมูลเพิ่มเติมไม่สำเร็จ", {
                description: "ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง",
            });
        } finally {
            setIsLoadingMore(false);
        }
    }, [apiUrl, cursor, isLoadingMore]);

    const handleMarkAsRead = async (
        notification: NotificationItem,
    ): Promise<void> => {
        if (pendingId || isMarkingAll) {
            return;
        }

        setPendingId(notification.id);
        try {
            await apiPatch(API_ROUTES.notifications.read(notification.id));
            setItems((current) =>
                current.map((item) =>
                    item.id === notification.id ? { ...item, isRead: true } : item,
                ),
            );
            await mutate();

            const targetUrl = normalizeNotificationActionUrl(
                notification.actionUrl,
            );
            if (targetUrl) {
                router.push(targetUrl);
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
        if (isMarkingAll || !hasUnread) {
            return;
        }

        setIsMarkingAll(true);
        try {
            await apiPost(API_ROUTES.notifications.markAllRead);
            setItems((current) =>
                current.map((item) => ({ ...item, isRead: true })),
            );
            await mutate();
        } catch {
            toast.error("อ่านทั้งหมดไม่สำเร็จ", {
                description: "ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง",
            });
        } finally {
            setIsMarkingAll(false);
        }
    };

    const handleFilterChange = (nextFilter: NotificationFilter): void => {
        setFilter(nextFilter);
        setItems([]);
        setCursor(null);
        setHasMore(false);
        setPendingId(null);
    };

    return (
        <section className="min-h-[calc(100vh-6rem)] bg-slate-50 px-4 py-6 md:px-8">
            <div className="mx-auto max-w-5xl space-y-6">
                <NotificationsHeader
                    filter={filter}
                    totalCount={totalCount}
                    hasUnread={hasUnread}
                    isMarkingAll={isMarkingAll}
                    onMarkAll={() => void handleMarkAllAsRead()}
                />
                <NotificationFilterTabs
                    filter={filter}
                    onChange={handleFilterChange}
                />
                <div className="space-y-3">
                    {isLoading ? (
                        <NotificationLoadingState />
                    ) : error ? (
                        <NotificationErrorState onRetry={() => void mutate()} />
                    ) : items.length === 0 ? (
                        <NotificationEmptyState filter={filter} />
                    ) : (
                        <NotificationPageList
                            items={items}
                            pendingId={pendingId}
                            isDisabled={Boolean(pendingId) || isMarkingAll}
                            onOpen={handleMarkAsRead}
                        />
                    )}
                    {hasMore ? (
                        <div className="flex max-w-3xl justify-center pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void loadMore()}
                                disabled={isLoadingMore}
                                className="h-10 rounded-lg border-slate-200 bg-white text-sm font-semibold text-slate-700"
                                aria-busy={isLoadingMore}
                            >
                                {isLoadingMore ? (
                                    <NotificationInlineLoading label="กำลังโหลด" />
                                ) : (
                                    "โหลดเพิ่มเติม"
                                )}
                            </Button>
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
