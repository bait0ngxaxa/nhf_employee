"use client";

import liff from "@line/liff";
import { useSearchParams } from "next/navigation";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactElement,
} from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { formatDate } from "@/lib/helpers/date-helpers";
import {
    establishLiffSession,
    fetchLiffRoutineSummary,
    fetchLiffRoutineTasks,
    LiffApiError,
    linkLiffAccount,
    type LiffRoutineSummary,
    type LiffRoutineTaskWorkItem,
    type LiffRoutineTasksResponse,
    type LiffRoutineTimingFilter,
} from "@/lib/client/liff-routine";
import { APP_ROUTES } from "@/lib/ssot/routes";

import { LiffRoutineStatusFilter } from "./LiffRoutineStatusFilter";
import { LiffRoutineSummary as LiffRoutineSummaryView } from "./LiffRoutineSummary";
import { LiffRoutineTaskList } from "./LiffRoutineTaskList";

type LiffBootstrapState =
    | "INITIALIZING"
    | "LINE_AUTHENTICATING"
    | "SESSION_ESTABLISHING"
    | "LINK_REQUIRED"
    | "LINKING"
    | "LOADING_ROUTINE"
    | "READY"
    | "ERROR";

type LiffErrorAction = "retry" | "login";

interface LiffViewError {
    message: string;
    action: LiffErrorAction;
}

const LIFF_TASK_PAGE_SIZE = 12;
const LINE_LOGIN_NOT_COMPLETED = "LINE_LOGIN_NOT_COMPLETED";

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

function buildNhfLoginUrl(): string {
    const currentUrl = new URL(window.location.href);
    const focus = getRoutineFocus(currentUrl.searchParams);
    const returnParams = new URLSearchParams({
        link: "1",
        loginReturn: "1",
    });
    if (focus) {
        returnParams.set("taskId", String(focus.taskId));
        returnParams.set("occurrenceId", String(focus.occurrenceId));
    }
    const returnTo = `${APP_ROUTES.line.routine}?${returnParams.toString()}`;
    const params = new URLSearchParams({ returnTo });
    return `${APP_ROUTES.login}?${params.toString()}`;
}

function redirectToNhfLogin(): void {
    window.location.assign(buildNhfLoginUrl());
}

function clearLinkIntentFromUrl(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete("link");
    url.searchParams.delete("loginReturn");
    window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
    );
}

function clearLineLoginMarkerFromUrl(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete("lineLogin");
    window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
    );
}

function buildLineLoginRedirectUri(): string {
    const url = new URL(window.location.href);
    url.searchParams.set("lineLogin", "1");
    return url.toString();
}

function toViewError(error: unknown): LiffViewError {
    if (error instanceof Error && error.message === LINE_LOGIN_NOT_COMPLETED) {
        return {
            message: "การเข้าสู่ระบบ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
            action: "retry",
        };
    }
    if (error instanceof LiffApiError) {
        return {
            message: error.message,
            action: "retry",
        };
    }

    return {
        message: "ไม่สามารถเปิด My Routine ได้ กรุณาลองใหม่อีกครั้ง",
        action: "retry",
    };
}

function loadingLabel(state: LiffBootstrapState): string {
    switch (state) {
        case "INITIALIZING":
            return "กำลังเตรียมหน้า My Routine...";
        case "LINE_AUTHENTICATING":
            return "กำลังยืนยันตัวตนกับ LINE...";
        case "SESSION_ESTABLISHING":
            return "กำลังเตรียมสิทธิ์การเข้าถึง...";
        case "LINKING":
            return "กำลังเชื่อมบัญชี NHF...";
        case "LOADING_ROUTINE":
            return "กำลังโหลดงาน Routine...";
        default:
            return "กำลังโหลดข้อมูล...";
    }
}

function initialPagination(): LiffRoutineTasksResponse["pagination"] {
    return { page: 1, limit: LIFF_TASK_PAGE_SIZE, total: 0, pages: 0 };
}

function LinkRequiredView({ onConnect }: { onConnect: () => void }): ReactElement {
    return (
        <main className="min-h-svh bg-surface-subtle px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6">
            <div className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-lg items-center">
                <Card className="w-full gap-5 rounded-3xl border-brand-border bg-surface-raised p-6 shadow-sm sm:p-8">
                    <div className="space-y-2">
                        <p className="text-sm font-semibold tracking-wide text-brand-foreground">
                            NHF Routine
                        </p>
                        <h1 className="text-2xl font-bold tracking-tight text-content-heading">
                            เชื่อมบัญชี NHF
                        </h1>
                        <p className="text-sm leading-6 text-content-secondary">
                            เชื่อมบัญชี LINE กับบัญชีพนักงาน NHF เพียงครั้งแรก
                            เพื่อดูงาน Routine ของคุณผ่าน LINE
                        </p>
                    </div>
                    <Button
                        type="button"
                        onClick={onConnect}
                        className="min-h-12 w-full rounded-xl bg-gradient-to-r from-action-gradient-start to-action-gradient-end text-base font-semibold text-content-on-brand hover:from-action-gradient-hover-start hover:to-action-gradient-hover-end"
                    >
                        เชื่อมบัญชี NHF
                    </Button>
                </Card>
            </div>
        </main>
    );
}

export function LiffRoutineApp(): ReactElement {
    const searchParams = useSearchParams();
    const initialRoutineFocus = getRoutineFocus(searchParams);
    const initialFocusTaskId = initialRoutineFocus?.taskId ?? null;
    const initialFocusOccurrenceId = initialRoutineFocus?.occurrenceId ?? null;
    const linkIntent = searchParams.get("link") === "1";
    const returnedFromLogin = searchParams.get("loginReturn") === "1";
    const lineLoginAttempted = searchParams.get("lineLogin") === "1";
    const [state, setState] = useState<LiffBootstrapState>("INITIALIZING");
    const [viewError, setViewError] = useState<LiffViewError | null>(null);
    const [summary, setSummary] = useState<LiffRoutineSummary | null>(null);
    const [tasks, setTasks] = useState<LiffRoutineTaskWorkItem[]>([]);
    const [pagination, setPagination] = useState(initialPagination);
    const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);
    const [focusNotice, setFocusNotice] = useState<string | null>(null);
    const [selectedFilter, setSelectedFilter] = useState<LiffRoutineTimingFilter>("");
    const [isTaskLoading, setIsTaskLoading] = useState(false);
    const bootstrapInFlightRef = useRef(false);
    const lineLoginAttemptedRef = useRef(lineLoginAttempted);
    const taskRequestIdRef = useRef(0);

    useEffect(() => {
        lineLoginAttemptedRef.current = lineLoginAttempted;
    }, [lineLoginAttempted]);

    const bootstrap = useCallback(async (): Promise<void> => {
        if (bootstrapInFlightRef.current) return;
        bootstrapInFlightRef.current = true;
        setState("INITIALIZING");
        setViewError(null);
        setSummary(null);
        setTasks([]);
        setPagination(initialPagination());
        setFocusedTaskId(null);
        setFocusNotice(null);

        try {
            const liffId = process.env.NEXT_PUBLIC_LINE_ROUTINE_LIFF_ID?.trim();
            if (!liffId) {
                throw new Error("LIFF ID is not configured");
            }

            await liff.init({ liffId });
            const restoredSearchParams = new URL(window.location.href).searchParams;
            const restoredRoutineFocus = getRoutineFocus(restoredSearchParams);
            const focusTaskId = restoredRoutineFocus?.taskId ?? initialFocusTaskId;
            const focusOccurrenceId = restoredRoutineFocus?.occurrenceId
                ?? initialFocusOccurrenceId;
            const effectiveLinkIntent =
                restoredSearchParams.get("link") === "1" || linkIntent;
            const effectiveReturnedFromLogin =
                restoredSearchParams.get("loginReturn") === "1"
                || returnedFromLogin;

            if (!liff.isLoggedIn()) {
                if (lineLoginAttemptedRef.current) {
                    throw new Error(LINE_LOGIN_NOT_COMPLETED);
                }
                setState("LINE_AUTHENTICATING");
                liff.login({
                    redirectUri: buildLineLoginRedirectUri(),
                });
                return;
            }

            if (lineLoginAttemptedRef.current) {
                clearLineLoginMarkerFromUrl();
            }

            const idToken = liff.getIDToken();
            if (!idToken) {
                throw new Error("LINE ID token is unavailable");
            }

            if (effectiveLinkIntent) {
                setState("LINKING");
                try {
                    await linkLiffAccount(idToken);
                } catch (error) {
                    if (
                        error instanceof LiffApiError
                        && error.status === 401
                    ) {
                        if (!effectiveReturnedFromLogin) {
                            setViewError({
                                message: "กรุณาเข้าสู่ระบบ NHF ก่อนเชื่อมบัญชี",
                                action: "login",
                            });
                            setState("ERROR");
                            redirectToNhfLogin();
                            return;
                        }
                        setViewError({
                            message: "ยังไม่พบการเข้าสู่ระบบ NHF กรุณาเข้าสู่ระบบอีกครั้ง",
                            action: "login",
                        });
                        setState("ERROR");
                        return;
                    }
                    throw error;
                }
                clearLinkIntentFromUrl();
            } else {
                setState("SESSION_ESTABLISHING");
                const session = await establishLiffSession(idToken);
                if (!session.linked) {
                    setState("LINK_REQUIRED");
                    return;
                }
            }

            setState("LOADING_ROUTINE");
            const focusedTasksPromise = focusTaskId !== null
                && focusOccurrenceId !== null
                ? fetchLiffRoutineTasks({
                      page: 1,
                      limit: 1,
                      taskId: focusTaskId,
                      occurrenceId: focusOccurrenceId,
                  })
                : Promise.resolve(null);
            const [summaryResponse, tasksResponse, focusedTasksResponse] = await Promise.all([
                fetchLiffRoutineSummary(),
                fetchLiffRoutineTasks({
                    page: 1,
                    limit: LIFF_TASK_PAGE_SIZE,
                }),
                focusedTasksPromise,
            ]);
            let initialTasks = tasksResponse.tasks;
            if (
                focusTaskId !== null
                && focusOccurrenceId !== null
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
                        ...tasksResponse.tasks.filter((task) => task.id !== focusedTask.id),
                    ];
                }
            }
            setSummary(summaryResponse.summary);
            setTasks(initialTasks);
            setPagination(tasksResponse.pagination);
            setState("READY");
        } catch (error) {
            setViewError(toViewError(error));
            setState("ERROR");
        } finally {
            bootstrapInFlightRef.current = false;
        }
    }, [
        linkIntent,
        returnedFromLogin,
        initialFocusOccurrenceId,
        initialFocusTaskId,
    ]);

    useEffect(() => {
        void bootstrap();
    }, [bootstrap]);

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
                setViewError(toViewError(error));
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
            setViewError(toViewError(error));
            setState("ERROR");
        } finally {
            if (requestId === taskRequestIdRef.current) {
                setIsTaskLoading(false);
            }
        }
    }, [isTaskLoading, pagination, selectedFilter, state]);

    const retryBootstrap = useCallback((): void => {
        if (lineLoginAttemptedRef.current) {
            lineLoginAttemptedRef.current = false;
            clearLineLoginMarkerFromUrl();
        }
        void bootstrap();
    }, [bootstrap]);

    if (state === "LINK_REQUIRED") {
        return <LinkRequiredView onConnect={redirectToNhfLogin} />;
    }

    if (state === "ERROR") {
        const errorAction = viewError?.action === "login"
            ? { label: "เข้าสู่ระบบ NHF", onClick: redirectToNhfLogin }
            : { label: "ลองใหม่", onClick: retryBootstrap };
        return (
            <ErrorState
                title="เปิด My Routine ไม่สำเร็จ"
                description={viewError?.message ?? "กรุณาลองใหม่อีกครั้ง"}
                action={errorAction}
                className="min-h-svh rounded-none border-0 bg-surface-subtle px-4 py-10"
            />
        );
    }

    if (state !== "READY" || !summary) {
        return (
            <LoadingState
                label={loadingLabel(state)}
                className="min-h-svh rounded-none border-0 bg-surface-subtle px-4 py-10"
            />
        );
    }

    return (
        <main className="min-h-svh bg-surface-subtle px-4 py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
            <div className="mx-auto w-full max-w-lg space-y-5">
                <header className="space-y-1">
                    <p className="text-sm font-semibold tracking-wide text-brand-foreground">
                        NHF Routine
                    </p>
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
            <p className="mx-auto mt-6 max-w-lg text-center text-xs text-content-muted">
                ข้อมูลสรุป ณ วันที่ {formatDate(summary.asOfDate)}
            </p>
        </main>
    );
}
