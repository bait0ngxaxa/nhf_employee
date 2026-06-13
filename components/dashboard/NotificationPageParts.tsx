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

const PAGE_SIZE_LABEL = "ล่าสุดก่อน";

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
    const countLabel =
        filter === "unread"
            ? `${totalCount} รายการที่ยังไม่อ่าน`
            : `ทั้งหมด ${totalCount} รายการ`;

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                    การแจ้งเตือน
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-600">
                    {countLabel} เรียงตาม {PAGE_SIZE_LABEL}
                </p>
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onMarkAll}
                disabled={!hasUnread || isMarkingAll}
                className="h-10 rounded-lg border-slate-200 bg-white text-sm font-semibold text-slate-700 md:self-center"
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
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <FilterButton
                icon={<Filter className="h-3.5 w-3.5" aria-hidden="true" />}
                isActive={filter === "all"}
                label="ทั้งหมด"
                onClick={() => onChange("all")}
            />
            <FilterButton
                icon={<Bell className="h-3.5 w-3.5" aria-hidden="true" />}
                isActive={filter === "unread"}
                label="ยังไม่อ่าน"
                onClick={() => onChange("unread")}
            />
        </div>
    );
}

function FilterButton({
    icon,
    isActive,
    label,
    onClick,
}: {
    icon: React.ReactNode;
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
                "h-9 rounded-lg px-3 text-sm font-semibold text-slate-600",
                isActive &&
                    "bg-slate-950 text-white hover:bg-slate-900 hover:text-white",
            )}
            aria-pressed={isActive}
        >
            {icon}
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
        <div className="max-w-3xl space-y-2">
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
                "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2",
                "disabled:cursor-wait disabled:opacity-75",
                notification.isRead
                    ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : "border-slate-300 bg-white text-slate-950 shadow-sm hover:border-slate-400",
            )}
        >
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                {isPending ? (
                    <Loader2
                        className="h-4 w-4 animate-spin text-slate-500"
                        aria-hidden="true"
                    />
                ) : (
                    <NotificationIcon
                        type={notification.type}
                        className="h-5 w-5"
                    />
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-start gap-2">
                    <span
                        className={cn(
                            "min-w-0 flex-1 truncate text-sm leading-6",
                            notification.isRead
                                ? "font-medium text-slate-700"
                                : "font-semibold text-slate-950",
                        )}
                    >
                        {notification.title}
                    </span>
                    {!notification.isRead ? (
                        <span
                            className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500"
                            aria-label="ยังไม่อ่าน"
                        />
                    ) : null}
                </span>
                <span className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                    {notification.message}
                </span>
                <span className="mt-2 block text-xs font-medium text-slate-500">
                    {getRelativeTime(notification.createdAt)}
                </span>
            </span>
        </button>
    );
}
