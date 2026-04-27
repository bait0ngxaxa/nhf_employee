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
    { gradient: string; text: string; bg: string; icon: string; border: string; glow: string }
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
        gradient: "from-orange-400 to-rose-500",
        text: "text-orange-950",
        bg: "bg-orange-50/70",
        icon: "text-orange-600",
        border: "border-orange-100",
        glow: "group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-orange-300",
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

// ----------------------------------------------------------------------
// Mini Components for UI distinctness
// ----------------------------------------------------------------------

// Removed LiveClock Component

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "อรุณสวัสดิ์";
    if (hour >= 12 && hour < 17) return "สวัสดียามบ่าย";
    if (hour >= 17 && hour < 22) return "สวัสดีตอนเย็น";
    return "ราตรีสวัสดิ์";
}

// ----------------------------------------------------------------------
// Main Dashboard Component
// ----------------------------------------------------------------------

export function DashboardHomeSection() {
    const { user, availableMenuGroups, sessionMenuItem } = useDashboardDataContext();
    const { handleMenuClick } = useDashboardUIContext();
    const [greeting, setGreeting] = useState("สวัสดี");

    useEffect(() => {
        setGreeting(getGreeting());
    }, []);

    const allMenuItems = [
        ...availableMenuGroups.flatMap((group) => group.items),
        sessionMenuItem,
    ];

    return (
        <div className="relative min-h-[calc(100vh-6rem)] bg-[#f8fafc] rounded-[2.5rem] overflow-hidden p-4 md:p-8 border border-white/60 shadow-[inset_0_2px_20px_rgba(255,255,255,1)]">
            
            {/* Ambient Background Noise & Mesh */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem] mix-blend-multiply opacity-50">
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.15)_0%,transparent_60%)] blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-20%] left-[-10%] w-[900px] h-[900px] bg-[radial-gradient(circle_at_center,rgba(129,140,248,0.15)_0%,transparent_60%)] blur-3xl animate-pulse" style={{ animationDuration: '12s' }} />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto space-y-6">
                
                {/* 
                  BENTO ROW 1: Hero (Full Width)
                */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
                    
                    {/* Hero Card - Spans full width */}
                    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-400 via-sky-400 to-cyan-300 p-8 md:p-10 text-white shadow-xl shadow-sky-900/5 border border-white/30">
                        {/* Decorative internal gradients */}
                        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent blend-overlay" />
                        <div className="absolute -bottom-24 -right-10 w-96 h-96 bg-white/20 rounded-full blur-3xl mix-blend-overlay" />
                        <div className="absolute -top-10 -right-20 w-64 h-64 bg-cyan-300/30 rounded-full blur-3xl mix-blend-overlay" />
                        
                        <div className="relative z-10 h-full flex flex-col justify-center min-h-[140px]">
                            <div>
                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-2 drop-shadow-md">
                                    {greeting},
                                </h1>
                                <p className="text-2xl md:text-3xl lg:text-4xl font-semibold text-white/90 drop-shadow-sm">
                                    {user?.name}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 
                  BENTO ROW 2: Action Grid
                */}
                <div className="pt-4">
                    <h2 className="text-xl font-bold tracking-tight text-slate-800 mb-6 flex items-center gap-2 px-2">
                        <span className="w-1.5 h-6 bg-sky-500 rounded-full inline-block" />
                        ศูนย์รวมการทำงาน
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out delay-150 fill-mode-both">
                        {allMenuItems.map((item, i) => {
                            const IconComponent = item.icon;
                            const config = MENU_ITEM_CONFIG[item.id] ?? DEFAULT_MENU_CONFIG;
                            const disabled = item.comingSoon === true;

                            return (
                                <button
                                    key={item.id}
                                    disabled={disabled}
                                    onClick={disabled ? undefined : () => handleMenuClick(item.id)}
                                    className={cn(
                                        "group text-left relative overflow-hidden flex flex-col h-[180px] w-full rounded-[1.5rem] bg-white/60 backdrop-blur-md border border-white/80",
                                        "shadow-sm transition-all duration-500",
                                        disabled
                                            ? "opacity-60 cursor-not-allowed"
                                            : cn("hover:-translate-y-1", config.glow),
                                    )}
                                    // Stagger the entrance animation
                                    style={{ animationDelay: `${200 + i * 50}ms` }}
                                >
                                    {/* Glassmorphic Shine — suppressed when disabled */}
                                    {!disabled && (
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                                    )}

                                    {/* Action Icon in Corner — suppressed when disabled */}
                                    {!disabled && (
                                        <div className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-50 border border-slate-100/50 flex items-center justify-center opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-10 shadow-sm">
                                            <ArrowUpRight className={cn("w-4 h-4", config.icon)} />
                                        </div>
                                    )}

                                    {/* Coming-soon badge */}
                                    {disabled && (
                                        <span className="absolute top-4 right-4 z-10 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                            เร็วๆ นี้
                                        </span>
                                    )}

                                    {/* Dynamic Color Hint background */}
                                    <div className={cn(
                                        "absolute -bottom-12 -right-12 w-32 h-32 rounded-full opacity-0 blur-3xl transition-opacity duration-700 bg-gradient-to-tr pointer-events-none",
                                        !disabled && "group-hover:opacity-40",
                                        config.gradient
                                    )} />

                                    <div className="relative z-10 flex flex-col h-full p-5 lg:p-6">
                                        <div
                                            className={cn(
                                                "w-12 h-12 rounded-2xl flex items-center justify-center mb-auto border shadow-sm transition-transform duration-500",
                                                !disabled && "group-hover:scale-110",
                                                config.bg,
                                                config.border
                                            )}
                                        >
                                            <IconComponent className={cn("w-6 h-6", config.icon)} />
                                        </div>

                                        <div className="mt-4">
                                            <h3 className={cn(
                                                "text-base lg:text-lg font-bold tracking-tight mb-1 transition-colors duration-300",
                                                config.text
                                            )}>
                                                {item.label}
                                            </h3>
                                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
