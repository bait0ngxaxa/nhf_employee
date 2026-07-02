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
    color: "sky" | "emerald" | "amber" | "gray";
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
    const colorMap: Record<StatCardProps["color"], { card: string; icon: string; text: string; bg: string }> = {
        sky: {
            card: "border-sky-200 bg-sky-50",
            icon: "text-sky-700",
            text: "text-sky-800",
            bg: "bg-white",
        },
        emerald: {
            card: "border-emerald-200 bg-emerald-50",
            icon: "text-emerald-700",
            text: "text-emerald-800",
            bg: "bg-white",
        },
        amber: {
            card: "border-amber-200 bg-amber-50",
            icon: "text-amber-700",
            text: "text-amber-800",
            bg: "bg-white",
        },
        gray: {
            card: "border-slate-200 bg-slate-50",
            icon: "text-slate-500",
            text: "text-slate-700",
            bg: "bg-white",
        },
    };
    const c = colorMap[color];

    return (
        <Card className={c.card}>
            <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                    <div className={`rounded-lg border border-white/80 p-2 ${c.bg}`}>
                        <Icon className={`h-5 w-5 ${c.icon}`} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm text-slate-600">{label}</p>
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
            <StatCard icon={Users} label="พนักงานทั้งหมด" value={totalEmployees} color="sky" />
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
