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
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                {SUMMARY_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isWideMobileItem = item.key === "within30Days";
                    return (
                        <Card
                            key={item.key}
                            className={`min-w-0 gap-2 rounded-2xl border px-3 py-3 shadow-sm sm:gap-3 sm:px-4 sm:py-4 ${
                                isWideMobileItem
                                    ? "col-span-2 flex-row items-center justify-between sm:col-span-1 sm:flex-col sm:items-stretch"
                                    : ""
                            } ${item.className}`}
                        >
                            <div className="flex min-w-0 items-center justify-between gap-2">
                                <p className="break-words text-sm font-semibold leading-5">
                                    {item.label}
                                </p>
                                <Icon
                                    className="hidden size-5 shrink-0 sm:block"
                                    aria-hidden="true"
                                />
                            </div>
                            <p
                                className="shrink-0 text-2xl font-bold leading-none tabular-nums sm:text-3xl"
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
