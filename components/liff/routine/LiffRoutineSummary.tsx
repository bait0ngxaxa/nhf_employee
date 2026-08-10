"use client";

import { CalendarClock, CalendarDays, CalendarRange } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { LiffRoutineSummary as LiffRoutineSummaryData } from "@/lib/client/liff-routine";

interface LiffRoutineSummaryProps {
    summary: LiffRoutineSummaryData;
}

const SUMMARY_ITEMS = [
    {
        key: "today",
        label: "ถึงกำหนดวันนี้",
        icon: CalendarDays,
        className: "border-brand-border bg-brand-surface text-brand-strong",
    },
    {
        key: "dueSoon",
        label: "ใกล้ถึงกำหนด",
        icon: CalendarClock,
        className: "border-status-warning-border bg-status-warning-surface text-status-warning-strong",
    },
    {
        key: "within30Days",
        label: "ภายใน 30 วัน",
        icon: CalendarRange,
        className: "border-status-success-border bg-status-success-surface text-status-success-strong",
    },
] as const;

export function LiffRoutineSummary({
    summary,
}: LiffRoutineSummaryProps): React.ReactElement {
    return (
        <section aria-labelledby="liff-routine-summary-heading">
            <h2 id="liff-routine-summary-heading" className="sr-only">
                สรุปงาน Routine
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {SUMMARY_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Card
                            key={item.key}
                            className={`gap-2 rounded-2xl border px-3 py-3 shadow-sm sm:gap-3 sm:px-4 sm:py-4 ${item.className}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold leading-5 sm:text-sm">
                                    {item.label}
                                </p>
                                <Icon
                                    className="hidden size-5 shrink-0 sm:block"
                                    aria-hidden="true"
                                />
                            </div>
                            <p
                                className="text-2xl font-bold tabular-nums sm:text-3xl"
                                aria-label={`${item.label} ${summary[item.key]} งาน`}
                            >
                                {summary[item.key]}
                            </p>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
}
