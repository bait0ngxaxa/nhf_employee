"use client";

import type { LiffRoutineSummary as LiffRoutineSummaryData } from "@/lib/client/liff-routine";

interface LiffRoutineSummaryProps {
    summary: LiffRoutineSummaryData;
}

const SUMMARY_ITEMS = [
    {
        key: "today",
        label: "ถึงกำหนดวันนี้",
        valueClassName: "text-brand-strong",
    },
    {
        key: "dueSoon",
        label: "ใกล้ถึงกำหนด",
        valueClassName: "text-status-warning-strong",
    },
    {
        key: "within30Days",
        label: "ภายใน 30 วัน",
        valueClassName: "text-status-success-strong",
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
            <div className="grid grid-cols-3 divide-x divide-border-subtle overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
                {SUMMARY_ITEMS.map((item) => {
                    return (
                        <div key={item.key} className="min-w-0 px-2.5 py-3 sm:px-4 sm:py-3.5">
                            <p className="break-words text-xs font-semibold leading-5 text-content-secondary sm:text-sm">
                                {item.label}
                            </p>
                            <p
                                className={`mt-1 text-xl font-bold leading-6 tabular-nums sm:text-2xl ${item.valueClassName}`}
                                aria-label={`${item.label} ${summary[item.key]} งาน`}
                            >
                                {summary[item.key]}
                            </p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
