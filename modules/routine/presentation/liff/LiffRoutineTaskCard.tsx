"use client";

import { ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/helpers/date-helpers";
import {
    formatRoutineDueLabel,
    formatRoutineUnitLabel,
    getRoutineTimingStatusClass,
    ROUTINE_SCHEDULE_LABELS,
    ROUTINE_TIMING_STATUS_LABELS,
} from "../dashboard/labels";
import type { LiffRoutineTaskWorkItem } from "./api";

interface LiffRoutineTaskCardProps {
    task: LiffRoutineTaskWorkItem;
    isFocused?: boolean;
    onOpen: (taskId: number) => void;
}

export function LiffRoutineTaskCard({
    task,
    isFocused = false,
    onOpen,
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
            className={`gap-0 rounded-md border bg-surface-raised p-0 shadow-none ${
                isFocused
                    ? "border-brand-solid ring-2 ring-brand-solid/20"
                    : "border-border-subtle"
            }`}
        >
            <button
                type="button"
                onClick={() => onOpen(task.id)}
                aria-label={`เปิดรายละเอียดงาน ${task.title}`}
                className="group flex min-w-0 flex-col gap-3 rounded-md px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus/60 sm:px-5"
            >
                {isFocused ? (
                    <p className="text-xs font-semibold text-brand-strong">
                        งานจากการแจ้งเตือน
                    </p>
                ) : null}
                <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="break-words text-base font-bold leading-6 text-content-heading">
                            {task.title}
                        </h3>
                        <p className="mt-1 break-words text-sm font-medium text-brand-strong">
                            {formatRoutineUnitLabel(task.unit)}
                        </p>
                        <p className="mt-0.5 break-words text-sm text-content-secondary">
                            {task.category.name}
                        </p>
                    </div>
                    <div className="flex max-w-full shrink-0 items-center gap-2">
                        <span
                            className={`max-w-full whitespace-normal rounded-md border px-2 py-1 text-left text-xs font-semibold leading-5 ${statusClass}`}
                        >
                            {statusLabel}
                        </span>
                        <ChevronRight
                            className="size-5 text-content-muted transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                        />
                    </div>
                </div>

                <div className="border-t border-border-subtle pt-3">
                    <p className="text-xs font-medium text-content-muted">กำหนดส่ง</p>
                    <p className="mt-0.5 break-words text-sm font-semibold text-content-body">
                        {occurrence
                            ? `${formatDate(occurrence.dueDate)} · ${formatRoutineDueLabel(occurrence)}`
                            : "ยังไม่มีกำหนดรอบถัดไป"}
                    </p>
                </div>

                {scheduleLabel ? (
                    <p className="text-xs leading-5 text-content-muted">
                        <span className="font-semibold text-content-secondary">ตารางงาน: </span>
                        {scheduleLabel}
                    </p>
                ) : null}

                {task.description ? (
                    <p className="line-clamp-3 text-sm leading-6 text-content-secondary">
                        {task.description}
                    </p>
                ) : null}
            </button>
        </Card>
    );
}
