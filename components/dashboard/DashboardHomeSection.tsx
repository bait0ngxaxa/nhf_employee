"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

// Static color config for menu items - keys must match DASHBOARD_MENU_ITEMS[].id
const DEFAULT_MENU_CONFIG = {
    gradient: "from-gray-500 to-slate-600",
    bgClass: "bg-gray-100",
    iconClass: "text-gray-600",
};

const MENU_ITEM_CONFIG: Record<
    string,
    { gradient: string; bgClass: string; iconClass: string }
> = {
    "leave-management": {
        gradient: "from-indigo-500 to-sky-600",
        bgClass: "bg-indigo-100",
        iconClass: "text-indigo-600",
    },
    stock: {
        gradient: "from-orange-500 to-red-600",
        bgClass: "bg-orange-100",
        iconClass: "text-orange-600",
    },
    "it-support": {
        gradient: "from-emerald-500 to-teal-700",
        bgClass: "bg-emerald-100",
        iconClass: "text-emerald-700",
    },
    "email-request": {
        gradient: "from-indigo-600 to-violet-700",
        bgClass: "bg-indigo-100",
        iconClass: "text-indigo-700",
    },
    "employee-management": {
        gradient: "from-sky-600 to-blue-700",
        bgClass: "bg-sky-100",
        iconClass: "text-sky-700",
    },
    "add-employee": {
        gradient: "from-pink-500 to-rose-600",
        bgClass: "bg-pink-100",
        iconClass: "text-pink-600",
    },
    "import-employee": {
        gradient: "from-teal-500 to-cyan-600",
        bgClass: "bg-teal-100",
        iconClass: "text-teal-600",
    },
    "audit-logs": {
        gradient: "from-yellow-500 to-amber-600",
        bgClass: "bg-yellow-100",
        iconClass: "text-amber-600",
    },
};

export function DashboardHomeSection() {
    const { user, availableMenuGroups, sessionMenuItem } =
        useDashboardDataContext();
    const { handleMenuClick } = useDashboardUIContext();

    // Flatten groups into a single list for the card grid
    const allMenuItems = [
        ...availableMenuGroups.flatMap((group) => group.items),
        sessionMenuItem,
    ];

    return (
        <div className="relative min-h-[calc(100vh-6rem)] bg-slate-50/50 rounded-3xl overflow-hidden border border-white/60 shadow-inner">
            {/* Background Aesthetic Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(219,234,254,0.6)_0%,transparent_70%)] -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(224,242,254,0.6)_0%,transparent_70%)] translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="relative z-10 p-4 md:p-8 space-y-8">
                {/* Header */}
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
                    <h2
                        className={cn(
                            "text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br pb-1",
                            "from-gray-900 via-gray-800 to-gray-600",
                        )}
                    >
                        ยินดีต้อนรับ, {user?.name}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out delay-150">
                    {allMenuItems.map((item) => {
                        const IconComponent = item.icon;
                        const config =
                            MENU_ITEM_CONFIG[item.id] ?? DEFAULT_MENU_CONFIG;

                        return (
                            <Card
                                key={item.id}
                                className={cn(
                                    "relative overflow-hidden cursor-pointer bg-white border-gray-200",
                                    "shadow-lg hover:shadow-xl transition-[box-shadow,transform] duration-300",
                                    "rounded-2xl group",
                                )}
                                onClick={() => handleMenuClick(item.id)}
                            >
                                {/* Decorative Background Blob */}
                                <div
                                    className={cn(
                                        "absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10 blur-2xl bg-gradient-to-br",
                                        config.gradient,
                                        "group-hover:opacity-20 transition-opacity duration-500",
                                    )}
                                />

                                <CardHeader className="pb-2">
                                    <div className="flex items-center space-x-4">
                                        <div
                                            className={cn(
                                                "p-3 rounded-xl group-hover:scale-110 transition-transform duration-300",
                                                config.bgClass,
                                            )}
                                        >
                                            <IconComponent
                                                className={cn(
                                                    "h-7 w-7",
                                                    config.iconClass,
                                                )}
                                            />
                                        </div>
                                        <CardTitle
                                            className={cn(
                                                "text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r",
                                                config.gradient,
                                                "group-hover:opacity-80 transition-opacity",
                                            )}
                                        >
                                            {item.label}
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-gray-500 leading-relaxed">
                                        {item.description}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
