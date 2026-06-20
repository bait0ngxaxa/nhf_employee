import React from "react";
import {
    Building2,
    GraduationCap,
    UserCheck,
    Users,
    type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface StatItem {
    label: string;
    value: number;
    detail: string;
    icon: LucideIcon;
    iconClassName: string;
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

function buildStatItems(stats: EmployeeStats): StatItem[] {
    return [
        {
            label: "พนักงานทั้งหมด",
            value: stats.total,
            detail: "รายชื่อในระบบ",
            icon: Users,
            iconClassName: "bg-slate-100 text-slate-700",
        },
        {
            label: "กำลังปฏิบัติงาน",
            value: stats.active,
            detail: "สถานะ Active",
            icon: UserCheck,
            iconClassName: "bg-emerald-50 text-emerald-700",
        },
        {
            label: "ฝ่ายบริหาร",
            value: stats.admin,
            detail: "บุคลากรสายบริหาร",
            icon: Building2,
            iconClassName: "bg-amber-50 text-amber-700",
        },
        {
            label: "ฝ่ายวิชาการ",
            value: stats.academic,
            detail: "บุคลากรสายวิชาการ",
            icon: GraduationCap,
            iconClassName: "bg-sky-50 text-sky-700",
        },
    ];
}

export const EmployeeStatsCards = React.memo(function EmployeeStatsCards({
    stats,
}: EmployeeStatsCardsProps): React.ReactElement {
    const statItems = buildStatItems(stats);

    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-1 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between">
                <h3 className="font-semibold text-slate-950">ภาพรวมบุคลากร</h3>
                <p className="text-sm text-slate-600">สรุปจำนวนพนักงาน</p>
            </div>
            <dl className="grid grid-cols-2 lg:grid-cols-4">
                {statItems.map((item, index) => {
                    const Icon = item.icon;

                    return (
                        <div
                            key={item.label}
                            className={cn(
                                "min-w-0 p-4 sm:p-5",
                                index < 2 && "border-b border-slate-100 lg:border-b-0",
                                index % 2 === 0 && "border-r border-slate-100 lg:border-r-0",
                                index < 3 && "lg:border-r lg:border-slate-100",
                            )}
                        >
                            <div className="flex items-center gap-2.5">
                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.iconClassName}`}>
                                    <Icon className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <dt className="min-w-0 text-sm font-medium text-slate-700">
                                    {item.label}
                                </dt>
                            </div>
                            <dd className="mt-4 flex items-baseline gap-2">
                                <span className="text-2xl font-semibold tracking-tight text-slate-950">
                                    {item.value}
                                </span>
                                <span className="text-sm text-slate-500">คน</span>
                            </dd>
                            <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                        </div>
                    );
                })}
            </dl>
        </section>
    );
});
