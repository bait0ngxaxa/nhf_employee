"use client";

import { CalendarDays, Layers3 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/helpers/date-helpers";
import {
    formatRoutineDueLabel,
    formatRoutineUnitLabel,
    getRoutineTimingStatusClass,
    ROUTINE_SCHEDULE_LABELS,
    ROUTINE_TIMING_STATUS_LABELS,
} from "@/components/dashboard/routine/labels";
import type { LiffRoutineTaskWorkItem } from "@/lib/client/liff-routine";

interface LiffRoutineTaskCardProps {
    task: LiffRoutineTaskWorkItem;
    isFocused?: boolean;
}

export function LiffRoutineTaskCard({
    task,
    isFocused = false,
}: LiffRoutineTaskCardProps): React.ReactElement {
    const occurrence = task.relevantOccurrence;
    const statusLabel = occurrence
        ? ROUTINE_TIMING_STATUS_LABELS[occurrence.timingStatus]
        : "ยังไม่มีรอบกำหนด";
    const statusClass = occurrence
        ? getRoutineTimingStatusClass(occurrence.timingStatus)
        : "border-border-subtle bg-surface-subtle text-content-secondary";
    const scheduleLabel = task.scheduleText?.trim()
        || ROUTINE_SCHEDULE_LABELS[task.scheduleType]
        || "ยังไม่กำหนดตารางงาน";

    return (
        <Card
            className={`gap-3 rounded-2xl border bg-surface-raised px-4 py-4 shadow-sm sm:gap-4 sm:px-5 ${
                isFocused
                    ? "border-brand-solid ring-2 ring-brand-solid/20"
                    : "border-border-subtle"
            }`}
        >
            {isFocused ? (
                <p className="text-xs font-semibold text-brand-strong">
                    งานจากการแจ้งเตือน
                </p>
            ) : null}
            <div className="flex min-w-0 flex-col items-start gap-2.5 min-[400px]:flex-row min-[400px]:justify-between min-[400px]:gap-3">
                <div className="min-w-0">
                    <h3 className="break-words text-base font-bold leading-6 text-content-heading">
                        {task.title}
                    </h3>
                    <p className="mt-1 break-words text-sm font-medium text-brand-strong">
                        {formatRoutineUnitLabel(task.unit)}
                    </p>
                </div>
                <span
                    className={`max-w-full shrink-0 whitespace-normal rounded-full border px-2.5 py-1 text-left text-xs font-semibold leading-5 min-[400px]:whitespace-nowrap ${statusClass}`}
                >
                    {statusLabel}
                </span>
            </div>

            <dl className="grid gap-2.5 text-sm text-content-secondary min-[420px]:grid-cols-2">
                <div className="flex min-w-0 items-start gap-2">
                    <Layers3 className="mt-0.5 size-4 shrink-0 text-content-muted" aria-hidden="true" />
                    <div className="min-w-0">
                        <dt className="text-xs font-medium text-content-muted">หมวดหมู่</dt>
                        <dd className="break-words font-medium text-content-body">
                            {task.category.name}
                        </dd>
                    </div>
                </div>
                <div className="flex min-w-0 items-start gap-2">
                    <CalendarDays className="mt-0.5 size-4 shrink-0 text-content-muted" aria-hidden="true" />
                    <div className="min-w-0">
                        <dt className="text-xs font-medium text-content-muted">กำหนดส่ง</dt>
                        <dd className="break-words font-medium text-content-body">
                            {occurrence
                                ? `${formatDate(occurrence.dueDate)} · ${formatRoutineDueLabel(occurrence)}`
                                : "ยังไม่มีกำหนดรอบถัดไป"}
                        </dd>
                    </div>
                </div>
            </dl>

            {scheduleLabel ? (
                <p className="border-t border-border-subtle pt-3 text-xs leading-5 text-content-muted">
                    {scheduleLabel}
                </p>
            ) : null}

            {task.description ? (
                <p className="line-clamp-3 text-sm leading-6 text-content-secondary">
                    {task.description}
                </p>
            ) : null}
        </Card>
    );
}
