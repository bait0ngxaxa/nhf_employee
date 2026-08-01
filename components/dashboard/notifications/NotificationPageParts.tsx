"use client";

import type React from "react";
import { Bell, Check, Filter, Loader2 } from "lucide-react";

import { cn } from "@/lib/ui/utils";
import { getRelativeTime } from "@/lib/helpers/date-helpers";

import { Button } from "@/components/ui/button";
import {
    NotificationIcon,
    NotificationInlineLoading,
} from "@/components/dashboard/notifications/NotificationShared";
import type {
    NotificationFilter,
    NotificationItem,
} from "@/components/dashboard/notifications/NotificationShared";

export function NotificationsHeader({
    filter,
    totalCount,
    hasUnread,
    isMarkingAll,
    onMarkAll,
}: {
    filter: NotificationFilter;
    totalCount: number;
    hasUnread: boolean;
    isMarkingAll: boolean;
    onMarkAll: () => void;
}): React.ReactElement {
    const countLabel = filter === "unread"
        ? `${totalCount} รายการที่ยังไม่อ่าน`
        : `ทั้งหมด ${totalCount} รายการ`;

    return (
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-surface-strong text-brand-foreground">
                    <Bell className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <h1
                        data-page-heading
                        tabIndex={-1}
                        className="text-2xl font-bold tracking-tight text-content-heading"
                    >
                        การแจ้งเตือน
                    </h1>
                    <p className="mt-0.5 text-sm text-content-secondary">{countLabel}</p>
                </div>
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onMarkAll}
                disabled={!hasUnread || isMarkingAll}
                className="border-border-subtle bg-surface text-sm font-semibold text-content-body hover:bg-surface-subtle"
                aria-busy={isMarkingAll}
            >
                {isMarkingAll ? (
                    <NotificationInlineLoading label="กำลังอัปเดต" />
                ) : (
                    <>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        อ่านทั้งหมด
                    </>
                )}
            </Button>
        </header>
    );
}

export function NotificationFilterTabs({
    filter,
    onChange,
}: {
    filter: NotificationFilter;
    onChange: (filter: NotificationFilter) => void;
}): React.ReactElement {
    return (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-medium text-content-secondary">
                <Filter className="h-4 w-4" aria-hidden="true" />
                แสดง
            </span>
            <div className="inline-flex rounded-lg bg-surface-muted p-1">
                <FilterButton
                    isActive={filter === "all"}
                    label="ทั้งหมด"
                    onClick={() => onChange("all")}
                />
                <FilterButton
                    isActive={filter === "unread"}
                    label="ยังไม่อ่าน"
                    onClick={() => onChange("unread")}
                />
            </div>
        </div>
    );
}

function FilterButton({
    isActive,
    label,
    onClick,
}: {
    isActive: boolean;
    label: string;
    onClick: () => void;
}): React.ReactElement {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            className={cn(
                "min-h-11 rounded-md px-3 text-sm font-semibold text-content-secondary",
                isActive && "bg-surface text-content-heading shadow-sm hover:bg-surface",
            )}
            aria-pressed={isActive}
        >
            {label}
        </Button>
    );
}

export function NotificationPageList({
    items,
    pendingId,
    isDisabled,
    onOpen,
}: {
    items: NotificationItem[];
    pendingId: string | null;
    isDisabled: boolean;
    onOpen: (notification: NotificationItem) => Promise<void>;
}): React.ReactElement {
    return (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <div className="border-b border-border-subtle px-5 py-3 text-sm font-semibold text-content-body">
                กล่องข้อความ
            </div>
            <div className="divide-y divide-border-muted">
                {items.map((notification) => (
                    <NotificationPageRow
                        key={notification.id}
                        notification={notification}
                        isPending={pendingId === notification.id}
                        isDisabled={isDisabled}
                        onOpen={onOpen}
                    />
                ))}
            </div>
        </div>
    );
}

function NotificationPageRow({
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
        <button
            type="button"
            disabled={isDisabled}
            onClick={() => void onOpen(notification)}
            className={cn(
                "flex w-full items-start gap-4 px-5 py-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                "disabled:cursor-wait disabled:opacity-75",
                notification.isRead ? "hover:bg-surface-subtle" : "bg-brand-surface/50 hover:bg-brand-surface",
            )}
        >
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-content-muted" aria-hidden="true" />
                ) : (
                    <NotificationIcon type={notification.type} className="h-5 w-5" />
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-start gap-3">
                    <span className="min-w-0 flex-1 text-sm leading-6">
                        <span className={cn(
                            "block line-clamp-2",
                            notification.isRead ? "font-medium text-content-strong" : "font-semibold text-content-heading",
                        )}>
                            {notification.title}
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-sm leading-6 text-content-secondary [overflow-wrap:anywhere]">
                            {notification.message}
                        </span>
                    </span>
                    {!notification.isRead ? (
                        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-foreground" aria-label="ยังไม่อ่าน" />
                    ) : null}
                </span>
                <span className="mt-2 block text-xs font-medium text-content-muted">
                    {getRelativeTime(notification.createdAt)}
                </span>
            </span>
        </button>
    );
}
