"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

const MENU_ITEM_CONFIG: Record<
    string,
    {
        text: string;
        bg: string;
        icon: string;
        border: string;
        featured?: boolean;
    }
> = {
    "leave-management": {
        text: "text-indigo-900",
        bg: "bg-indigo-50/70",
        icon: "text-indigo-600",
        border: "border-indigo-100",
    },
    stock: {
        text: "text-orange-700",
        bg: "bg-orange-50",
        icon: "text-orange-600",
        border: "border-orange-100",
        featured: true,
    },
    "it-support": {
        text: "text-emerald-950",
        bg: "bg-emerald-50/70",
        icon: "text-emerald-600",
        border: "border-emerald-100",
    },
    "email-request": {
        text: "text-blue-950",
        bg: "bg-blue-50/70",
        icon: "text-blue-600",
        border: "border-blue-100",
    },
    "employee-management": {
        text: "text-sky-950",
        bg: "bg-sky-50/70",
        icon: "text-sky-600",
        border: "border-sky-100",
    },
    "add-employee": {
        text: "text-pink-950",
        bg: "bg-pink-50/70",
        icon: "text-pink-600",
        border: "border-pink-100",
    },
    "import-employee": {
        text: "text-teal-950",
        bg: "bg-teal-50/70",
        icon: "text-teal-600",
        border: "border-teal-100",
    },
    "audit-logs": {
        text: "text-amber-950",
        bg: "bg-amber-50/70",
        icon: "text-amber-600",
        border: "border-amber-100",
    },
};

const DEFAULT_MENU_CONFIG = {
    text: "text-slate-900",
    bg: "bg-slate-50/70",
    icon: "text-slate-600",
    border: "border-slate-200",
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

function FeaturedCard({ item, onClick, animationDelay }: FeaturedCardProps) {
    const IconComponent = item.icon;
    return (
        <button
            onClick={onClick}
            style={{ animationDelay }}
            className={cn(
                "dashboard-card-enter group relative flex w-full flex-col items-start gap-5 overflow-hidden rounded-3xl bg-orange-600 text-left text-white sm:flex-row sm:items-center",
                "min-h-[196px] border border-orange-500 p-5 shadow-lg shadow-orange-900/15 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-xl hover:shadow-orange-900/20 active:translate-y-0 md:p-7",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2",
            )}
        >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0)_45%)]" />
            <div className="dashboard-stock-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/20" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-28 rounded-tl-[3rem] bg-orange-500/40" />

            <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-white ring-1 ring-white/10 transition-colors duration-200 group-hover:bg-white group-hover:text-orange-700 sm:h-20 sm:w-20">
                <IconComponent className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
            </div>

            <div className="relative z-10 min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full border border-white/25 bg-white px-2.5 py-1 text-xs font-bold leading-5 text-orange-700 shadow-sm">
                        Quick action
                    </span>
                </div>
                <h3 className="line-clamp-2 text-3xl font-bold leading-tight text-white [overflow-wrap:anywhere] md:text-4xl">
                    {item.label}
                </h3>
                <p className="mt-2 line-clamp-2 max-w-[58ch] text-sm font-medium leading-6 text-orange-50 [overflow-wrap:anywhere]">
                    {item.description ||
                        "เข้าถึงงานสำคัญและติดตามสถานะที่เกี่ยวข้องกับคุณ"}
                </p>
            </div>

            <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white text-orange-700 shadow-sm transition-[background-color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:bg-orange-50">
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
        icon: React.ElementType;
        comingSoon?: boolean;
    };
    config: (typeof MENU_ITEM_CONFIG)[string];
    onClickFn: () => void;
    animationDelay: string;
}

function RegularCard({
    item,
    config,
    onClickFn,
    animationDelay,
}: RegularCardProps) {
    const IconComponent = item.icon;
    const disabled = item.comingSoon === true;

    return (
        <button
            disabled={disabled}
            onClick={disabled ? undefined : onClickFn}
            style={{ animationDelay }}
            className={cn(
                "group relative flex min-h-[180px] w-full flex-col overflow-hidden rounded-3xl bg-white text-left transition-[border-color,box-shadow,transform,opacity] duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2",
                disabled
                    ? "cursor-not-allowed border border-slate-100 opacity-60"
                    : cn(
                          "border border-slate-100 shadow-sm hover:border-slate-200 hover:shadow-md",
                      ),
            )}
        >
            {!disabled && (
                <div className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-500 opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100">
                    <ArrowUpRight className={cn("h-4 w-4", config.icon)} aria-hidden="true" />
                </div>
            )}

            {disabled && (
                <span className="absolute right-4 top-4 z-10 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                    เร็วๆ นี้
                </span>
            )}

            <div className="relative z-10 flex h-full flex-col p-5 md:p-6">
                <div
                    className={cn(
                        "mb-auto flex h-12 w-12 items-center justify-center rounded-2xl border transition-colors duration-200",
                        config.bg,
                        config.border,
                        "shadow-sm",
                    )}
                >
                    <IconComponent className={cn("h-6 w-6", config.icon)} aria-hidden="true" />
                </div>

                <div className="mt-4">
                    <h3
                        className={cn(
                            "mb-1 line-clamp-2 text-base font-bold leading-6 [overflow-wrap:anywhere] transition-colors duration-200",
                            config.text,
                        )}
                    >
                        {item.label}
                    </h3>
                    <p className="line-clamp-3 text-sm font-medium leading-6 text-slate-500 [overflow-wrap:anywhere]">
                        {item.description || "เปิดใช้งานเมนูนี้จากแถบด้านข้าง"}
                    </p>
                </div>
            </div>

            {!disabled && (
                <div
                    className={cn(
                        "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
                        config.bg,
                    )}
                />
            )}
        </button>
    );
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

    // Separate active from coming-soon; pin featured (stock) to the front
    const activeItems = allMenuItems
        .filter((item) => item.comingSoon !== true)
        .sort((a) => (MENU_ITEM_CONFIG[a.id]?.featured === true ? -1 : 1));

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
        <div className="relative min-h-[calc(100vh-6rem)] overflow-hidden rounded-3xl border border-slate-200/70 bg-slate-50 p-4 shadow-inner shadow-white md:p-8">
            <div className="relative z-10 mx-auto max-w-7xl space-y-6">
                <div>
                    <div className="dashboard-card-enter relative overflow-hidden rounded-3xl border border-sky-500 bg-sky-600 p-5 text-white shadow-lg shadow-sky-900/15 md:p-8">
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0)_50%)]" />
                        <div className="dashboard-card-drift pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full border border-white/15" />
                        <div className="dashboard-card-drift pointer-events-none absolute -bottom-14 right-20 h-36 w-36 rounded-full bg-sky-500/40 [animation-delay:900ms]" />
                        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                            <div className="relative z-10 min-w-0 max-w-2xl space-y-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="rounded-full border border-white/20 bg-white px-3 py-1 text-xs font-bold text-sky-700 shadow-sm">
                                        NHFapp
                                    </div>
                                   
                                </div>

                                <div className="space-y-2">
                                    <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
                                        {greeting},{" "}
                                        <span className="text-sky-50 [overflow-wrap:anywhere]">
                                            {userName}
                                        </span>
                                    </h1>
                                    <p className="max-w-[64ch] text-sm font-medium leading-6 text-sky-50/90">
                                        National Health Foundation 
                                    </p>
                                </div>
                            </div>

                            <div className="relative z-10 flex min-w-0 flex-wrap gap-3 md:justify-end">
                                <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/20 bg-white/15 px-4 py-2 text-xs font-bold text-white shadow-sm">
                                    <div className="h-2 w-2 shrink-0 rounded-full bg-white" />
                                    <span className="min-w-0 truncate">{userRole}</span>
                                </div>
                                <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/20 bg-white/15 px-4 py-2 text-xs font-bold text-white shadow-sm">
                                    <div className="h-2 w-2 shrink-0 rounded-full bg-sky-100" />
                                    <span className="min-w-0 truncate">{userDepartment}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    {allMenuItems.length === 0 && (
                        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
                            ยังไม่มีเมนูที่พร้อมใช้งานสำหรับบัญชีนี้
                        </div>
                    )}

                    {featuredItems.length > 0 && (
                    <div className="mb-10">
                        <h2 className="mb-6 flex items-center gap-2 px-2 text-xl font-bold leading-7 text-slate-800">
                            <span className="inline-block h-6 w-1.5 rounded-full bg-orange-500" />
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
                        <h2 className="mb-6 flex items-center gap-2 px-2 text-lg font-bold leading-7 text-slate-800">
                            <span className="inline-block h-6 w-1.5 rounded-full bg-sky-500" />
                            บริการอื่นๆ
                        </h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
                            {regularItems.map((item, i) => (
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
                                        animationDelay={`${250 + i * 50}ms`}
                                    />
                            ))}
                        </div>
                    </div>
                    )}

                    {disabledItems.length > 0 && (
                        <div className="pt-6">
                            <h3 className="mb-4 flex items-center gap-2 px-2 text-sm font-semibold leading-6 text-slate-500">
                                <span className="inline-block h-4 w-1 rounded-full bg-slate-300" />
                                เร็วๆ นี้
                            </h3>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
                                {disabledItems.map((item, i) => {
                                    const config =
                                        MENU_ITEM_CONFIG[item.id] ??
                                        DEFAULT_MENU_CONFIG;
                                    return (
                                        <RegularCard
                                            key={item.id}
                                            item={item}
                                            config={config}
                                            onClickFn={() => {}}
                                            animationDelay={`${400 + i * 50}ms`}
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
