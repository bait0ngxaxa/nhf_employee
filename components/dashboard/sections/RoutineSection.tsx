"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";

import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionShell } from "@/components/ui/section-shell";
import { SectionTabs, type SectionTabItem } from "@/components/ui/section-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { API_ROUTES } from "@/lib/ssot/routes";
import { isAdminRole } from "@/lib/ssot/permissions";
import type { RoutineTaskStatusFilter } from "@/lib/validations/routine";

import { RoutineKpiGrid } from "../routine/RoutineKpiGrid";
import { RoutineOccurrenceList } from "../routine/RoutineOccurrenceList";
import { RoutineTaskDialog } from "../routine/RoutineTaskDialog";
import { RoutineTaskList } from "../routine/RoutineTaskList";
import { RoutineImportPanel } from "../routine/RoutineImportPanel";
import { formatRoutineUnitLabel, uniqueRoutineUnits } from "../routine/labels";
import type {
    PaginatedRoutineTaskWorkItemsResponse,
    PaginatedTasksResponse,
    RoutineReferenceData,
    RoutineTimingStatus,
    RoutineSummaryResponse,
    RoutineTaskByIdResponse,
    RoutineTask,
} from "../routine/types";

async function fetchRoutine<T>(url: string): Promise<T> {
    const response = await fetch(url);
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
            throw new Error(body.error);
        }
        throw new Error("โหลดข้อมูลไม่สำเร็จ");
    }
    return body as T;
}

function RoutineOccurrencePanel({
    isAdmin,
    taskId,
    occurrenceId,
    onTaskSaved,
}: {
    isAdmin: boolean;
    taskId: number | null;
    occurrenceId: number | null;
    onTaskSaved: () => void;
}) {
    const [searchInput, setSearchInput] = useState("");
    const debouncedSearch = useDebouncedValue(searchInput);
    const [unitId, setUnitId] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [timingStatus, setTimingStatus] = useState<RoutineTimingStatus | "">("");
    const [page, setPage] = useState(1);
    const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
    const searchInputId = useId();
    const unitFilterId = useId();
    const categoryFilterId = useId();
    const timingFilterId = useId();
    const referenceErrorId = useId();
    const scope = isAdmin ? "all" : "mine";
    const key = useMemo(() => {
        const params = new URLSearchParams({
            scope,
            page: String(page),
            limit: "12",
            view: "tasks",
        });
        if (taskId !== null) params.set("taskId", String(taskId));
        if (occurrenceId !== null) params.set("occurrenceId", String(occurrenceId));
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (timingStatus) params.set("timingStatus", timingStatus);
        if (unitId) params.set("unitId", unitId);
        if (categoryId) params.set("categoryId", categoryId);
        return `${API_ROUTES.routines.occurrences}?${params.toString()}`;
    }, [categoryId, debouncedSearch, occurrenceId, page, scope, taskId, timingStatus, unitId]);
    const { data, error, isLoading, mutate } = useSWR<PaginatedRoutineTaskWorkItemsResponse, Error>(
        key,
        fetchRoutine,
        { keepPreviousData: true },
    );
    const {
        data: reference,
        error: referenceError,
        isLoading: referenceLoading,
        mutate: mutateReference,
    } = useSWR<RoutineReferenceData, Error>(
        API_ROUTES.routines.reference,
        fetchRoutine,
    );
    const {
        data: editingTaskData,
        error: editingTaskError,
        isLoading: editingTaskLoading,
        mutate: mutateEditingTask,
    } = useSWR<RoutineTaskByIdResponse, Error>(
        isAdmin && editingTaskId !== null
            ? API_ROUTES.routines.taskById(editingTaskId)
            : null,
        fetchRoutine,
    );

    useEffect(() => {
        setPage(1);
    }, [categoryId, debouncedSearch, occurrenceId, scope, taskId, timingStatus, unitId]);

    const filterUnits = uniqueRoutineUnits(reference?.units ?? []);
    const editingTask = editingTaskData?.task.id === editingTaskId
        ? editingTaskData.task
        : null;

    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-brand-strong">ติดตามรายการตามกำหนด</h2>
                <p className="max-w-prose text-sm leading-6 text-content-secondary">ค้นหารายการ ตรวจสถานะ และปรับเฉพาะรอบที่ต้องการได้จากหน้านี้</p>
            </div>
            <div className="grid gap-4 rounded-xl border border-brand-border/70 bg-transparent p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(16rem,1fr)_minmax(10rem,0.45fr)_minmax(10rem,0.45fr)_minmax(10rem,0.4fr)_auto] xl:items-end">
                <div className="grid min-w-0 gap-1 text-sm font-medium text-brand-strong sm:col-span-2 xl:col-span-1">
                    <label htmlFor={searchInputId}>ค้นหารายการ</label>
                    <div className="relative">
                        <Input
                            id={searchInputId}
                            type="search"
                            value={searchInput}
                            onChange={(event) => {
                                setSearchInput(event.target.value);
                                setPage(1);
                            }}
                            className="pr-12 sm:pr-10 [&::-webkit-search-cancel-button]:appearance-none"
                            placeholder="ค้นหาชื่อรายการ หน่วยงาน หรือหมวดหมู่"
                        />
                        {searchInput.trim().length > 0 ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setSearchInput("");
                                    setPage(1);
                                }}
                                className="absolute right-1.5 top-1/2 size-11 -translate-y-1/2 rounded-md text-content-muted hover:bg-surface-muted hover:text-content-body sm:size-7"
                                aria-label="ล้างคำค้นหารายการ Routine"
                            >
                                <X className="size-4" aria-hidden="true" />
                            </Button>
                        ) : null}
                    </div>
                </div>
                <label className="grid min-w-0 gap-1 text-sm font-medium text-brand-strong" htmlFor={unitFilterId}>
                    หน่วยงาน
                    <select
                        id={unitFilterId}
                        aria-describedby={referenceError ? referenceErrorId : undefined}
                        className="h-11 min-w-0 rounded-md border border-brand-border bg-surface-raised px-3 text-sm focus-visible:border-brand-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid/40 disabled:cursor-not-allowed disabled:opacity-50"
                        value={unitId}
                        disabled={!reference}
                        onChange={(event) => {
                            setUnitId(event.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">ทุกหน่วยงาน</option>
                        {filterUnits.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                                {formatRoutineUnitLabel(unit)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid min-w-0 gap-1 text-sm font-medium text-brand-strong" htmlFor={categoryFilterId}>
                    หมวดหมู่งาน
                    <select
                        id={categoryFilterId}
                        aria-describedby={referenceError ? referenceErrorId : undefined}
                        className="h-11 min-w-0 rounded-md border border-brand-border bg-surface-raised px-3 text-sm focus-visible:border-brand-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid/40 disabled:cursor-not-allowed disabled:opacity-50"
                        value={categoryId}
                        disabled={!reference}
                        onChange={(event) => {
                            setCategoryId(event.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">ทุกหมวดหมู่</option>
                        {reference?.categories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid min-w-0 gap-1 text-sm font-medium text-brand-strong" htmlFor={timingFilterId}>
                    ช่วงเวลา
                    <select
                        id={timingFilterId}
                        className="h-11 min-w-0 rounded-md border border-brand-border bg-surface-raised px-3 text-sm focus-visible:border-brand-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid/40"
                        value={timingStatus}
                        onChange={(event) => {
                            setTimingStatus(event.target.value as RoutineTimingStatus | "");
                            setPage(1);
                        }}
                    >
                        <option value="">ทุกช่วงเวลา</option>
                        <option value="DUE_TODAY">ถึงกำหนดวันนี้</option>
                        <option value="DUE_SOON">ใกล้ถึงกำหนด</option>
                        <option value="UPCOMING">ยังไม่ถึงกำหนด</option>
                    </select>
                </label>
                <Button type="button" variant="outline" className="border-brand-border text-brand-strong hover:bg-brand-surface-strong hover:text-brand-strong sm:justify-self-start xl:justify-self-end" onClick={() => void mutate()}>รีเฟรช</Button>
            </div>
            {referenceError ? (
                <div id={referenceErrorId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-foreground" role="alert">
                    <p>โหลดตัวเลือกหน่วยงานและหมวดหมู่งานไม่สำเร็จ</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => void mutateReference()}>
                        ลองโหลดตัวกรองอีกครั้ง
                    </Button>
                </div>
            ) : null}
            <RoutineOccurrenceList
                data={data}
                error={error}
                isLoading={isLoading}
                isAdmin={isAdmin}
                focusTaskId={taskId}
                focusOccurrenceId={occurrenceId}
                onRetry={() => void mutate()}
                onPageChange={setPage}
                onEditTask={setEditingTaskId}
                mutate={mutate}
                employees={reference?.employees ?? []}
            />
            <RoutineTaskDialog
                open={editingTaskId !== null}
                intent="edit"
                mode="ADMIN"
                reference={reference}
                task={editingTask}
                error={referenceError ?? editingTaskError}
                isLoading={referenceLoading || editingTaskLoading || editingTask === null}
                onRetry={() => {
                    void mutateReference();
                    void mutateEditingTask();
                }}
                onClose={() => setEditingTaskId(null)}
                onSaved={() => {
                    setEditingTaskId(null);
                    void mutateEditingTask();
                    void mutate();
                    onTaskSaved();
                }}
            />
        </div>
    );
}

function RoutineTaskSettings({
    mode,
    onTaskSaved,
}: {
    mode: "SELF_SERVICE" | "ADMIN";
    onTaskSaved: () => void;
}) {
    const isSelfService = mode === "SELF_SERVICE";
    const [isCreating, setIsCreating] = useState(false);
    const [editingTask, setEditingTask] = useState<RoutineTask | null>(null);
    const [taskPage, setTaskPage] = useState(1);
    const [taskSearch, setTaskSearch] = useState("");
    const [taskUnitId, setTaskUnitId] = useState("");
    const [taskCategoryId, setTaskCategoryId] = useState("");
    const [taskStatus, setTaskStatus] = useState<RoutineTaskStatusFilter | "">("");
    const debouncedTaskSearch = useDebouncedValue(taskSearch);
    const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);
    const activeMutationLockRef = useRef<Set<number>>(new Set());
    const {
        data: reference,
        error: referenceError,
        isLoading: referenceLoading,
        mutate: mutateReference,
    } = useSWR<RoutineReferenceData, Error>(API_ROUTES.routines.reference, fetchRoutine);
    const tasksKey = useMemo(() => {
        const params = new URLSearchParams({
            activeOnly: "0",
            page: String(taskPage),
            limit: "20",
        });
        if (debouncedTaskSearch.trim()) params.set("search", debouncedTaskSearch.trim());
        if (taskUnitId) params.set("unitId", taskUnitId);
        if (taskCategoryId) params.set("categoryId", taskCategoryId);
        if (taskStatus) params.set("status", taskStatus);
        return `${API_ROUTES.routines.tasks}?${params.toString()}`;
    }, [debouncedTaskSearch, taskCategoryId, taskPage, taskStatus, taskUnitId]);
    const { data: tasks, error: tasksError, isLoading: tasksLoading, mutate: mutateTasks } = useSWR<PaginatedTasksResponse, Error>(
        tasksKey,
        fetchRoutine,
        { keepPreviousData: true },
    );

    async function updateTaskActive(task: RoutineTask): Promise<void> {
        if (activeMutationLockRef.current.has(task.id)) return;
        activeMutationLockRef.current.add(task.id);
        setPendingTaskId(task.id);
        try {
            const response = await fetch(API_ROUTES.routines.taskById(task.id), {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ version: task.version, isActive: !task.isActive }),
            });
            const body: unknown = await response.json().catch(() => null);
            if (!response.ok) throw new Error(
                typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
                    ? body.error
                    : "อัปเดตสถานะ Routine ไม่สำเร็จ",
            );
            toast.success(task.isActive ? "ปิดใช้งาน Routine สำเร็จ" : "เปิดใช้งาน Routine สำเร็จ");
            await mutateTasks();
        } catch (error) {
            const message = error instanceof Error ? error.message : "อัปเดตสถานะ Routine ไม่สำเร็จ";
            toast.error(message);
        } finally {
            activeMutationLockRef.current.delete(task.id);
            setPendingTaskId(null);
        }
    }

    async function deleteTask(task: RoutineTask): Promise<void> {
        try {
            const response = await fetch(API_ROUTES.routines.taskById(task.id), {
                method: "DELETE",
            });
            const body: unknown = await response.json().catch(() => null);
            if (!response.ok) throw new Error(
                typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
                    ? body.error
                    : "ลบรายการ Routine ไม่สำเร็จ",
            );
            toast.success("ลบรายการ Routine สำเร็จ");
            await mutateTasks();
        } catch (error) {
            const message = error instanceof Error ? error.message : "ลบรายการ Routine ไม่สำเร็จ";
            toast.error(message);
            throw error;
        }
    }

    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-brand-strong">{isSelfService ? "จัดการงานของฉัน" : "ตั้งค่าแม่แบบงานประจำ"}</h2>
                <p className="max-w-prose text-sm leading-6 text-content-secondary">{isSelfService ? "สร้างและจัดการเฉพาะแม่แบบงาน Routine ที่คุณสร้างไว้" : "กำหนดตารางงาน ผู้รับผิดชอบ และการแจ้งเตือนของแต่ละแม่แบบ"}</p>
            </div>
            <RoutineTaskList
                data={tasks}
                error={tasksError}
                isAdmin={!isSelfService}
                isLoading={tasksLoading}
                onRetry={() => void mutateTasks()}
                onCreate={() => setIsCreating(true)}
                onEdit={(task) => setEditingTask(task)}
                onToggleActive={updateTaskActive}
                onDelete={deleteTask}
                pendingTaskId={pendingTaskId}
                onPageChange={setTaskPage}
                units={reference?.units ?? []}
                categories={reference?.categories ?? []}
                search={taskSearch}
                unitId={taskUnitId}
                categoryId={taskCategoryId}
                status={taskStatus}
                onSearchChange={(value) => {
                    setTaskSearch(value);
                    setTaskPage(1);
                }}
                onUnitChange={(value) => {
                    setTaskUnitId(value);
                    setTaskPage(1);
                }}
                onCategoryChange={(value) => {
                    setTaskCategoryId(value);
                    setTaskPage(1);
                }}
                onStatusChange={(value) => {
                    setTaskStatus(value);
                    setTaskPage(1);
                }}
            />
            <RoutineTaskDialog
                open={isCreating || editingTask !== null}
                intent={editingTask ? "edit" : "create"}
                mode={mode}
                reference={reference}
                task={editingTask}
                error={referenceError}
                isLoading={referenceLoading || !reference}
                onRetry={() => void mutateReference()}
                onClose={() => {
                    setIsCreating(false);
                    setEditingTask(null);
                }}
                onSaved={() => {
                    setIsCreating(false);
                    setEditingTask(null);
                    void mutateTasks();
                    onTaskSaved();
                }}
            />
        </div>
    );
}

export function RoutineSection() {
    const { user } = useDashboardDataContext();
    const isAdmin = isAdminRole(user?.role);
    const searchParams = useSearchParams();
    const taskIdValue = Number(searchParams.get("taskId"));
    const taskId = Number.isInteger(taskIdValue) && taskIdValue > 0
        ? taskIdValue
        : null;
    const occurrenceIdValue = Number(searchParams.get("occurrenceId"));
    const occurrenceId = Number.isInteger(occurrenceIdValue) && occurrenceIdValue > 0
        ? occurrenceIdValue
        : null;
    const [activeTab, setActiveTab] = useState("mine");
    const [summaryScope, setSummaryScope] = useState<"mine" | "all">("mine");
    const safeTab = isAdmin
        ? activeTab
        : activeTab === "manage"
            ? "manage"
            : "mine";
    useEffect(() => {
        if (safeTab === "mine") setSummaryScope("mine");
        if (safeTab === "all" && isAdmin) setSummaryScope("all");
    }, [isAdmin, safeTab]);
    const summaryKey = `${API_ROUTES.routines.summary}?scope=${summaryScope}`;
    const {
        data: summaryData,
        error: summaryError,
        isLoading: summaryLoading,
        mutate: mutateSummary,
    } = useSWR<RoutineSummaryResponse, Error>(summaryKey, fetchRoutine, {
        keepPreviousData: true,
    });

    useEffect(() => {
        if (isAdmin && (taskId !== null || occurrenceId !== null)) setActiveTab("all");
    }, [isAdmin, occurrenceId, taskId]);

    useEffect(() => {
        const requestedTab = searchParams.get("routineTab");
        if (
            requestedTab === "mine"
            || (!isAdmin && requestedTab === "manage")
            || (isAdmin && (requestedTab === "all" || requestedTab === "settings" || requestedTab === "import"))
        ) {
            setActiveTab(requestedTab);
        }
    }, [isAdmin, searchParams]);

    const tabs: SectionTabItem[] = [
        {
            value: "mine",
            label: "รายการของฉัน",
            content: <RoutineOccurrencePanel isAdmin={false} taskId={taskId} occurrenceId={occurrenceId} onTaskSaved={() => undefined} />,
        },
        {
            value: "all",
            label: "รายการทั้งหมด (Admin)",
            visible: isAdmin,
            content: <RoutineOccurrencePanel isAdmin taskId={taskId} occurrenceId={occurrenceId} onTaskSaved={() => void mutateSummary()} />,
        },
        {
            value: "manage",
            label: "จัดการงานของฉัน",
            visible: !isAdmin,
            content: <RoutineTaskSettings mode="SELF_SERVICE" onTaskSaved={() => void mutateSummary()} />,
        },
        {
            value: "settings",
            label: "ตั้งค่างานประจำ",
            visible: isAdmin,
            content: <RoutineTaskSettings mode="ADMIN" onTaskSaved={() => void mutateSummary()} />,
        },
        {
            value: "import",
            label: "นำเข้าจาก Excel",
            visible: isAdmin,
            content: <RoutineImportPanel />,
        },
    ];

    return (
        <SectionShell className="routine-section border-brand-border/70 bg-surface shadow-sm lg:rounded-2xl">
            <SectionHeader
                title="NHF Routine"
                subtitle="รวมรายการ Routine ตามกำหนดเวลา ผู้รับผิดชอบ และการแจ้งเตือนที่เกี่ยวข้อง"
            />
            <RoutineKpiGrid
                summary={summaryData?.summary}
                isLoading={summaryLoading && !summaryData}
            />
            {summaryError ? <p className="text-sm text-status-danger-foreground" role="alert">โหลดสรุปรายการไม่สำเร็จ: {summaryError.message}</p> : null}
            <SectionTabs
                value={safeTab}
                onValueChange={setActiveTab}
                tabs={tabs}
                activeColor="var(--brand-tab)"
                listClassName="border-brand-border/70 bg-transparent"
                ariaLabel="แท็บ NHF Routine"
            />
        </SectionShell>
    );
}
