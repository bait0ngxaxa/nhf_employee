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
    fetchLiffHome,
    isRecoveredLiffMutation,
    LIFF_SESSION_RECOVERED_MUTATION_MESSAGE,
    LiffApiError,
    type LiffHomeResponse,
} from "@/modules/line/client";
import { LiffModuleLanding } from "@/components/liff/LiffModuleLanding";
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
} from "./api";
import { formatDate } from "@/lib/helpers/date-helpers";

import { LiffRoutineStatusFilter } from "./LiffRoutineStatusFilter";
import { LiffRoutineSummary as LiffRoutineSummaryView } from "./LiffRoutineSummary";
import { LiffRoutineTaskDetail as LiffRoutineTaskDetailView } from "./LiffRoutineTaskDetail";
import {
    LiffRoutineTaskFormSurface,
} from "./LiffRoutineTaskFormSurface";
import type { LiffRoutineTaskFormMode } from "./LiffRoutineTaskForm";
import { LiffRoutineTaskList } from "./LiffRoutineTaskList";

type LiffRoutineState = "LOADING" | "READY" | "ERROR" | "UNAVAILABLE";
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

function hasRoutineReadAccess(home: LiffHomeResponse | null): boolean {
    return home?.modules.routine.enabled === true
        && home.capabilities.routineCapabilities.canReadTasks === true;
}

export function LiffRoutineApp(): ReactElement {
    const searchParams = useSearchParams();
    const initialRoutineFocus = getRoutineFocus(searchParams);
    const initialFocusTaskId = initialRoutineFocus?.taskId ?? null;
    const initialFocusOccurrenceId = initialRoutineFocus?.occurrenceId ?? null;
    const [state, setState] = useState<LiffRoutineState>("LOADING");
    const [home, setHome] = useState<LiffHomeResponse | null>(null);
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
    const routineCapabilities = home?.capabilities.routineCapabilities;
    const canReadTasks = routineCapabilities?.canReadTasks === true;
    const canCreateTasks = routineCapabilities?.canCreateTasks === true;
    const canUpdateTasks = routineCapabilities?.canUpdateTasks === true;
    const canDeleteTasks = routineCapabilities?.canDeleteTasks === true;
    const routineReadAvailable = hasRoutineReadAccess(home);

    useEffect(() => () => {
        routineRequestIdRef.current += 1;
        taskRequestIdRef.current += 1;
        detailRequestIdRef.current += 1;
        referenceRequestIdRef.current += 1;
    }, []);

    useEffect(() => {
        if (
            formMode === "CREATE"
            && (!routineReadAvailable || !canCreateTasks)
        ) {
            setFormMode(null);
        }
        if (
            formMode === "EDIT"
            && (!routineReadAvailable || !canUpdateTasks || detail?.canEdit !== true)
        ) {
            setFormMode(null);
        }
        if (!routineReadAvailable || !canDeleteTasks) {
            setDeleteError(null);
        }
    }, [canCreateTasks, canDeleteTasks, canUpdateTasks, detail?.canEdit, formMode, routineReadAvailable]);

    const loadRoutine = useCallback(async (): Promise<void> => {
        const requestId = routineRequestIdRef.current + 1;
        routineRequestIdRef.current = requestId;
        taskRequestIdRef.current += 1;
        detailRequestIdRef.current += 1;
        setState("LOADING");
        setViewError(null);
        setHome(null);
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
        setFormMode(null);

        try {
            const homeResponse = await fetchLiffHome();
            if (requestId !== routineRequestIdRef.current) return;
            setHome(homeResponse);
            if (!hasRoutineReadAccess(homeResponse)) {
                setState("UNAVAILABLE");
                return;
            }

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

    const loadReference = useCallback(async (
        mode: LiffRoutineTaskFormMode,
        task: LiffRoutineTaskDetail | null,
    ): Promise<void> => {
        const actionAllowed = mode === "CREATE"
            ? canCreateTasks
            : canUpdateTasks && task?.canEdit === true;
        if (!routineReadAvailable || !actionAllowed) return;
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
    }, [canCreateTasks, canUpdateTasks, reference, referenceState, routineReadAvailable]);

    const loadTaskDetail = useCallback((taskId: number): void => {
        if (!routineReadAvailable || !canReadTasks) return;
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
    }, [canReadTasks, routineReadAvailable]);

    const retryTaskDetail = useCallback((): void => {
        if (selectedTaskId === null) return;
        loadTaskDetail(selectedTaskId);
    }, [loadTaskDetail, selectedTaskId]);

    const reloadLatestTask = useCallback(
        async (taskId: number): Promise<LiffRoutineTaskDetail> => {
            if (!routineReadAvailable || !canReadTasks || !canUpdateTasks) {
                throw new Error("Routine access is no longer available");
            }
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
        [canReadTasks, canUpdateTasks, routineReadAvailable],
    );

    const handleFilterChange = useCallback(
        async (filter: LiffRoutineTimingFilter): Promise<void> => {
            if (state !== "READY" || !routineReadAvailable || !canReadTasks) return;
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
        [canReadTasks, routineReadAvailable, state],
    );

    const handleLoadMore = useCallback(async (): Promise<void> => {
        if (
            state !== "READY"
            || !routineReadAvailable
            || !canReadTasks
            || isTaskLoading
            || pagination.page >= pagination.pages
        ) {
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
    }, [canReadTasks, isTaskLoading, pagination, routineReadAvailable, selectedFilter, state]);

    const refreshRoutineData = useCallback(async (
        refreshFailureMessage = "บันทึกสำเร็จ แต่โหลดรายการ Routine ล่าสุดไม่ได้ กรุณาลองใหม่อีกครั้ง",
    ): Promise<boolean> => {
        if (!routineReadAvailable || !canReadTasks) return false;
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
    }, [canReadTasks, routineReadAvailable, selectedFilter]);

    const openCreate = useCallback((): void => {
        if (!routineReadAvailable || !canCreateTasks) {
            setFormMode(null);
            return;
        }
        setOperationError(null);
        setFormMode("CREATE");
        void loadReference("CREATE", null);
    }, [canCreateTasks, loadReference, routineReadAvailable]);

    const openEdit = useCallback((task: LiffRoutineTaskDetail): void => {
        if (!routineReadAvailable || !canUpdateTasks || !task.canEdit) {
            setFormMode(null);
            return;
        }
        setDeleteError(null);
        setFormMode("EDIT");
        void loadReference("EDIT", task);
    }, [canUpdateTasks, loadReference, routineReadAvailable]);

    const handleTaskSaved = useCallback(
        async (savedTask: LiffRoutineTaskDetail, mode: LiffRoutineTaskFormMode): Promise<void> => {
            const actionAllowed = mode === "CREATE" ? canCreateTasks : canUpdateTasks;
            if (!routineReadAvailable || !actionAllowed) {
                setFormMode(null);
                return;
            }
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
        [canCreateTasks, canUpdateTasks, refreshRoutineData, routineReadAvailable],
    );

    const handleDelete = useCallback(
        (task: LiffRoutineTaskDetail): void => {
            if (
                isDeleting
                || !routineReadAvailable
                || !canDeleteTasks
                || !task.canDelete
            ) return;
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
        [canDeleteTasks, isDeleting, refreshRoutineData, reloadLatestTask, routineReadAvailable],
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

    if (state === "UNAVAILABLE") {
        return <LiffModuleLanding module="routine" enabled={false} />;
    }

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
                label="กำลังโหลดงาน Routine…"
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
                        {canCreateTasks ? (
                            <Button
                                type="button"
                                onClick={openCreate}
                                className="min-h-11 w-full bg-brand-solid font-bold text-content-on-brand hover:bg-brand-solid-hover min-[420px]:w-auto"
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                เพิ่ม Routine ของฉัน
                            </Button>
                        ) : null}
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
                canUpdateTasks={canUpdateTasks}
                canDeleteTasks={canDeleteTasks}
                focusedOccurrenceId={focusedOccurrenceId}
                onOpenChange={handleDetailOpenChange}
                onRetry={retryTaskDetail}
                onEdit={openEdit}
                onDelete={handleDelete}
            />

            {formMode && (
                formMode === "CREATE"
                    ? canCreateTasks
                    : canUpdateTasks && detail?.canEdit === true
            ) ? (
                <LiffRoutineTaskFormSurface
                    open
                    mode={formMode}
                    canCreateTasks={canCreateTasks}
                    canUpdateTasks={canUpdateTasks}
                    reference={reference}
                    referenceLoading={referenceState === "LOADING"}
                    referenceError={referenceError}
                    task={formMode === "EDIT" ? detail : null}
                    onOpenChange={(open) => {
                        if (!open) setFormMode(null);
                    }}
                    onRetryReference={() => void loadReference(
                        formMode,
                        formMode === "EDIT" ? detail : null,
                    )}
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
