"use client";

import type React from "react";
import {
    AlertCircle,
    Bell,
    Check,
    Info,
    Loader2,
    MessageSquare,
    RefreshCcw,
    XCircle,
} from "lucide-react";

import { cn } from "@/lib/ui/utils";
import { apiGet } from "@/lib/client/api-client";

import { Button } from "@/components/ui/button";

export interface NotificationItem {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    actionUrl: string | null;
    createdAt: string;
}

export interface NotificationsData {
    notifications: NotificationItem[];
    unreadCount: number;
}

export interface NotificationsResponse {
    notifications: NotificationItem[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
}

export type NotificationFilter = "all" | "unread";

export function normalizeNotificationActionUrl(
    actionUrl: string | null,
): string | null {
    if (!actionUrl) {
        return null;
    }

    return actionUrl.replace("tab=it-equipment", "tab=stock");
}

export function formatNotificationBadge(count: number): string {
    if (count > 99) {
        return "99+";
    }

    return String(count);
}

export const notificationFetcher = async <T,>(url: string): Promise<T> => {
    const result = await apiGet<T>(url);
    if (!result.success) {
        throw new Error(result.error);
    }

    return result.data;
};

export function NotificationIcon({
    type,
    className,
}: {
    type: string;
    className?: string;
}): React.ReactElement {
    switch (type) {
        case "TICKET_CREATED":
        case "TICKET_UPDATED":
            return <AlertCircle className={cn("text-orange-500", className)} />;
        case "STOCK_REQUEST_NEW":
            return <Bell className={cn("text-amber-500", className)} />;
        case "STOCK_ISSUED":
            return <Check className={cn("text-emerald-500", className)} />;
        case "STOCK_CANCELLED":
            return <XCircle className={cn("text-rose-500", className)} />;
        case "NEW_COMMENT":
            return <MessageSquare className={cn("text-sky-500", className)} />;
        case "SYSTEM_ALERT":
        default:
            return <Info className={cn("text-slate-500", className)} />;
    }
}

export function NotificationLoadingState({
    compact = false,
}: {
    compact?: boolean;
}): React.ReactElement {
    const rows = compact ? 3 : 5;

    return (
        <div className={cn("space-y-2", compact ? "p-3" : "max-w-3xl")}>
            {Array.from({ length: rows }).map((_, index) => (
                <div
                    key={index}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                    <div className="min-w-0 flex-1 space-y-2 pt-1">
                        <div className="h-3 w-2/5 animate-pulse rounded-full bg-slate-100" />
                        <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
                        <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function NotificationEmptyState({
    filter = "all",
    compact = false,
}: {
    filter?: NotificationFilter;
    compact?: boolean;
}): React.ReactElement {
    const title =
        filter === "unread" ? "อ่านครบแล้ว" : "ยังไม่มีการแจ้งเตือน";
    const description =
        filter === "unread"
            ? "ไม่มีรายการที่ต้องจัดการในตอนนี้"
            : "เมื่อมีรายการใหม่ ระบบจะแสดงไว้ตรงนี้";

    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center",
                compact ? "px-6 py-12" : "max-w-3xl rounded-xl border border-slate-200 bg-white px-6 py-14",
            )}
        >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                <Bell className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-950">{title}</p>
            <p className="mt-1 max-w-sm text-sm leading-6 text-slate-600">
                {description}
            </p>
        </div>
    );
}

export function NotificationErrorState({
    onRetry,
    compact = false,
}: {
    onRetry: () => void;
    compact?: boolean;
}): React.ReactElement {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center",
                compact ? "px-6 py-10" : "max-w-3xl rounded-xl border border-rose-200 bg-rose-50 px-6 py-10",
            )}
            role="alert"
        >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-950">
                โหลดการแจ้งเตือนไม่สำเร็จ
            </p>
            <p className="mt-1 max-w-sm text-sm leading-6 text-slate-700">
                ตรวจสอบการเชื่อมต่อ แล้วลองโหลดข้อมูลอีกครั้ง
            </p>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="mt-4 h-9 rounded-lg border-slate-200 bg-white text-sm font-semibold text-slate-700"
            >
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
                โหลดใหม่
            </Button>
        </div>
    );
}

export function NotificationInlineLoading({
    label,
}: {
    label: string;
}): React.ReactElement {
    return (
        <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {label}
        </>
    );
}
