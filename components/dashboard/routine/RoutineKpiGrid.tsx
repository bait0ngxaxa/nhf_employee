import { CalendarClock, CalendarDays, CalendarRange, CircleAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { RoutineSummary } from "./types";

interface RoutineKpiGridProps {
    summary: RoutineSummary | undefined;
    isLoading: boolean;
}

const KPI_ITEMS = [
    { key: "today", label: "งานถึงกำหนดวันนี้", icon: CalendarDays, tone: "text-sky-700" },
    { key: "dueSoon", label: "งานใกล้ถึงกำหนด 7 วัน", icon: CalendarClock, tone: "text-amber-700" },
    { key: "overdue", label: "งานเกินกำหนด", icon: CircleAlert, tone: "text-rose-700" },
    { key: "within30Days", label: "งานภายใน 30 วัน", icon: CalendarRange, tone: "text-emerald-700" },
] as const;

export function RoutineKpiGrid({
    summary,
    isLoading,
}: RoutineKpiGridProps) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {KPI_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                    <Card
                        key={item.key}
                        className="gap-3 rounded-xl border-border-subtle bg-surface-raised px-5 py-4 shadow-sm"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-content-secondary">
                                {item.label}
                            </p>
                            <Icon className={`size-5 ${item.tone}`} aria-hidden="true" />
                        </div>
                        <p className="text-2xl font-semibold text-content-heading" aria-live="polite">
                            {isLoading ? "–" : summary?.[item.key] ?? 0}
                        </p>
                    </Card>
                );
            })}
        </div>
    );
}
