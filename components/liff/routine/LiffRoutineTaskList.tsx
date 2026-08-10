"use client";

import { Loader2 } from "lucide-react";

import { EmptyState } from "@/components/ui/state";
import type {
    LiffRoutineTaskWorkItem,
} from "@/lib/client/liff-routine";

import { LiffRoutineTaskCard } from "./LiffRoutineTaskCard";

interface LiffRoutineTaskListProps {
    tasks: LiffRoutineTaskWorkItem[];
    page: number;
    pages: number;
    isLoading: boolean;
    isFiltered: boolean;
    focusedTaskId: number | null;
    onLoadMore: () => void;
}

export function LiffRoutineTaskList({
    tasks,
    page,
    pages,
    isLoading,
    isFiltered,
    focusedTaskId,
    onLoadMore,
}: LiffRoutineTaskListProps): React.ReactElement {
    if (tasks.length === 0 && !isLoading) {
        return (
            <EmptyState
                compact
                title={
                    isFiltered
                        ? "ไม่พบงานตามตัวกรองนี้"
                        : "ยังไม่มีงาน Routine ที่ได้รับมอบหมาย"
                }
                description={
                    isFiltered
                        ? "ลองเลือกตัวกรองอื่นเพื่อดูงานที่ได้รับมอบหมาย"
                        : "เมื่อมีงานที่ได้รับมอบหมาย งานจะแสดงในหน้านี้"
                }
            />
        );
    }

    return (
        <section aria-labelledby="liff-routine-task-list-heading" aria-busy={isLoading}>
            <h2 id="liff-routine-task-list-heading" className="sr-only">
                รายการงาน Routine
            </h2>
            <div className="space-y-3">
                {tasks.map((task) => (
                    <LiffRoutineTaskCard
                        key={task.id}
                        task={task}
                        isFocused={task.id === focusedTaskId}
                    />
                ))}
            </div>
            {page < pages ? (
                <button
                    type="button"
                    onClick={onLoadMore}
                    disabled={isLoading}
                    className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-4 text-sm font-semibold text-brand-strong transition-colors hover:bg-brand-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid/40 disabled:cursor-wait disabled:opacity-70"
                >
                    {isLoading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                    {isLoading ? "กำลังโหลด..." : "โหลดเพิ่มเติม"}
                </button>
            ) : null}
        </section>
    );
}
