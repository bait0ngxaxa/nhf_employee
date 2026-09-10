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
        valueClass: "text-brand-strong",
    },
    {
        key: "dueSoon",
        label: "งานใกล้ถึงกำหนด 7 วัน",
        valueClass: "text-status-warning-strong",
    },
    {
        key: "within30Days",
        label: "งานภายใน 30 วัน",
        valueClass: "text-status-success-strong",
    },
] as const;

export function RoutineKpiGrid({
    summary,
    isLoading,
}: RoutineKpiGridProps) {
    return (
        <div
            className="grid divide-y divide-border-subtle border-y border-border-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-3"
            aria-busy={isLoading}
        >
            {KPI_ITEMS.map((item) => {
                return (
                    <div
                        key={item.key}
                        className="min-w-0 px-4 py-4 sm:px-5"
                    >
                        <p className="text-sm/5 font-semibold text-content-heading">
                            {item.label}
                        </p>
                        <div
                            className={`mt-2 min-h-9 text-3xl font-bold tracking-tight tabular-nums ${item.valueClass}`}
                            aria-live="polite"
                        >
                            {isLoading ? (
                                <Skeleton className="h-9 w-16" />
                            ) : (
                                summary?.[item.key] ?? 0
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
