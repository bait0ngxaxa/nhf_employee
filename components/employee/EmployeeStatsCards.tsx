import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatItem {
    label: string;
    value: number;
    unit: string;
    gradient: string;
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
        },
        {
            label: "พนักงานปัจจุบัน",
            value: stats.active,
            unit: "คน (Active)",
            gradient: "from-green-500 to-emerald-600",
        },
        {
            label: "แผนกบริหาร",
            value: stats.admin,
            unit: "คน",
            gradient: "from-orange-500 to-amber-600",
        },
        {
            label: "แผนกวิชาการ",
            value: stats.academic,
            unit: "คน",
            gradient: "from-purple-500 to-violet-600",
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {statItems.map((item) => (
                <Card
                    key={item.label}
                    className="bg-white/60 backdrop-blur-md border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl"
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                            {item.label}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline space-x-2">
                            <p
                                className={`text-4xl font-bold bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}
                            >
                                {item.value}
                            </p>
                            <p className="text-sm text-gray-500">{item.unit}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
