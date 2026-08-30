"use client";

import { useSearchParams } from "next/navigation";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactElement,
} from "react";

import { ErrorState, LoadingState } from "@/components/ui/state";
import { LiffApiError } from "@/lib/client/liff";
import {
    fetchLiffRoutineSummary,
    fetchLiffRoutineTasks,
    type LiffRoutineSummary,
    type LiffRoutineTaskWorkItem,
    type LiffRoutineTasksResponse,
    type LiffRoutineTimingFilter,
} from "@/lib/client/liff-routine";
import { formatDate } from "@/lib/helpers/date-helpers";

import { LiffRoutineStatusFilter } from "./LiffRoutineStatusFilter";
import { LiffRoutineSummary as LiffRoutineSummaryView } from "./LiffRoutineSummary";
import { LiffRoutineTaskList } from "./LiffRoutineTaskList";

type LiffRoutineState = "LOADING" | "READY" | "ERROR";

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
    const taskRequestIdRef = useRef(0);

    const loadRoutine = useCallback(async (): Promise<void> => {
        setState("LOADING");
        setViewError(null);
        setSummary(null);
        setTasks([]);
        setPagination(initialPagination());
        setFocusedTaskId(null);
        setFocusNotice(null);

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
            setViewError(toRoutineViewError(error));
            setState("ERROR");
        }
    }, [initialFocusOccurrenceId, initialFocusTaskId]);

    useEffect(() => {
        void loadRoutine();
    }, [loadRoutine]);

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
        <main
            id="main"
            className="bg-surface-subtle px-[max(1rem,env(safe-area-inset-left))] pb-8 pt-6 pr-[max(1rem,env(safe-area-inset-right))] sm:pt-8"
        >
            <div className="mx-auto w-full max-w-lg space-y-4 sm:space-y-5">
                <header className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-content-heading sm:text-3xl">
                        งาน Routine ของฉัน
                    </h1>
                    <p className="text-sm leading-6 text-content-secondary">
                        ดูงานที่ได้รับมอบหมายและกำหนดส่งของคุณ
                    </p>
                </header>

                <LiffRoutineSummaryView summary={summary} />
                {focusNotice ? (
                    <div
                        role="status"
                        className="rounded-2xl border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-strong"
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
                />
            </div>
            <p className="mx-auto mt-5 max-w-lg text-center text-xs text-content-muted sm:mt-6">
                ข้อมูลสรุป ณ วันที่ {formatDate(summary.asOfDate)}
            </p>
        </main>
    );
}
