import { Eye, Pencil } from "lucide-react";
import { useState, type ReactElement } from "react";
import type { KeyedMutator } from "swr";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { calendarDateToDate } from "@/lib/routine/schedule";

import {
    areRoutineAssigneeSnapshotsEqual,
    formatRoutineAssigneeSummary,
    formatRoutineDueLabel,
    formatRoutineScheduleSummary,
    formatRoutineUnitLabel,
    getRoutineTimingStatusClass,
    ROUTINE_TIMING_STATUS_LABELS,
} from "./labels";
import { RoutineDetailsDialog } from "./RoutineDetailsDialog";
import { RoutineOccurrenceEditDialog } from "./RoutineOccurrenceEditDialog";
import { RoutineOccurrenceListSkeleton } from "./RoutineSkeletons";
import type {
    PaginatedRoutineTaskWorkItemsResponse,
    RoutineEmployee,
    RoutineTaskWorkItem,
} from "./types";

interface RoutineOccurrenceListProps {
    data: PaginatedRoutineTaskWorkItemsResponse | undefined;
    employees: RoutineEmployee[];
    error: Error | undefined;
    focusOccurrenceId: number | null;
    focusTaskId: number | null;
    isAdmin: boolean;
    isLoading: boolean;
    mutate: KeyedMutator<PaginatedRoutineTaskWorkItemsResponse>;
    onEditTask: (taskId: number) => void;
    onPageChange: (page: number) => void;
    onRetry: () => void;
}

function formatDate(date: string): string {
    return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Bangkok",
    }).format(calendarDateToDate(date));
}

export function RoutineOccurrenceList({
    data,
    employees,
    error,
    focusOccurrenceId,
    focusTaskId,
    isAdmin,
    isLoading,
    mutate,
    onEditTask,
    onPageChange,
    onRetry,
}: RoutineOccurrenceListProps): ReactElement {
    const [detailsTask, setDetailsTask] = useState<RoutineTaskWorkItem | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [occurrenceEditTask, setOccurrenceEditTask] = useState<RoutineTaskWorkItem | null>(null);
    const [occurrenceEditOpen, setOccurrenceEditOpen] = useState(false);

    function openDetails(task: RoutineTaskWorkItem): void {
        setDetailsTask(task);
        setDetailsOpen(true);
    }

    function openOccurrenceEdit(task: RoutineTaskWorkItem): void {
        setOccurrenceEditTask(task);
        setOccurrenceEditOpen(true);
    }

    if (isLoading && !data) return <RoutineOccurrenceListSkeleton />;
    if (error) {
        return (
            <ErrorState
                compact
                action={{ label: "ลองใหม่", onClick: onRetry }}
                description={error.message}
            />
        );
    }
    if (!data || data.tasks.length === 0) {
        return (
            <EmptyState
                compact
                title={focusTaskId === null ? "ยังไม่มีรายการ Routine" : "ไม่พบรายการ Routine นี้"}
                description={focusTaskId === null
                    ? "รายการตามกำหนดการจะแสดงที่นี่เมื่อมีแม่แบบงานที่รับผิดชอบ"
                    : "รายการอาจถูกลบ ปิดใช้งาน หรือคุณไม่มีสิทธิ์เข้าถึงรายการนี้"}
            />
        );
    }

    return (
        <div className="space-y-3" aria-label="รายการ Routine">
            {data.tasks.map((task) => {
                const occurrence = task.relevantOccurrence;
                const isFocusedOccurrence = occurrence !== null
                    && occurrence.id === focusOccurrenceId;
                const hasOccurrenceAssigneeOverride = occurrence !== null
                    && !areRoutineAssigneeSnapshotsEqual(task.assignees, occurrence.assignees);
                const relevantAssignees = occurrence?.assignees ?? task.assignees;

                return (
                    <article
                        key={task.id}
                        className={isFocusedOccurrence
                            ? "rounded-xl border border-brand-foreground/50 bg-surface-raised p-4 shadow-sm ring-2 ring-brand-solid/15 sm:p-5"
                            : "rounded-xl border border-brand-border/70 bg-surface-raised p-4 shadow-sm transition-colors hover:border-brand-foreground/45 sm:p-5"}
                    >
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs/5 font-semibold text-brand-strong">
                                    <span className="break-words [overflow-wrap:anywhere]">{formatRoutineUnitLabel(task.unit)}</span>
                                    <span aria-hidden="true">•</span>
                                    <span className="break-words [overflow-wrap:anywhere]">{task.category.name}</span>
                                    {isFocusedOccurrence ? (
                                        <span className="rounded-full bg-brand-surface px-2 py-0.5 text-xs font-semibold text-brand-strong">
                                            รอบที่เลือก
                                        </span>
                                    ) : null}
                                </div>
                                <h3 className="mt-1 break-words text-xl font-semibold leading-7 tracking-tight text-content-heading [overflow-wrap:anywhere]">
                                    {task.title}
                                </h3>
                            </div>
                            {occurrence ? (
                                <span className={`inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs/5 font-semibold ${getRoutineTimingStatusClass(occurrence.timingStatus)}`}>
                                    {ROUTINE_TIMING_STATUS_LABELS[occurrence.timingStatus]}
                                </span>
                            ) : (
                                <span className="inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs/5 font-semibold text-brand-strong">
                                    ยังไม่มีรอบกำหนด
                                </span>
                            )}
                        </div>

                        <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-border-subtle pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <div className="min-w-0 space-y-1">
                                <dt className="text-xs/5 font-semibold text-content-muted">กำหนด</dt>
                                <dd className={occurrence?.isOverdue
                                    ? "break-words font-semibold leading-6 text-status-danger-foreground"
                                    : "break-words font-medium leading-6 text-content-body"}
                                >
                                    {occurrence
                                        ? `${formatDate(occurrence.dueDate)} (${formatRoutineDueLabel(occurrence)})`
                                        : "ยังไม่มีรอบกำหนด"}
                                </dd>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <dt className="text-xs/5 font-semibold text-content-muted">กำหนดการ</dt>
                                <dd className="break-words font-medium leading-6 text-content-body">
                                    {formatRoutineScheduleSummary(task)}
                                </dd>
                            </div>
                            <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
                                <dt className="text-xs/5 font-semibold text-content-muted">
                                    {hasOccurrenceAssigneeOverride ? "ผู้รับผิดชอบรอบนี้" : "ผู้รับผิดชอบ"}
                                </dt>
                                <dd className="break-words font-medium leading-6 text-content-body">
                                    {formatRoutineAssigneeSummary(relevantAssignees)}
                                    {hasOccurrenceAssigneeOverride ? (
                                        <span className="mt-1 inline-flex rounded-full border border-status-warning-border bg-status-warning-surface px-2 py-0.5 text-xs font-medium text-status-warning-foreground sm:ml-2 sm:mt-0">
                                            ปรับเฉพาะรอบ
                                        </span>
                                    ) : null}
                                </dd>
                            </div>
                        </dl>

                        <div
                            className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-3 sm:justify-end"
                            role="group"
                            aria-label={`การดำเนินการสำหรับ ${task.title}`}
                        >
                            <Button type="button" size="sm" variant="outline" onClick={() => openDetails(task)}>
                                <Eye aria-hidden="true" />
                                ดูรายละเอียด
                            </Button>
                            {isAdmin ? (
                                <>
                                    <Button type="button" size="sm" variant="outline" onClick={() => onEditTask(task.id)}>
                                        <Pencil aria-hidden="true" />
                                        แก้ไข Routine
                                    </Button>
                                    {occurrence ? (
                                        <Button type="button" size="sm" variant="outline" onClick={() => openOccurrenceEdit(task)}>
                                            <Pencil aria-hidden="true" />
                                            ปรับเฉพาะรอบนี้
                                        </Button>
                                    ) : null}
                                </>
                            ) : null}
                        </div>
                    </article>
                );
            })}

            {data.pagination.pages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4 text-sm text-content-secondary">
                    <span>หน้า {data.pagination.page} จาก {data.pagination.pages}</span>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={data.pagination.page <= 1} onClick={() => onPageChange(data.pagination.page - 1)}>ก่อนหน้า</Button>
                        <Button type="button" variant="outline" size="sm" disabled={data.pagination.page >= data.pagination.pages} onClick={() => onPageChange(data.pagination.page + 1)}>ถัดไป</Button>
                    </div>
                </div>
            ) : null}

            <RoutineDetailsDialog
                task={detailsTask}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                isAdmin={isAdmin}
            />
            <RoutineOccurrenceEditDialog
                task={occurrenceEditTask}
                open={occurrenceEditOpen}
                onOpenChange={setOccurrenceEditOpen}
                employees={employees}
                onSaved={async () => {
                    await mutate();
                }}
            />
        </div>
    );
}
