import { Card, CardContent } from "@/components/ui/card";
import {
    Users,
    UserCheck,
    Building2,
    GraduationCap,
    type LucideIcon,
} from "lucide-react";

interface StatItem {
    label: string;
    value: number;
    unit: string;
    gradient: string;
    icon: LucideIcon;
    bgClass: string;
    iconClass: string;
}

interface EmployeeStats {
    total: number;
    active: number;
    admin: number;
    academic: number;
}

interface EmployeeStatsCardsProps {
    stats: EmployeeStats;
}

export function EmployeeStatsCards({ stats }: EmployeeStatsCardsProps) {
    const statItems: StatItem[] = [
        {
            label: "พนักงานทั้งหมด",
            value: stats.total,
            unit: "คน",
            gradient: "from-blue-600 to-cyan-600",
            icon: Users,
            bgClass: "bg-blue-50/50",
            iconClass: "text-blue-600",
        },
        {
            label: "พนักงานปัจจุบัน",
            value: stats.active,
            unit: "คน (Active)",
            gradient: "from-green-500 to-emerald-600",
            icon: UserCheck,
            bgClass: "bg-green-50/50",
            iconClass: "text-green-600",
        },
        {
            label: "แผนกบริหาร",
            value: stats.admin,
            unit: "คน",
            gradient: "from-orange-500 to-amber-600",
            icon: Building2,
            bgClass: "bg-orange-50/50",
            iconClass: "text-orange-600",
        },
        {
            label: "แผนกวิชาการ",
            value: stats.academic,
            unit: "คน",
            gradient: "from-purple-500 to-violet-600",
            icon: GraduationCap,
            bgClass: "bg-purple-50/50",
            iconClass: "text-purple-600",
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {statItems.map((item) => {
                const Icon = item.icon;
                return (
                    <Card
                        key={item.label}
                        className="relative overflow-hidden bg-white/60 backdrop-blur-md border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl group border-l-4"
                        style={{ borderLeftColor: "transparent" }}
                    >
                        {/* Decorative Background Blob */}
                        <div
                            className={`absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 blur-2xl bg-gradient-to-br ${item.gradient} group-hover:opacity-20 transition-opacity duration-500`}
                        />

                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">
                                        {item.label}
                                    </p>
                                    <div className="flex items-baseline space-x-2">
                                        <p
                                            className={`text-3xl font-bold bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}
                                        >
                                            {item.value}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {item.unit}
                                        </p>
                                    </div>
                                </div>
                                <div
                                    className={`p-3 rounded-xl ${item.bgClass} group-hover:scale-110 transition-transform duration-300`}
                                >
                                    <Icon
                                        className={`h-6 w-6 ${item.iconClass}`}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
