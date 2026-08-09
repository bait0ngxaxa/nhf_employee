import { CalendarClock, CalendarDays, CalendarRange } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { RoutineSummary } from "./types";

interface RoutineKpiGridProps {
    summary: RoutineSummary | undefined;
    isLoading: boolean;
}

const KPI_ITEMS = [
    {
        key: "today",
        label: "งานถึงกำหนดวันนี้",
        icon: CalendarDays,
        cardClass: "border-brand-border bg-brand-surface",
        iconClass: "bg-brand-surface-strong text-brand-strong",
        valueClass: "text-brand-strong",
    },
    {
        key: "dueSoon",
        label: "งานใกล้ถึงกำหนด 7 วัน",
        icon: CalendarClock,
        cardClass: "border-status-warning-border bg-status-warning-surface",
        iconClass: "bg-status-warning-border text-status-warning-strong",
        valueClass: "text-status-warning-strong",
    },
    {
        key: "within30Days",
        label: "งานภายใน 30 วัน",
        icon: CalendarRange,
        cardClass: "border-status-success-border bg-status-success-surface",
        iconClass: "bg-status-success-border text-status-success-strong",
        valueClass: "text-status-success-strong",
    },
] as const;

export function RoutineKpiGrid({
    summary,
    isLoading,
}: RoutineKpiGridProps) {
    return (
        <div
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            aria-busy={isLoading}
        >
            {KPI_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                    <Card
                        key={item.key}
                        className={`gap-4 rounded-xl border px-5 py-5 shadow-sm ${item.cardClass}`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p className="max-w-[18ch] text-sm font-semibold leading-5 text-content-secondary">
                                {item.label}
                            </p>
                            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.iconClass}`}>
                                <Icon className="size-5" aria-hidden="true" />
                            </span>
                        </div>
                        <div
                            className={`min-h-9 text-3xl font-bold tracking-tight tabular-nums ${item.valueClass}`}
                            aria-live="polite"
                        >
                            {isLoading ? (
                                <Skeleton className="h-9 w-16" />
                            ) : (
                                summary?.[item.key] ?? 0
                            )}
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}
