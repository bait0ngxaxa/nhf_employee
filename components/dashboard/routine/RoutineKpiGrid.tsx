import { Card, CardContent } from "@/components/ui/card";
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
        accentClass: "bg-brand-solid",
        valueClass: "text-brand-strong",
    },
    {
        key: "dueSoon",
        label: "งานใกล้ถึงกำหนด 7 วัน",
        accentClass: "bg-status-warning-solid",
        valueClass: "text-status-warning-strong",
    },
    {
        key: "within30Days",
        label: "งานภายใน 30 วัน",
        accentClass: "bg-status-success-solid",
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
                return (
                    <Card
                        key={item.key}
                        className="h-full border-border-subtle shadow-none"
                    >
                        <CardContent className="flex h-full flex-col p-5">
                            <div
                                className="mb-4 flex items-center gap-2"
                                aria-hidden="true"
                            >
                                <span className={`h-1 w-8 rounded-full ${item.accentClass}`} />
                                <span className="h-px flex-1 bg-border-muted" />
                            </div>
                            <p className="text-base/6 font-semibold text-content-heading">
                                {item.label}
                            </p>
                            <div
                                className={`mt-4 min-h-9 text-3xl font-bold tracking-tight tabular-nums ${item.valueClass}`}
                                aria-live="polite"
                            >
                                {isLoading ? (
                                    <Skeleton className="h-9 w-16" />
                                ) : (
                                    summary?.[item.key] ?? 0
                                )}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
