"use client";

import type React from "react";
import { Bell, Check, Filter, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { getRelativeTime } from "@/lib/helpers/date-helpers";

import { Button } from "@/components/ui/button";
import {
    NotificationIcon,
    NotificationInlineLoading,
} from "@/components/dashboard/NotificationShared";
import type {
    NotificationFilter,
    NotificationItem,
} from "@/components/dashboard/NotificationShared";

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
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Bell className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                        การแจ้งเตือน
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-600">{countLabel}</p>
                </div>
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onMarkAll}
                disabled={!hasUnread || isMarkingAll}
                className="h-10 border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Filter className="h-4 w-4" aria-hidden="true" />
                แสดง
            </span>
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
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
                "h-8 rounded-md px-3 text-sm font-semibold text-slate-600",
                isActive && "bg-white text-slate-950 shadow-sm hover:bg-white",
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
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
                กล่องข้อความ
            </div>
            <div className="divide-y divide-slate-100">
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
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600",
                "disabled:cursor-wait disabled:opacity-75",
                notification.isRead ? "hover:bg-slate-50" : "bg-sky-50/50 hover:bg-sky-50",
            )}
        >
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden="true" />
                ) : (
                    <NotificationIcon type={notification.type} className="h-5 w-5" />
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-start gap-3">
                    <span className="min-w-0 flex-1 text-sm leading-6">
                        <span className={cn(
                            "block line-clamp-2",
                            notification.isRead ? "font-medium text-slate-800" : "font-semibold text-slate-950",
                        )}>
                            {notification.title}
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                            {notification.message}
                        </span>
                    </span>
                    {!notification.isRead ? (
                        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-600" aria-label="ยังไม่อ่าน" />
                    ) : null}
                </span>
                <span className="mt-2 block text-xs font-medium text-slate-500">
                    {getRelativeTime(notification.createdAt)}
                </span>
            </span>
        </button>
    );
}
