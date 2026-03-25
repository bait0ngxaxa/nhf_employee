import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertTriangle } from "lucide-react";

interface ApproverStatsProps {
    totalEmployees: number;
    activeApprovers: number;
    unassignedCount: number;
}

interface StatCardProps {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: number;
    color: "indigo" | "emerald" | "amber" | "gray";
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
    const colorMap: Record<StatCardProps["color"], { card: string; icon: string; text: string; bg: string }> = {
        indigo: {
            card: "from-indigo-50 to-sky-50 border-indigo-100",
            icon: "text-indigo-600",
            text: "text-indigo-700",
            bg: "bg-indigo-100",
        },
        emerald: {
            card: "from-emerald-50 to-teal-50 border-emerald-100",
            icon: "text-emerald-600",
            text: "text-emerald-700",
            bg: "bg-emerald-100",
        },
        amber: {
            card: "from-amber-50 to-orange-50 border-amber-200",
            icon: "text-amber-600",
            text: "text-amber-700",
            bg: "bg-amber-100",
        },
        gray: {
            card: "from-gray-50 to-slate-50 border-gray-100",
            icon: "text-gray-400",
            text: "text-gray-400",
            bg: "bg-gray-100",
        },
    };
    const c = colorMap[color];

    return (
        <Card className={`bg-gradient-to-br ${c.card}`}>
            <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${c.bg}`}>
                        <Icon className={`h-5 w-5 ${c.icon}`} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">{label}</p>
                        <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function ApproverStats({
    totalEmployees,
    activeApprovers,
    unassignedCount,
}: ApproverStatsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Users} label="พนักงานทั้งหมด" value={totalEmployees} color="indigo" />
            <StatCard icon={Users} label="ผู้อนุมัติ" value={activeApprovers} color="emerald" />
            <StatCard
                icon={AlertTriangle}
                label="ยังไม่กำหนดผู้อนุมัติ"
                value={unassignedCount}
                color={unassignedCount > 0 ? "amber" : "gray"}
            />
        </div>
    );
}
