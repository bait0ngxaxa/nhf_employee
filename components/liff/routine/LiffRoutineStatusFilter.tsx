"use client";

import type {
    LiffRoutineTimingFilter,
} from "@/lib/client/liff-routine";

interface LiffRoutineStatusFilterProps {
    value: LiffRoutineTimingFilter;
    onChange: (value: LiffRoutineTimingFilter) => void;
}

const FILTER_ITEMS: ReadonlyArray<{
    value: LiffRoutineTimingFilter;
    label: string;
}> = [
    { value: "", label: "ทั้งหมด" },
    { value: "OVERDUE", label: "เกินกำหนด" },
    { value: "DUE_TODAY", label: "วันนี้" },
    { value: "DUE_SOON", label: "ใกล้ถึงกำหนด" },
];

export function LiffRoutineStatusFilter({
    value,
    onChange,
}: LiffRoutineStatusFilterProps): React.ReactElement {
    return (
        <section aria-labelledby="liff-routine-filter-heading">
            <h2 id="liff-routine-filter-heading" className="sr-only">
                กรองงานตามกำหนดเวลา
            </h2>
            <div
                className="flex gap-2 overflow-x-auto pb-1"
                role="group"
                aria-label="กรองงาน Routine"
            >
                {FILTER_ITEMS.map((item) => {
                    const selected = item.value === value;
                    return (
                        <button
                            key={item.value || "all"}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onChange(item.value)}
                            className={
                                selected
                                    ? "min-h-11 shrink-0 rounded-full bg-brand-solid px-4 text-sm font-semibold text-content-on-brand shadow-sm transition-colors hover:bg-brand-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid/40"
                                    : "min-h-11 shrink-0 rounded-full border border-border-subtle bg-surface-raised px-4 text-sm font-semibold text-content-secondary transition-colors hover:border-brand-border hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid/40"
                            }
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
