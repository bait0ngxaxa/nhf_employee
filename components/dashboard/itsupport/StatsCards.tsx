"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
    Ticket as TicketIcon,
    Settings,
    BarChart3,
    Sparkles,
    List,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useITSupportDataContext } from "../context";

interface StatItem {
    label: string;
    value: number;
    unit: string;
    gradient: string;
    icon: LucideIcon;
    bgClass: string;
    iconClass: string;
}

// Static configuration
const STAT_CONFIG: Omit<StatItem, 'value'>[] = [
    {
        label: "Tickets ทั้งหมด",
        unit: "tickets",
        gradient: "from-gray-600 to-slate-600",
        icon: TicketIcon,
        bgClass: "bg-gray-100",
        iconClass: "text-gray-600",
    },
    {
        label: "Tickets ใหม่",
        unit: "24 ชม.",
        gradient: "from-blue-600 to-indigo-600",
        icon: Sparkles,
        bgClass: "bg-blue-100",
        iconClass: "text-blue-600",
    },
    {
        label: "กำลังดำเนินการ",
        unit: "tickets",
        gradient: "from-amber-500 to-orange-600",
        icon: Settings,
        bgClass: "bg-amber-100",
        iconClass: "text-amber-600",
    },
    {
        label: "แก้ไขแล้ว",
        unit: "tickets",
        gradient: "from-emerald-500 to-teal-600",
        icon: BarChart3,
        bgClass: "bg-emerald-100",
        iconClass: "text-emerald-600",
    },
    {
        label: "ของฉัน",
        unit: "tickets",
        gradient: "from-purple-500 to-pink-600",
        icon: List,
        bgClass: "bg-purple-100",
        iconClass: "text-purple-600",
    },
];

export const StatsCards = React.memo(function StatsCards() {
    const { ticketStats, isAdmin } = useITSupportDataContext();

    const statItems: StatItem[] = [
        { ...STAT_CONFIG[0], value: ticketStats.total },
        { ...STAT_CONFIG[1], value: ticketStats.newTickets ?? 0 },
        { ...STAT_CONFIG[2], value: ticketStats.open + ticketStats.inProgress },
        { ...STAT_CONFIG[3], value: ticketStats.resolved },
        { ...STAT_CONFIG[4], value: ticketStats.userTickets ?? 0 },
    ];

    // Update unit for "Mine" based on role
    statItems[4] = {
        ...statItems[4],
        unit: isAdmin ? "มอบหมาย" : "ที่ฉันแจ้ง",
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-5">
            {statItems.map((item, index) => {
                const Icon = item.icon;
                const isNewCard = index === 1 && item.value > 0;

                return (
                    <Card
                        key={item.label}
                        className={cn(
                            "relative overflow-hidden bg-white border-gray-200 shadow-lg hover:shadow-xl transition-[box-shadow,transform] duration-300 rounded-2xl group",
                            isNewCard && "ring-2 ring-blue-200"
                        )}
                    >
                        {/* Decorative Background Blob */}
                        <div
                            className={cn(
                                "absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 blur-2xl bg-gradient-to-br",
                                item.gradient,
                                "group-hover:opacity-20 transition-opacity duration-500"
                            )}
                        />

                        <CardContent className="p-5">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                                        {item.label}
                                    </p>
                                    <div className="flex items-baseline space-x-1.5">
                                        <p
                                            className={cn(
                                                "text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                                                item.gradient
                                            )}
                                        >
                                            {item.value}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {item.unit}
                                        </p>
                                    </div>
                                </div>
                                <div
                                    className={cn(
                                        "p-2.5 rounded-xl group-hover:scale-110 transition-transform duration-300",
                                        item.bgClass
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            "h-5 w-5",
                                            item.iconClass,
                                            isNewCard && "animate-pulse"
                                        )}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
});
