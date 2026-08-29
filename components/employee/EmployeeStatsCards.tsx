import React from "react";

import { cn } from "@/lib/ui/utils";

interface StatItem {
    label: string;
    value: number;
    detail: string;
    valueClassName: string;
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
            valueClassName: "text-content-heading",
        },
        {
            label: "กำลังปฏิบัติงาน",
            value: stats.active,
            detail: "สถานะ Active",
            valueClassName: "text-emerald-700",
        },
        {
            label: "ฝ่ายบริหาร",
            value: stats.admin,
            detail: "บุคลากรสายบริหาร",
            valueClassName: "text-amber-700",
        },
        {
            label: "ฝ่ายวิชาการ",
            value: stats.academic,
            detail: "บุคลากรสายวิชาการ",
            valueClassName: "text-sky-700",
        },
    ];
}

export const EmployeeStatsCards = React.memo(function EmployeeStatsCards({
    stats,
}: EmployeeStatsCardsProps): React.ReactElement {
    const statItems = buildStatItems(stats);

    return (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <div className="flex flex-col gap-1 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between">
                <h3 className="font-semibold text-content-heading">ภาพรวมบุคลากร</h3>
                <p className="text-sm text-content-secondary">สรุปจำนวนพนักงาน</p>
            </div>
            <dl className="grid grid-cols-2 lg:grid-cols-4">
                {statItems.map((item, index) => {
                    return (
                        <div
                            key={item.label}
                            className={cn(
                                "min-w-0 p-4 sm:p-5",
                                index < 2 && "border-b border-border-muted lg:border-b-0",
                                index % 2 === 0 && "border-r border-border-muted lg:border-r-0",
                                index < 3 && "lg:border-r lg:border-border-muted",
                            )}
                        >
                            <dt className="min-w-0 text-sm font-medium text-content-body">
                                {item.label}
                            </dt>
                            <dd className="mt-4 flex items-baseline gap-2">
                                <span className={cn("text-2xl font-semibold tracking-tight", item.valueClassName)}>
                                    {item.value}
                                </span>
                                <span className="text-sm text-content-muted">คน</span>
                            </dd>
                            <p className="mt-1 text-xs text-content-muted">{item.detail}</p>
                        </div>
                    );
                })}
            </dl>
        </section>
    );
});
