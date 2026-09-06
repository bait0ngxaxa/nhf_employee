"use client";

import type React from "react";
import {
    Bell,
    CalendarClock,
    Check,
    ClipboardCheck,
    Info,
    Loader2,
    RefreshCcw,
    XCircle,
} from "lucide-react";

import { cn } from "@/lib/ui/utils";
import { apiGet } from "@/lib/client/api-client";
import { isDashboardTabEnabled } from "@/lib/ssot/features";
import { toDashboardMenuPath } from "@/lib/ssot/routes";

import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/ui/state";

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

    const normalizedUrl = actionUrl.replace("tab=it-equipment", "tab=stock");
    try {
        const parsedUrl = new URL(normalizedUrl, "http://localhost");
        const tab = parsedUrl.searchParams.get("tab");
        if (tab && !isDashboardTabEnabled(tab)) {
            return toDashboardMenuPath("dashboard");
        }
    } catch {
        return normalizedUrl;
    }

    return normalizedUrl;
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
        case "STOCK_REQUEST_NEW":
            return <Bell className={cn("text-notification-stock-request-icon", className)} />;
        case "ROUTINE_REMINDER":
            return <ClipboardCheck className={cn("text-notification-routine-icon", className)} />;
        case "ROUTINE_CONTRACT_EXPIRY":
            return <CalendarClock className={cn("text-notification-contract-expiry-icon", className)} />;
        case "STOCK_ISSUED":
        case "LEAVE_APPROVED":
        case "LEAVE_NOT_TAKEN_CONFIRMED":
        case "LEAVE_CANCELLED_AFTER_APPROVAL":
            return <Check className={cn("text-notification-success-icon", className)} />;
        case "STOCK_CANCELLED":
        case "LEAVE_REJECTED":
        case "LEAVE_CANCELLED":
            return <XCircle className={cn("text-notification-cancelled-icon", className)} />;
        case "LEAVE_REQUESTED":
        case "LEAVE_NOT_TAKEN_REQUESTED":
        case "LEAVE_CANCELLATION_REQUESTED":
            return <Bell className={cn("text-notification-leave-request-icon", className)} />;
        case "SYSTEM_ALERT":
        default:
            return <Info className={cn("text-content-muted", className)} />;
    }
}

export function NotificationLoadingState({
    compact = false,
}: {
    compact?: boolean;
}): React.ReactElement {
    const rows = compact ? 3 : 5;

    return (
        <LoadingState
            label="กำลังโหลดการแจ้งเตือน"
            className={cn("space-y-2", compact ? "p-3" : "max-w-3xl")}
        >
            {Array.from({ length: rows }).map((_, index) => (
                <div
                    key={index}
                    className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4"
                >
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-surface-muted" />
                    <div className="min-w-0 flex-1 space-y-2 pt-1">
                        <div className="h-3 w-2/5 animate-pulse rounded-full bg-surface-muted" />
                        <div className="h-3 w-full animate-pulse rounded-full bg-surface-muted" />
                        <div className="h-3 w-1/3 animate-pulse rounded-full bg-surface-muted" />
                    </div>
                </div>
            ))}
        </LoadingState>
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
        <EmptyState
            title={title}
            description={description}
            icon={<Bell className="h-6 w-6" aria-hidden="true" />}
            compact={compact}
            className={compact ? "border-transparent bg-transparent" : undefined}
        />
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
        <ErrorState
            title="โหลดการแจ้งเตือนไม่สำเร็จ"
            description="ตรวจสอบการเชื่อมต่อ แล้วลองโหลดข้อมูลอีกครั้ง"
            action={{
                label: "ลองใหม่",
                onClick: onRetry,
                icon: <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />,
            }}
            compact={compact}
            className={compact ? "border-transparent bg-transparent" : undefined}
        />
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
