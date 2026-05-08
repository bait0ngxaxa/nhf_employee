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
        gradient: string;
        text: string;
        bg: string;
        icon: string;
        border: string;
        glow: string;
        /** When true the card renders as a full-bleed hero card */
        featured?: boolean;
        /** Gradient used for the featured card's background */
        featuredGradient?: string;
    }
> = {
    "leave-management": {
        gradient: "from-indigo-500 to-violet-500",
        text: "text-indigo-900",
        bg: "bg-indigo-50/70",
        icon: "text-indigo-600",
        border: "border-indigo-100",
        glow: "group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-indigo-300",
    },
    stock: {
        gradient: "from-orange-500 to-red-600",
        text: "text-orange-700",
        bg: "bg-orange-50",
        icon: "text-orange-600",
        border: "border-orange-100",
        glow: "group-hover:shadow-[0_8px_32px_-12px_rgba(234,88,12,0.35)]",
        featured: true,
        featuredGradient: "from-orange-500 to-red-600",
    },
    "it-support": {
        gradient: "from-emerald-400 to-teal-600",
        text: "text-emerald-950",
        bg: "bg-emerald-50/70",
        icon: "text-emerald-600",
        border: "border-emerald-100",
        glow: "group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-emerald-300",
    },
    "email-request": {
        gradient: "from-blue-400 to-indigo-500",
        text: "text-blue-950",
        bg: "bg-blue-50/70",
        icon: "text-blue-600",
        border: "border-blue-100",
        glow: "group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-blue-300",
    },
    "employee-management": {
        gradient: "from-sky-400 to-blue-500",
        text: "text-sky-950",
        bg: "bg-sky-50/70",
        icon: "text-sky-600",
        border: "border-sky-100",
        glow: "group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-sky-300",
    },
    "add-employee": {
        gradient: "from-pink-400 to-rose-500",
        text: "text-pink-950",
        bg: "bg-pink-50/70",
        icon: "text-pink-600",
        border: "border-pink-100",
        glow: "group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-pink-300",
    },
    "import-employee": {
        gradient: "from-teal-400 to-cyan-500",
        text: "text-teal-950",
        bg: "bg-teal-50/70",
        icon: "text-teal-600",
        border: "border-teal-100",
        glow: "group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-teal-300",
    },
    "audit-logs": {
        gradient: "from-amber-400 to-orange-500",
        text: "text-amber-950",
        bg: "bg-amber-50/70",
        icon: "text-amber-600",
        border: "border-amber-100",
        glow: "group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-amber-300",
    },
};

const DEFAULT_MENU_CONFIG = {
    gradient: "from-slate-400 to-gray-500",
    text: "text-slate-900",
    bg: "bg-slate-50/70",
    icon: "text-slate-600",
    border: "border-slate-200",
    glow: "group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-slate-300",
};

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "อรุณสวัสดิ์";
    if (hour >= 12 && hour < 17) return "สวัสดียามบ่าย";
    if (hour >= 17 && hour < 22) return "สวัสดีตอนเย็น";
    return "ราตรีสวัสดิ์";
}

// ----------------------------------------------------------------------
// Featured Card — refined, elegant horizontal card (col-span-2)
// ----------------------------------------------------------------------

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
                "group w-full text-left relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center gap-6",
                "h-auto sm:h-[180px] rounded-[2.5rem] bg-white transition-all duration-700",
                "p-6 md:p-8 border border-slate-100 hover:border-orange-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_-12px_rgba(249,115,22,0.12)] hover:-translate-y-1",
            )}
        >
            {/* Elegant glowing background hint */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-50/50 rounded-full blur-[80px] pointer-events-none transition-opacity duration-700 opacity-0 group-hover:opacity-100" />

            {/* Icon block - Minimalist refined */}
            <div className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-3xl flex items-center justify-center bg-slate-50 border border-slate-100 transition-all duration-500 group-hover:bg-orange-50 group-hover:border-orange-100 group-hover:scale-105 group-hover:rotate-3 z-10">
                <IconComponent className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400 group-hover:text-orange-600 transition-colors duration-500" />
            </div>

            {/* Text Content */}
            <div className="relative flex-1 min-w-0 z-10">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                        Featured
                    </span>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-slate-900 group-hover:text-orange-600 transition-colors duration-300">
                    {item.label}
                </h3>
                <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-sm mt-1">
                    {item.description ||
                        "ระบบจัดการส่วนงานสำคัญ เข้าถึงข้อมูลแบบเรียลไทม์"}
                </p>
            </div>

            {/* Arrow/Action Button */}
            <div className="shrink-0 w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center transition-all duration-500 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 shadow-sm z-10">
                <ArrowUpRight className="w-5 h-5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
        </button>
    );
}

// ----------------------------------------------------------------------
// Regular Card
// ----------------------------------------------------------------------

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
                "group text-left relative overflow-hidden flex flex-col h-[200px] w-full rounded-[2rem] bg-white transition-all duration-700",
                disabled
                    ? "opacity-50 cursor-not-allowed border border-slate-100"
                    : cn(
                          "border border-slate-50 hover:border-slate-200 shadow-[0_4px_15px_-3px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.08)] hover:-translate-y-1",
                      ),
            )}
        >
            {/* Arrow icon - Editorial style */}
            {!disabled && (
                <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 z-10">
                    <ArrowUpRight className={cn("w-4 h-4", config.icon)} />
                </div>
            )}

            {/* Coming-soon badge */}
            {disabled && (
                <span className="absolute top-6 right-6 z-10 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-400 border border-slate-200">
                    Soon
                </span>
            )}

            <div className="relative z-10 flex flex-col h-full p-6 md:p-8">
                <div
                    className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center mb-auto border transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
                        config.bg,
                        config.border,
                        "shadow-sm",
                    )}
                >
                    <IconComponent className={cn("w-6 h-6", config.icon)} />
                </div>

                <div className="mt-4">
                    <h3
                        className={cn(
                            "text-lg font-black tracking-tight mb-1 transition-colors duration-300",
                            config.text,
                        )}
                    >
                        {item.label}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed line-clamp-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        {item.description}
                    </p>
                </div>
            </div>

            {/* Subtle background glow on hover */}
            {!disabled && (
                <div
                    className={cn(
                        "absolute -bottom-10 -right-10 w-24 h-24 rounded-full blur-[40px] opacity-0 transition-opacity duration-700 pointer-events-none bg-gradient-to-tr",
                        "group-hover:opacity-20",
                        config.gradient,
                    )}
                />
            )}
        </button>
    );
}

// ----------------------------------------------------------------------
// Main Dashboard Component
// ----------------------------------------------------------------------

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

    return (
        <div className="relative min-h-[calc(100vh-6rem)] bg-[#f8fafc] rounded-[2.5rem] overflow-hidden p-4 md:p-8 border border-white/60 shadow-[inset_0_2px_20px_rgba(255,255,255,1)]">
            {/* Ambient Background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem] mix-blend-multiply opacity-50">
                <div
                    className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.15)_0%,transparent_60%)] blur-3xl animate-pulse"
                    style={{ animationDuration: "8s" }}
                />
                <div
                    className="absolute bottom-[-20%] left-[-10%] w-[900px] h-[900px] bg-[radial-gradient(circle_at_center,rgba(129,140,248,0.15)_0%,transparent_60%)] blur-3xl animate-pulse"
                    style={{ animationDuration: "12s" }}
                />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto space-y-6">
                {/* Hero Card - Redesigned to be more compact */}
                <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out">
                    <div className="relative group overflow-hidden rounded-[2.5rem] bg-white border border-slate-200/50 p-6 md:p-10 shadow-[0_15px_40px_-12px_rgba(0,0,0,0.04)] transition-all duration-700 hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)]">
                        {/* Interactive Mesh Background */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <div className="absolute -top-[20%] -right-[5%] w-[500px] h-[500px] bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-full blur-[100px] transition-transform duration-1000 group-hover:scale-110" />
                            <div className="absolute -bottom-[20%] -left-[5%] w-[400px] h-[400px] bg-gradient-to-tr from-sky-50/50 to-cyan-50/30 rounded-full blur-[80px] transition-transform duration-1000 group-hover:scale-110" />

                            <svg
                                className="absolute inset-0 w-full h-full opacity-[0.02] [mask-image:radial-gradient(ellipse_at_center,black,transparent)] pointer-events-none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <defs>
                                    <pattern
                                        id="grid"
                                        width="32"
                                        height="32"
                                        patternUnits="userSpaceOnUse"
                                    >
                                        <path
                                            d="M 32 0 L 0 0 0 32"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1"
                                        />
                                    </pattern>
                                </defs>
                                <rect
                                    width="100%"
                                    height="100%"
                                    fill="url(#grid)"
                                />
                            </svg>
                        </div>

                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-4 max-w-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="px-3 py-1 rounded-full bg-sky-500 text-white text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-sky-100">
                                        HELLO
                                    </div>
                                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                        Welcome back
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 leading-[1.1]">
                                        {greeting},{" "}
                                        <span className="text-sky-500">
                                            {user?.name}
                                        </span>
                                    </h1>
                                </div>
                            </div>

                            <div className="flex flex-wrap md:flex-col lg:flex-row gap-3">
                                <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-100/50 text-indigo-600 text-xs font-bold shadow-sm transition-all hover:bg-white hover:border-indigo-200">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                                    {user?.role || "พนักงาน"}
                                </div>
                                <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-sky-50 border border-sky-100/50 text-sky-600 text-xs font-bold shadow-sm transition-all hover:bg-white hover:border-sky-200">
                                    <div className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]" />
                                    {user?.department || "ฝ่ายทั่วไป"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Grid */}
                <div className="pt-4">
                    {/* --- Featured Section --- */}
                    <div className="mb-10">
                        <h2 className="text-xl font-bold tracking-tight text-slate-800 mb-6 flex items-center gap-2 px-2">
                            <span className="w-1.5 h-6 bg-orange-500 rounded-full inline-block shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                            Quick Actions
                        </h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                            {activeItems
                                .filter(
                                    (item) =>
                                        MENU_ITEM_CONFIG[item.id]?.featured ===
                                        true,
                                )
                                .map((item, i) => (
                                    <FeaturedCard
                                        key={item.id}
                                        item={item}
                                        onClick={() => handleMenuClick(item.id)}
                                        animationDelay={`${200 + i * 50}ms`}
                                    />
                                ))}
                        </div>
                    </div>

                    {/* --- Other Services Section --- */}
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-slate-800 mb-6 flex items-center gap-2 px-2">
                            <span className="w-1.5 h-6 bg-sky-500 rounded-full inline-block shadow-[0_0_10px_rgba(14,165,233,0.5)]" />
                            Other Services
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out delay-150 fill-mode-both">
                            {activeItems
                                .filter(
                                    (item) =>
                                        MENU_ITEM_CONFIG[item.id]?.featured !==
                                        true,
                                )
                                .map((item, i) => (
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

                    {/* --- Coming-soon items at the bottom --- */}
                    {disabledItems.length > 0 && (
                        <div className="pt-6">
                            <h3 className="text-sm font-semibold tracking-wide text-slate-400 uppercase mb-4 flex items-center gap-2 px-2">
                                <span className="w-1 h-4 bg-slate-300 rounded-full inline-block" />
                                เร็วๆ นี้
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
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
