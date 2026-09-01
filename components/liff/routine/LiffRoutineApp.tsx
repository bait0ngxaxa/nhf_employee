"use client";

import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactElement,
} from "react";

import { ErrorState, LoadingState } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
import {
    isRecoveredLiffMutation,
    LIFF_SESSION_RECOVERED_MUTATION_MESSAGE,
    LiffApiError,
} from "@/lib/client/liff";
import {
    deleteLiffRoutineTask,
    fetchLiffRoutineReference,
    fetchLiffRoutineSummary,
    fetchLiffRoutineTask,
    fetchLiffRoutineTasks,
    type LiffRoutineReferenceData,
    type LiffRoutineSummary,
    type LiffRoutineTaskDetail,
    type LiffRoutineTaskWorkItem,
    type LiffRoutineTasksResponse,
    type LiffRoutineTimingFilter,
} from "@/lib/client/liff-routine";
import { formatDate } from "@/lib/helpers/date-helpers";

import { LiffRoutineStatusFilter } from "./LiffRoutineStatusFilter";
import { LiffRoutineSummary as LiffRoutineSummaryView } from "./LiffRoutineSummary";
import { LiffRoutineTaskDetail as LiffRoutineTaskDetailView } from "./LiffRoutineTaskDetail";
import {
    LiffRoutineTaskFormSurface,
} from "./LiffRoutineTaskFormSurface";
import type { LiffRoutineTaskFormMode } from "./LiffRoutineTaskForm";
import { LiffRoutineTaskList } from "./LiffRoutineTaskList";

type LiffRoutineState = "LOADING" | "READY" | "ERROR";
type LiffRoutineReferenceState = "IDLE" | "LOADING" | "READY" | "ERROR";

const LIFF_TASK_PAGE_SIZE = 12;

function parsePositiveInteger(value: string | null): number | null {
    if (!value || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function getRoutineFocus(searchParams: {
    get(name: string): string | null;
}): { taskId: number; occurrenceId: number } | null {
    const taskId = parsePositiveInteger(searchParams.get("taskId"));
    const occurrenceId = parsePositiveInteger(searchParams.get("occurrenceId"));
    return taskId !== null && occurrenceId !== null
        ? { taskId, occurrenceId }
        : null;
}

function initialPagination(): LiffRoutineTasksResponse["pagination"] {
    return { page: 1, limit: LIFF_TASK_PAGE_SIZE, total: 0, pages: 0 };
}

function toRoutineViewError(error: unknown): string {
    if (error instanceof LiffApiError) {
        return error.message;
    }
    return "ไม่สามารถโหลดงาน Routine ได้ กรุณาลองใหม่อีกครั้ง";
}

function toRoutineMutationError(error: unknown): string {
    if (error instanceof LiffApiError) return error.message;
    return "ไม่สามารถดำเนินการกับงาน Routine ได้ กรุณาลองใหม่อีกครั้ง";
}

export function LiffRoutineApp(): ReactElement {
    const searchParams = useSearchParams();
    const initialRoutineFocus = getRoutineFocus(searchParams);
    const initialFocusTaskId = initialRoutineFocus?.taskId ?? null;
    const initialFocusOccurrenceId = initialRoutineFocus?.occurrenceId ?? null;
    const [state, setState] = useState<LiffRoutineState>("LOADING");
    const [viewError, setViewError] = useState<string | null>(null);
    const [summary, setSummary] = useState<LiffRoutineSummary | null>(null);
    const [tasks, setTasks] = useState<LiffRoutineTaskWorkItem[]>([]);
    const [pagination, setPagination] = useState(initialPagination);
    const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);
    const [focusNotice, setFocusNotice] = useState<string | null>(null);
    const [selectedFilter, setSelectedFilter] = useState<LiffRoutineTimingFilter>("");
    const [isTaskLoading, setIsTaskLoading] = useState(false);
    const [operationNotice, setOperationNotice] = useState<string | null>(null);
    const [operationError, setOperationError] = useState<string | null>(null);

    const [reference, setReference] = useState<LiffRoutineReferenceData | null>(null);
    const [referenceState, setReferenceState] = useState<LiffRoutineReferenceState>("IDLE");
    const [referenceError, setReferenceError] = useState<string | null>(null);

    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [detail, setDetail] = useState<LiffRoutineTaskDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [formMode, setFormMode] = useState<LiffRoutineTaskFormMode | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const focusedOccurrenceId = detail?.id === initialFocusTaskId
        ? initialFocusOccurrenceId
        : null;

    const taskRequestIdRef = useRef(0);
    const detailRequestIdRef = useRef(0);
    const referenceRequestIdRef = useRef(0);
    const routineRequestIdRef = useRef(0);

    useEffect(() => () => {
        routineRequestIdRef.current += 1;
        taskRequestIdRef.current += 1;
        detailRequestIdRef.current += 1;
        referenceRequestIdRef.current += 1;
    }, []);

    const loadRoutine = useCallback(async (): Promise<void> => {
        const requestId = routineRequestIdRef.current + 1;
        routineRequestIdRef.current = requestId;
        taskRequestIdRef.current += 1;
        detailRequestIdRef.current += 1;
        setState("LOADING");
        setViewError(null);
        setSummary(null);
        setTasks([]);
        setPagination(initialPagination());
        setFocusedTaskId(null);
        setFocusNotice(null);
        setSelectedTaskId(null);
        setDetail(null);
        setDetailError(null);
        setDeleteError(null);
        setDetailLoading(false);

        try {
            const focusedTasksPromise = initialFocusTaskId !== null
                && initialFocusOccurrenceId !== null
                ? fetchLiffRoutineTasks({
                      page: 1,
                      limit: 1,
                      taskId: initialFocusTaskId,
                      occurrenceId: initialFocusOccurrenceId,
                  })
                : Promise.resolve(null);
            const [summaryResponse, tasksResponse, focusedTasksResponse] =
                await Promise.all([
                    fetchLiffRoutineSummary(),
                    fetchLiffRoutineTasks({
                        page: 1,
                        limit: LIFF_TASK_PAGE_SIZE,
                    }),
                    focusedTasksPromise,
                ]);
            if (requestId !== routineRequestIdRef.current) return;

            let initialTasks = tasksResponse.tasks;
            if (
                initialFocusTaskId !== null
                && initialFocusOccurrenceId !== null
            ) {
                const focusedTask = focusedTasksResponse?.tasks[0] ?? null;
                if (!focusedTask) {
                    setFocusNotice(
                        "ไม่พบงานนี้ หรือคุณไม่มีสิทธิ์เข้าถึงรายการดังกล่าว กำลังแสดงงาน Routine ของคุณตามปกติ",
                    );
                } else {
                    setFocusedTaskId(focusedTask.id);
                    initialTasks = [
                        focusedTask,
                        ...tasksResponse.tasks.filter(
                            (task) => task.id !== focusedTask.id,
                        ),
                    ];
                }
            }

            setSummary(summaryResponse.summary);
            setTasks(initialTasks);
            setPagination(tasksResponse.pagination);
            setState("READY");
        } catch (error) {
            if (requestId !== routineRequestIdRef.current) return;
            setViewError(toRoutineViewError(error));
            setState("ERROR");
        }
    }, [initialFocusOccurrenceId, initialFocusTaskId]);

    useEffect(() => {
        void loadRoutine();
    }, [loadRoutine]);

    const loadReference = useCallback(async (): Promise<void> => {
        if (reference || referenceState === "LOADING") return;
        const requestId = referenceRequestIdRef.current + 1;
        referenceRequestIdRef.current = requestId;
        setReferenceState("LOADING");
        setReferenceError(null);
        try {
            const nextReference = await fetchLiffRoutineReference();
            if (requestId !== referenceRequestIdRef.current) return;
            setReference(nextReference);
            setReferenceState("READY");
        } catch (error) {
            if (requestId !== referenceRequestIdRef.current) return;
            setReferenceError(toRoutineViewError(error));
            setReferenceState("ERROR");
        }
    }, [reference, referenceState]);

    const loadTaskDetail = useCallback((taskId: number): void => {
        const requestId = detailRequestIdRef.current + 1;
        detailRequestIdRef.current = requestId;
        setSelectedTaskId(taskId);
        setDetail(null);
        setDetailError(null);
        setDeleteError(null);
        setDetailLoading(true);

        void fetchLiffRoutineTask(taskId)
            .then((response) => {
                if (requestId !== detailRequestIdRef.current) return;
                setDetail(response.task);
            })
            .catch((error: unknown) => {
                if (requestId !== detailRequestIdRef.current) return;
                setDetailError(toRoutineViewError(error));
            })
            .finally(() => {
                if (requestId === detailRequestIdRef.current) {
                    setDetailLoading(false);
                }
            });
    }, []);

    const retryTaskDetail = useCallback((): void => {
        if (selectedTaskId === null) return;
        loadTaskDetail(selectedTaskId);
    }, [loadTaskDetail, selectedTaskId]);

    const reloadLatestTask = useCallback(
        async (taskId: number): Promise<LiffRoutineTaskDetail> => {
            const requestId = detailRequestIdRef.current + 1;
            detailRequestIdRef.current = requestId;
            setSelectedTaskId(taskId);
            setDetailError(null);
            setDetailLoading(true);
            try {
                const response = await fetchLiffRoutineTask(taskId);
                if (requestId !== detailRequestIdRef.current) {
                    throw new Error("Routine detail request is no longer current");
                }
                setDetail(response.task);
                return response.task;
            } catch (error) {
                if (requestId === detailRequestIdRef.current) {
                    setDetailError(toRoutineViewError(error));
                }
                throw error;
            } finally {
                if (requestId === detailRequestIdRef.current) {
                    setDetailLoading(false);
                }
            }
        },
        [],
    );

    const handleFilterChange = useCallback(
        async (filter: LiffRoutineTimingFilter): Promise<void> => {
            if (state !== "READY") return;
            const requestId = taskRequestIdRef.current + 1;
            taskRequestIdRef.current = requestId;
            setSelectedFilter(filter);
            setIsTaskLoading(true);
            try {
                const response = await fetchLiffRoutineTasks({
                    page: 1,
                    limit: LIFF_TASK_PAGE_SIZE,
                    timingStatus: filter || undefined,
                });
                if (requestId !== taskRequestIdRef.current) return;
                setTasks(response.tasks);
                setPagination(response.pagination);
            } catch (error) {
                if (requestId !== taskRequestIdRef.current) return;
                setViewError(toRoutineViewError(error));
                setState("ERROR");
            } finally {
                if (requestId === taskRequestIdRef.current) {
                    setIsTaskLoading(false);
                }
            }
        },
        [state],
    );

    const handleLoadMore = useCallback(async (): Promise<void> => {
        if (state !== "READY" || isTaskLoading || pagination.page >= pagination.pages) {
            return;
        }
        const requestId = taskRequestIdRef.current + 1;
        taskRequestIdRef.current = requestId;
        setIsTaskLoading(true);
        try {
            const response = await fetchLiffRoutineTasks({
                page: pagination.page + 1,
                limit: LIFF_TASK_PAGE_SIZE,
                timingStatus: selectedFilter || undefined,
            });
            if (requestId !== taskRequestIdRef.current) return;
            setTasks((current) => {
                const existingIds = new Set(current.map((task) => task.id));
                return [
                    ...current,
                    ...response.tasks.filter((task) => !existingIds.has(task.id)),
                ];
            });
            setPagination(response.pagination);
        } catch (error) {
            if (requestId !== taskRequestIdRef.current) return;
            setViewError(toRoutineViewError(error));
            setState("ERROR");
        } finally {
            if (requestId === taskRequestIdRef.current) {
                setIsTaskLoading(false);
            }
        }
    }, [isTaskLoading, pagination, selectedFilter, state]);

    const refreshRoutineData = useCallback(async (
        refreshFailureMessage = "บันทึกสำเร็จ แต่โหลดรายการ Routine ล่าสุดไม่ได้ กรุณาลองใหม่อีกครั้ง",
    ): Promise<boolean> => {
        const requestId = taskRequestIdRef.current + 1;
        taskRequestIdRef.current = requestId;
        setIsTaskLoading(true);
        setOperationError(null);
        try {
            const [summaryResponse, tasksResponse] = await Promise.all([
                fetchLiffRoutineSummary(),
                fetchLiffRoutineTasks({
                    page: 1,
                    limit: LIFF_TASK_PAGE_SIZE,
                    timingStatus: selectedFilter || undefined,
                }),
            ]);
            if (requestId !== taskRequestIdRef.current) return false;
            setSummary(summaryResponse.summary);
            setTasks(tasksResponse.tasks);
            setPagination(tasksResponse.pagination);
            return true;
        } catch {
            if (requestId !== taskRequestIdRef.current) return false;
            setOperationError(refreshFailureMessage);
            return false;
        } finally {
            if (requestId === taskRequestIdRef.current) {
                setIsTaskLoading(false);
            }
        }
    }, [selectedFilter]);

    const openCreate = useCallback((): void => {
        setOperationError(null);
        setFormMode("CREATE");
        void loadReference();
    }, [loadReference]);

    const openEdit = useCallback((task: LiffRoutineTaskDetail): void => {
        if (!task.canEdit) return;
        setDeleteError(null);
        setFormMode("EDIT");
        void loadReference();
    }, [loadReference]);

    const handleTaskSaved = useCallback(
        async (savedTask: LiffRoutineTaskDetail, mode: LiffRoutineTaskFormMode): Promise<void> => {
            setFormMode(null);
            setOperationError(null);
            setOperationNotice(
                mode === "CREATE"
                    ? "สร้าง Routine ของฉันสำเร็จ กำลังอัปเดตรายการ"
                    : "บันทึกการแก้ไข Routine สำเร็จ กำลังอัปเดตรายการ",
            );
            setSelectedTaskId(savedTask.id);
            setDetail(savedTask);
            setDetailError(null);
            setDetailLoading(false);
            await refreshRoutineData();
        },
        [refreshRoutineData],
    );

    const handleDelete = useCallback(
        (task: LiffRoutineTaskDetail): void => {
            if (isDeleting || !task.canDelete) return;
            setIsDeleting(true);
            setDeleteError(null);
            void (async () => {
                try {
                    await deleteLiffRoutineTask(task.id);
                    setTasks((current) => current.filter((item) => item.id !== task.id));
                    setOperationNotice(`ลบงาน “${task.title}” สำเร็จ กำลังอัปเดตรายการ`);
                    setFocusedTaskId((current) => current === task.id ? null : current);
                    detailRequestIdRef.current += 1;
                    setSelectedTaskId(null);
                    setDetail(null);
                    setDetailError(null);
                    setFormMode(null);
                    await refreshRoutineData();
                } catch (error) {
                    if (isRecoveredLiffMutation(error)) {
                        setDeleteError(LIFF_SESSION_RECOVERED_MUTATION_MESSAGE);
                        setOperationNotice(LIFF_SESSION_RECOVERED_MUTATION_MESSAGE);
                        await refreshRoutineData(
                            `${LIFF_SESSION_RECOVERED_MUTATION_MESSAGE} แต่ยังโหลดรายการล่าสุดไม่ได้ กรุณาลองใหม่อีกครั้ง`,
                        );
                        try {
                            await reloadLatestTask(task.id);
                        } catch (reloadError) {
                            if (reloadError instanceof LiffApiError && reloadError.status === 404) {
                                setOperationNotice("งานนี้ไม่พบในสถานะล่าสุด กำลังปิดรายละเอียด");
                                setFocusedTaskId((current) => current === task.id ? null : current);
                                detailRequestIdRef.current += 1;
                                setSelectedTaskId(null);
                                setDetail(null);
                                setDetailError(null);
                                setDeleteError(null);
                            }
                        }
                    } else if (error instanceof LiffApiError && error.status === 404) {
                        setOperationNotice("งานนี้ถูกลบไปแล้ว กำลังโหลดรายการล่าสุด");
                        setFocusedTaskId((current) => current === task.id ? null : current);
                        detailRequestIdRef.current += 1;
                        setSelectedTaskId(null);
                        setDetail(null);
                        setDetailError(null);
                        await refreshRoutineData();
                    } else {
                        setDeleteError(toRoutineMutationError(error));
                    }
                } finally {
                    setIsDeleting(false);
                }
            })();
        },
        [isDeleting, refreshRoutineData, reloadLatestTask],
    );

    const handleDetailOpenChange = useCallback((open: boolean): void => {
        if (open) return;
        detailRequestIdRef.current += 1;
        setSelectedTaskId(null);
        setDetail(null);
        setFocusedTaskId(null);
        setDetailError(null);
        setDeleteError(null);
        setDetailLoading(false);
    }, []);

    if (state === "ERROR") {
        return (
            <ErrorState
                title="เปิด My Routine ไม่สำเร็จ"
                description={viewError ?? "กรุณาลองใหม่อีกครั้ง"}
                action={{ label: "ลองใหม่", onClick: () => void loadRoutine() }}
                className="min-h-[60svh] rounded-none border-0 bg-surface-subtle px-4 py-10"
            />
        );
    }

    if (state !== "READY" || !summary) {
        return (
            <LoadingState
                label="กำลังโหลดงาน Routine..."
                className="min-h-[60svh] rounded-none border-0 bg-surface-subtle px-4 py-10"
            />
        );
    }

    return (
        <>
            <main
                id="main"
                className="bg-surface-subtle px-[max(1rem,env(safe-area-inset-left))] pb-10 pt-5 pr-[max(1rem,env(safe-area-inset-right))] sm:pt-7"
            >
                <div className="mx-auto w-full max-w-lg space-y-5">
                    <header className="flex flex-col gap-4 border-b border-border-subtle pb-5 min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight text-content-heading sm:text-3xl">
                                งาน Routine ของฉัน
                            </h1>
                            <p className="text-sm leading-6 text-content-secondary">
                                ดูงานที่ได้รับมอบหมายและกำหนดส่งของคุณ
                            </p>
                        </div>
                        <Button
                            type="button"
                            onClick={openCreate}
                            className="min-h-11 w-full bg-brand-solid font-bold text-content-on-brand hover:bg-brand-solid-hover min-[420px]:w-auto"
                        >
                            <Plus className="size-4" aria-hidden="true" />
                            เพิ่ม Routine ของฉัน
                        </Button>
                    </header>

                    {operationNotice ? (
                        <div
                            role="status"
                            aria-live="polite"
                            className="rounded-md border border-status-success-border bg-status-success-surface px-4 py-3 text-sm leading-6 text-status-success-strong"
                        >
                            {operationNotice}
                        </div>
                    ) : null}
                    {operationError ? (
                        <div
                            role="alert"
                            className="rounded-md border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-strong"
                        >
                            {operationError}
                        </div>
                    ) : null}

                    <LiffRoutineSummaryView summary={summary} />
                    {focusNotice ? (
                        <div
                            role="status"
                            className="rounded-md border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-strong"
                        >
                            {focusNotice}
                        </div>
                    ) : null}
                    <LiffRoutineStatusFilter
                        value={selectedFilter}
                        onChange={(filter) => void handleFilterChange(filter)}
                    />
                    <LiffRoutineTaskList
                        tasks={tasks}
                        page={pagination.page}
                        pages={pagination.pages}
                        isLoading={isTaskLoading}
                        isFiltered={selectedFilter !== ""}
                        focusedTaskId={focusedTaskId}
                        onLoadMore={() => void handleLoadMore()}
                        onOpenTask={loadTaskDetail}
                    />
                </div>
                <p className="mx-auto mt-5 max-w-lg text-center text-xs text-content-muted sm:mt-6">
                    ข้อมูลสรุป ณ วันที่ {formatDate(summary.asOfDate)}
                </p>
            </main>

            <LiffRoutineTaskDetailView
                open={selectedTaskId !== null}
                detail={detail}
                loading={detailLoading}
                error={detailError}
                deleting={isDeleting}
                deleteError={deleteError}
                focusedOccurrenceId={focusedOccurrenceId}
                onOpenChange={handleDetailOpenChange}
                onRetry={retryTaskDetail}
                onEdit={openEdit}
                onDelete={handleDelete}
            />

            {formMode ? (
                <LiffRoutineTaskFormSurface
                    open
                    mode={formMode}
                    reference={reference}
                    referenceLoading={referenceState === "LOADING"}
                    referenceError={referenceError}
                    task={formMode === "EDIT" ? detail : null}
                    onOpenChange={(open) => {
                        if (!open) setFormMode(null);
                    }}
                    onRetryReference={() => void loadReference()}
                    onSaved={handleTaskSaved}
                    onReloadLatest={reloadLatestTask}
                    onAmbiguousSubmit={async () => {
                        await refreshRoutineData(
                            `${LIFF_SESSION_RECOVERED_MUTATION_MESSAGE} แต่ยังโหลดรายการล่าสุดไม่ได้ กรุณาลองใหม่อีกครั้ง`,
                        );
                    }}
                />
            ) : null}
        </>
    );
}
