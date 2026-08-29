"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/ui/utils";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

const MENU_ITEM_CONFIG: Record<
    string,
    {
        text: string;
        icon?: string;
        featured?: boolean;
        featuredSurface?: string;
        featuredControlSurface?: string;
        featuredBorder?: string;
        featuredShadow?: string;
        featuredIconHover?: string;
        featuredArrowHover?: string;
        featuredBadge?: string;
        featuredDescription?: string;
        featuredCorner?: string;
        featuredFocus?: string;
    }
> = {
    "leave-management": {
        text: "text-module-leave-dashboard-strong",
        featured: true,
        icon: "text-module-leave-dashboard-control-foreground",
        featuredSurface: "bg-module-leave-dashboard-surface",
        featuredControlSurface: "bg-dashboard-featured-control-surface",
        featuredBorder: "border-module-leave-dashboard-accent hover:border-module-leave-dashboard-accent-hover",
        featuredShadow: "shadow-module-leave-dashboard-strong/15 hover:shadow-module-leave-dashboard-strong/20",
        featuredIconHover: "group-hover:bg-dashboard-featured-control-surface group-hover:text-module-leave-badge-foreground",
        featuredArrowHover: "group-hover:bg-dashboard-featured-control-surface",
        featuredBadge: "text-module-leave-badge-foreground",
        featuredDescription: "text-module-leave-dashboard-muted",
        featuredCorner: "bg-module-leave-dashboard-corner/40",
        featuredFocus: "focus-visible:ring-module-leave-dashboard-focus",
    },
    stock: {
        text: "text-module-stock-badge-foreground",
        featured: true,
        icon: "text-module-stock-dashboard-control-foreground",
        featuredSurface: "bg-module-stock-dashboard-surface",
        featuredControlSurface: "bg-dashboard-featured-control-surface",
        featuredBorder: "border-module-stock-dashboard-accent hover:border-module-stock-dashboard-accent-hover",
        featuredShadow: "shadow-module-stock-dashboard-strong/15 hover:shadow-module-stock-dashboard-strong/20",
        featuredIconHover: "group-hover:bg-dashboard-featured-control-surface group-hover:text-module-stock-badge-foreground",
        featuredArrowHover: "group-hover:bg-dashboard-featured-control-surface",
        featuredBadge: "text-module-stock-badge-foreground",
        featuredDescription: "text-module-stock-dashboard-muted",
        featuredCorner: "bg-module-stock-dashboard-corner/40",
        featuredFocus: "focus-visible:ring-module-stock-dashboard-focus",
    },
    routine: {
        text: "text-module-routine-dashboard-strong",
        featured: true,
        icon: "text-module-routine-dashboard-control-foreground",
        featuredSurface: "bg-module-routine-dashboard-surface",
        featuredControlSurface: "bg-dashboard-featured-control-surface",
        featuredBorder: "border-module-routine-dashboard-accent hover:border-module-routine-dashboard-accent-hover",
        featuredShadow: "shadow-module-routine-dashboard-strong/15 hover:shadow-module-routine-dashboard-strong/20",
        featuredIconHover: "group-hover:bg-dashboard-featured-control-surface group-hover:text-module-routine-badge-foreground",
        featuredArrowHover: "group-hover:bg-dashboard-featured-control-surface",
        featuredBadge: "text-module-routine-badge-foreground",
        featuredDescription: "text-module-routine-dashboard-muted",
        featuredCorner: "bg-module-routine-dashboard-corner/40",
        featuredFocus: "focus-visible:ring-module-routine-dashboard-focus",
    },
    "email-request": {
        text: "text-dashboard-menu-email",
    },
    "employee-management": {
        text: "text-dashboard-menu-employee",
    },
    "add-employee": {
        text: "text-dashboard-menu-add-employee",
    },
    "import-employee": {
        text: "text-dashboard-menu-import-employee",
    },
    "audit-logs": {
        text: "text-dashboard-menu-audit",
    },
};

const DEFAULT_MENU_CONFIG = {
    text: "text-content-primary",
};

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "อรุณสวัสดิ์";
    if (hour >= 12 && hour < 17) return "สวัสดียามบ่าย";
    if (hour >= 17 && hour < 22) return "สวัสดีตอนเย็น";
    return "ราตรีสวัสดิ์";
}

function getDisplayText(value: string | null | undefined, fallback: string): string {
    const trimmedValue = value?.trim();
    return trimmedValue && trimmedValue.length > 0 ? trimmedValue : fallback;
}

interface FeaturedCardProps {
    item: {
        id: string;
        label: string;
        description?: string;
        icon: React.ElementType;
    };
    onClick: () => void;
    animationDelay: string;
}

// Intentional visual exception:
// Core NHF module quick actions retain the branded rich-card treatment.
// Do not simplify these cards as part of generic UI de-slop cleanup.
function FeaturedCard({ item, onClick, animationDelay }: FeaturedCardProps) {
    const IconComponent = item.icon;
    const config = MENU_ITEM_CONFIG[item.id] ?? DEFAULT_MENU_CONFIG;

    return (
        <button
            onClick={onClick}
            style={{ animationDelay }}
            className={cn(
                "dashboard-card-enter group relative flex w-full min-w-0 flex-col items-start gap-5 overflow-hidden rounded-2xl text-left text-content-on-brand sm:flex-row sm:items-center sm:rounded-3xl",
                "min-h-[196px] border p-5 shadow-lg transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 md:p-7",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                config.featuredSurface,
                config.featuredBorder,
                config.featuredShadow,
                config.featuredFocus,
            )}
        >
            <div className="brand-sheen-subtle pointer-events-none absolute inset-0" />
            <div className="dashboard-stock-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-content-on-brand/20" />
            <div
                className={cn(
                    "pointer-events-none absolute bottom-0 right-0 h-28 w-28 rounded-tl-[3rem]",
                    config.featuredCorner,
                )}
            />

            <div
                className={cn(
                    "relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-content-on-brand/25 bg-content-on-brand/15 text-content-on-brand ring-1 ring-content-on-brand/10 transition-colors duration-200 sm:h-20 sm:w-20",
                    config.featuredIconHover,
                )}
            >
                <IconComponent className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
            </div>

            <div className="relative z-10 min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                    <span
                        className={cn(
                            "rounded-full border border-content-on-brand/25 px-2.5 py-1 text-xs font-bold leading-5 shadow-sm",
                            config.featuredControlSurface,
                            config.featuredBadge,
                        )}
                    >
                        Quick action
                    </span>
                </div>
                <h3 className="line-clamp-2 text-2xl font-bold leading-tight text-content-on-brand [overflow-wrap:anywhere] sm:text-3xl md:text-4xl">
                    {item.label}
                </h3>
                <p
                    className={cn(
                        "mt-2 line-clamp-2 max-w-[58ch] text-sm font-medium leading-6 [overflow-wrap:anywhere]",
                        config.featuredDescription,
                    )}
                >
                    {item.description ||
                        "เข้าถึงงานสำคัญและติดตามสถานะที่เกี่ยวข้องกับคุณ"}
                </p>
            </div>

            <div
                className={cn(
                    "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center self-end rounded-2xl border border-content-on-brand/25 shadow-sm transition-[background-color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:self-auto",
                    config.featuredControlSurface,
                    config.icon,
                    config.featuredArrowHover,
                )}
            >
                <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
            </div>
        </button>
    );
}

interface RegularCardProps {
    item: {
        id: string;
        label: string;
        description?: string;
        comingSoon?: boolean;
    };
    config: (typeof MENU_ITEM_CONFIG)[string];
    onClickFn: () => void;
}

function RegularCard({
    item,
    config,
    onClickFn,
}: RegularCardProps) {
    const disabled = item.comingSoon === true;

    return (
        <button
            disabled={disabled}
            onClick={disabled ? undefined : onClickFn}
            className={cn(
                "relative flex min-h-[180px] w-full flex-col rounded-2xl bg-surface-raised text-left transition-[background-color,border-color,opacity] duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-focus focus-visible:ring-offset-2",
                disabled
                    ? "cursor-not-allowed border border-border-muted opacity-60"
                    : cn(
                        "border border-border-muted hover:border-border-subtle hover:bg-surface-subtle",
                    ),
            )}
        >
            {disabled && (
                <span className="absolute right-4 top-4 z-10 rounded-full border border-border-subtle bg-surface-muted px-3 py-1 text-xs font-semibold text-content-muted">
                    เร็วๆ นี้
                </span>
            )}

            <div className="flex h-full flex-col p-5 md:p-6">
                <div className="mt-auto">
                    <h3
                        className={cn(
                            "mb-1 line-clamp-2 text-base font-bold leading-6 [overflow-wrap:anywhere] transition-colors duration-200",
                            config.text,
                        )}
                    >
                        {item.label}
                    </h3>
                    <p className="line-clamp-3 text-sm font-medium leading-6 text-content-muted [overflow-wrap:anywhere]">
                        {item.description || "เปิดใช้งานเมนูนี้จากแถบด้านข้าง"}
                    </p>
                </div>
            </div>
        </button>
    );
}

const FEATURED_ORDER = new Map([
    ["stock", 0],
    ["leave-management", 1],
    ["routine", 2],
]);

function getFeaturedRank(id: string): number {
    return FEATURED_ORDER.get(id) ?? Number.MAX_SAFE_INTEGER;
}

export function DashboardHomeSection() {
    const { user, availableMenuGroups } = useDashboardDataContext();
    const { handleMenuClick } = useDashboardUIContext();
    const [greeting, setGreeting] = useState("สวัสดี");

    useEffect(() => {
        setGreeting(getGreeting());
    }, []);

    const allMenuItems = [
        ...availableMenuGroups.flatMap((group) => group.items),
    ];

    // Separate active from coming-soon; pin featured quick actions to the front
    const activeItems = allMenuItems
        .filter((item) => item.comingSoon !== true)
        .sort((a, b) => getFeaturedRank(a.id) - getFeaturedRank(b.id));

    const disabledItems = allMenuItems.filter(
        (item) => item.comingSoon === true,
    );
    const featuredItems = activeItems.filter(
        (item) => MENU_ITEM_CONFIG[item.id]?.featured === true,
    );
    const regularItems = activeItems.filter(
        (item) => MENU_ITEM_CONFIG[item.id]?.featured !== true,
    );
    const userName = getDisplayText(user?.name, "ผู้ใช้งาน");
    const userRole = getDisplayText(user?.role, "พนักงาน");
    const userDepartment = getDisplayText(user?.department, "ฝ่ายทั่วไป");

    return (
        <div className="relative min-h-[calc(100dvh-6rem)] rounded-2xl border border-border-subtle/70 bg-surface-subtle p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-3xl md:p-8 md:pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <div className="relative z-10 mx-auto max-w-7xl space-y-6">
                <div>
                    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-dashboard-hero-border bg-dashboard-hero-surface p-5 text-content-on-brand shadow-lg shadow-dashboard-hero-shadow/15 sm:rounded-3xl md:p-8">
                        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                            <div className="relative z-10 min-w-0 max-w-2xl space-y-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="rounded-full border border-content-on-brand/20 bg-dashboard-featured-control-surface px-3 py-1 text-xs font-bold text-dashboard-hero-badge-foreground shadow-sm">
                                        NHFapp
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h1
                                        data-page-heading
                                        tabIndex={-1}
                                        className="text-3xl font-bold leading-tight text-content-on-brand sm:text-4xl md:text-5xl [overflow-wrap:anywhere]"
                                    >
                                        {greeting},{" "}
                                        <span className="text-dashboard-hero-muted [overflow-wrap:anywhere]">
                                            {userName}
                                        </span>
                                    </h1>
                                    <p className="max-w-[64ch] text-sm font-medium leading-6 text-dashboard-hero-muted/90">
                                        National Health Foundation 
                                    </p>
                                </div>
                            </div>

                            <div className="relative z-10 flex min-w-0 flex-wrap gap-3 md:justify-end">
                                <div className="flex min-w-0 max-w-full items-center gap-2.5 rounded-xl border border-content-on-brand/20 bg-content-on-brand/15 px-3 py-2 text-xs font-bold text-content-on-brand shadow-sm sm:px-4">
                                    <div className="h-2 w-2 shrink-0 rounded-full bg-content-on-brand" />
                                    <span className="min-w-0 truncate">{userRole}</span>
                                </div>
                                <div className="flex min-w-0 max-w-full items-center gap-2.5 rounded-xl border border-content-on-brand/20 bg-content-on-brand/15 px-3 py-2 text-xs font-bold text-content-on-brand shadow-sm sm:px-4">
                                    <div className="h-2 w-2 shrink-0 rounded-full bg-dashboard-hero-dot" />
                                    <span className="min-w-0 truncate">{userDepartment}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    {allMenuItems.length === 0 && (
                        <div className="rounded-3xl border border-border-subtle bg-surface-raised p-8 text-center text-content-secondary shadow-sm">
                            ยังไม่มีเมนูที่พร้อมใช้งานสำหรับบัญชีนี้
                        </div>
                    )}

                    {featuredItems.length > 0 && (
                        <div className="mb-10">
                            <h2 className="mb-6 flex items-center gap-2 px-2 text-xl font-bold leading-7 text-content-strong">
                                <span className="inline-block h-6 w-1.5 rounded-full bg-module-stock-dashboard-accent" />
                                Recommended
                            </h2>
                            <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
                                {featuredItems.map((item, i) => (
                                    <FeaturedCard
                                        key={item.id}
                                        item={item}
                                        onClick={() => handleMenuClick(item.id)}
                                        animationDelay={`${200 + i * 50}ms`}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {regularItems.length > 0 && (
                        <div>
                            <h2 className="mb-6 flex items-center gap-2 px-2 text-lg font-bold leading-7 text-content-strong">
                                <span className="inline-block h-6 w-1.5 rounded-full bg-dashboard-hero-border" />
                                บริการอื่นๆ
                            </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
                                {regularItems.map((item) => (
                                    <RegularCard
                                        key={item.id}
                                        item={item}
                                        config={
                                            MENU_ITEM_CONFIG[item.id] ??
                                            DEFAULT_MENU_CONFIG
                                        }
                                        onClickFn={() =>
                                            handleMenuClick(item.id)
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {disabledItems.length > 0 && (
                        <div className="pt-6">
                            <h3 className="mb-4 flex items-center gap-2 px-2 text-sm font-semibold leading-6 text-content-muted">
                                <span className="inline-block h-4 w-1 rounded-full bg-content-border" />
                                เร็วๆ นี้
                            </h3>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
                                {disabledItems.map((item) => {
                                    const config =
                                        MENU_ITEM_CONFIG[item.id] ??
                                        DEFAULT_MENU_CONFIG;
                                    return (
                                        <RegularCard
                                            key={item.id}
                                            item={item}
                                            config={config}
                                            onClickFn={() => {}}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
