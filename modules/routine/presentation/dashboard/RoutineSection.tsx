"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Edit3, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { KeyedMutator } from "swr";

import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionShell } from "@/components/ui/section-shell";
import { SectionTabs, type SectionTabItem } from "@/components/ui/section-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { API_ROUTES } from "@/lib/ssot/routes";
import { triggerDownload } from "@/lib/helpers/download";
import type { RoutineTaskStatusFilter } from "../../schemas/routine";

import { RoutineKpiGrid } from "./RoutineKpiGrid";
import { RoutineOccurrenceList } from "./RoutineOccurrenceList";
import { RoutineTaskDialog } from "./RoutineTaskDialog";
import { RoutineTaskList } from "./RoutineTaskList";
import { RoutineImportPanel } from "./RoutineImportPanel";
import { formatRoutineUnitLabel, uniqueRoutineUnits } from "./labels";
import type { RoutinePresentationCapabilities } from "../../application/types";
import type {
    PaginatedRoutineTaskWorkItemsResponse,
    PaginatedTasksResponse,
    RoutineReferenceData,
    RoutineTimingStatus,
    RoutineSummaryResponse,
    RoutineTaskByIdResponse,
    RoutineTask,
} from "./types";

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
    canReadImportMetadata,
    currentEmployeeId,
    routineCapabilities,
    scope,
    taskId,
    occurrenceId,
    onTaskSaved,
    summary,
    summaryError,
    summaryLoading,
}: {
    canReadImportMetadata: boolean;
    currentEmployeeId?: number;
    routineCapabilities?: RoutinePresentationCapabilities;
    scope: "mine" | "all";
    taskId: number | null;
    occurrenceId: number | null;
    onTaskSaved: () => void;
    summary: RoutineSummaryResponse["summary"] | undefined;
    summaryError: Error | undefined;
    summaryLoading: boolean;
}) {
    const [searchInput, setSearchInput] = useState("");
    const debouncedSearch = useDebouncedValue(searchInput);
    const [unitId, setUnitId] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [timingStatus, setTimingStatus] = useState<RoutineTimingStatus | "">("");
    const [page, setPage] = useState(1);
    const queryIdentity = JSON.stringify([
        scope,
        taskId,
        occurrenceId,
        debouncedSearch,
        unitId,
        categoryId,
        timingStatus,
    ]);
    const [paginationQueryIdentity, setPaginationQueryIdentity] = useState(queryIdentity);
    if (paginationQueryIdentity !== queryIdentity) {
        setPaginationQueryIdentity(queryIdentity);
        if (page !== 1) {
            setPage(1);
        }
    }
    const searchInputId = useId();
    const unitFilterId = useId();
    const categoryFilterId = useId();
    const timingFilterId = useId();
    const referenceErrorId = useId();
    const canReadReference = routineCapabilities?.canReadReference === true;
    const canReadSummaryForScope = scope === "all"
        ? routineCapabilities?.canReadAllSummary === true
        : routineCapabilities?.canReadSummary === true;
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
    const reconcilePage = useCallback(
        (response: PaginatedRoutineTaskWorkItemsResponse, responseKey: string): void => {
            if (responseKey !== key) {
                return;
            }

            const maxPage = Math.max(1, response.pagination.pages);
            if (page > maxPage) {
                setPage(maxPage);
            }
        },
        [key, page],
    );
    const { data, error, isLoading, mutate } = useSWR<PaginatedRoutineTaskWorkItemsResponse, Error>(
        key,
        fetchRoutine,
        {
            keepPreviousData: true,
            onSuccess: reconcilePage,
        },
    );
    const {
        data: reference,
        error: referenceError,
        isLoading: referenceLoading,
        mutate: mutateReference,
    } = useSWR<RoutineReferenceData, Error>(
        canReadReference ? API_ROUTES.routines.reference : null,
        fetchRoutine,
    );
    const filterUnits = uniqueRoutineUnits(reference?.units ?? []);
    const canUpdateTasks = routineCapabilities?.canUpdateTasks === true;

    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-brand-strong">ติดตามรายการตามกำหนด</h2>
                <p className="max-w-prose text-sm leading-6 text-content-secondary">ค้นหารายการ ตรวจสถานะ และปรับเฉพาะรอบที่ต้องการได้จากหน้านี้</p>
            </div>
            {canReadSummaryForScope ? <RoutineKpiGrid summary={summary} isLoading={summaryLoading && !summary} /> : null}
            {canReadSummaryForScope && summaryError ? (
                <p className="text-sm text-status-danger-foreground" role="alert">
                    โหลดสรุปรายการไม่สำเร็จ: {summaryError.message}
                </p>
            ) : null}
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
                canReadImportMetadata={canReadImportMetadata}
                routineCapabilities={routineCapabilities}
                focusTaskId={taskId}
                focusOccurrenceId={occurrenceId}
                onRetry={() => void mutate()}
                onPageChange={setPage}
                onEditTask={() => undefined}
                renderEditAction={canUpdateTasks ? (task) => (
                    <RoutineOperationalEditCapabilitySession
                        key={task.id}
                        taskId={task.id}
                        currentEmployeeId={currentEmployeeId}
                        mutate={mutate}
                        mutateReference={mutateReference}
                        onTaskSaved={onTaskSaved}
                        reference={reference}
                        referenceError={referenceError}
                        referenceLoading={referenceLoading}
                        routineCapabilities={routineCapabilities}
                    />
                ) : undefined}
                mutate={mutate}
                employees={reference?.employees ?? []}
            />
        </div>
    );
}

function RoutineOperationalEditCapabilitySession({
    taskId,
    currentEmployeeId,
    mutate,
    mutateReference,
    onTaskSaved,
    reference,
    referenceError,
    referenceLoading,
    routineCapabilities,
}: {
    taskId: number;
    currentEmployeeId?: number;
    mutate: KeyedMutator<PaginatedRoutineTaskWorkItemsResponse>;
    mutateReference: KeyedMutator<RoutineReferenceData>;
    onTaskSaved: () => void;
    reference: RoutineReferenceData | undefined;
    referenceError: Error | undefined;
    referenceLoading: boolean;
    routineCapabilities?: RoutinePresentationCapabilities;
}) {
    const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
    const {
        data: editingTaskData,
        error: editingTaskError,
        isLoading: editingTaskLoading,
        mutate: mutateEditingTask,
    } = useSWR<RoutineTaskByIdResponse, Error>(
        editingTaskId !== null
            ? API_ROUTES.routines.taskById(editingTaskId)
            : null,
        fetchRoutine,
    );
    const editingTask = editingTaskData?.task.id === editingTaskId
        ? editingTaskData.task
        : null;

    return (
        <>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingTaskId(taskId)}>
                <Edit3 aria-hidden="true" />
                แก้ไข Routine
            </Button>
            <RoutineTaskDialog
                open={editingTaskId !== null}
                intent="edit"
                allowBroadAssignment={routineCapabilities?.canUpdateAllTasks === true}
                currentEmployeeId={currentEmployeeId}
                canSubmit={editingTaskId !== null && (editingTask === null || editingTask.canEdit === true)}
                canChangeStatus={editingTask?.canDelete === true}
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
        </>
    );
}

function RoutineTaskSettings({
    routineCapabilities,
    currentEmployeeId,
    onTaskSaved,
}: {
    routineCapabilities?: RoutinePresentationCapabilities;
    currentEmployeeId?: number;
    onTaskSaved: () => void;
}) {
    const canReadReference = routineCapabilities?.canReadReference === true;
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
    } = useSWR<RoutineReferenceData, Error>(
        canReadReference ? API_ROUTES.routines.reference : null,
        fetchRoutine,
    );
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
    const canCreateTasks = routineCapabilities?.canCreateTasks === true;
    const canCreateTasksForOthers = routineCapabilities?.canCreateTasksForOthers === true;
    const canUpdateTasks = routineCapabilities?.canUpdateTasks === true;
    const canUpdateAllTasks = routineCapabilities?.canUpdateAllTasks === true;
    const canDeleteTasks = routineCapabilities?.canDeleteTasks === true;

    async function updateTaskActive(task: RoutineTask): Promise<void> {
        if (!canUpdateTasks || task.canDelete !== true) return;
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
        if (!canDeleteTasks || task.canDelete !== true) return;
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
                <h2 className="text-xl font-semibold tracking-tight text-brand-strong">จัดการแม่แบบงาน Routine</h2>
                <p className="max-w-prose text-sm leading-6 text-content-secondary">สร้างและจัดการแม่แบบงานตามขอบเขตสิทธิ์และความสัมพันธ์ของแต่ละรายการ</p>
            </div>
            <RoutineTaskList
                data={tasks}
                error={tasksError}
                canReadImportMetadata={routineCapabilities?.canManageImports === true}
                routineCapabilities={routineCapabilities}
                isLoading={tasksLoading}
                onRetry={() => void mutateTasks()}
                onCreate={() => undefined}
                onEdit={() => undefined}
                createAction={canCreateTasks ? (
                    <RoutineTaskCreateCapabilitySession
                        allowBroadAssignment={canCreateTasksForOthers}
                        currentEmployeeId={currentEmployeeId}
                        reference={reference}
                        referenceError={referenceError}
                        referenceLoading={referenceLoading}
                        mutateReference={mutateReference}
                        mutateTasks={mutateTasks}
                        onTaskSaved={onTaskSaved}
                    />
                ) : null}
                renderEditAction={canUpdateTasks ? (task) => (
                    <RoutineTaskEditCapabilitySession
                        key={task.id}
                        task={task}
                        allowBroadAssignment={canUpdateAllTasks}
                        currentEmployeeId={currentEmployeeId}
                        reference={reference}
                        referenceError={referenceError}
                        referenceLoading={referenceLoading}
                        mutateReference={mutateReference}
                        mutateTasks={mutateTasks}
                        onTaskSaved={onTaskSaved}
                    />
                ) : undefined}
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
        </div>
    );
}

function RoutineTaskCreateCapabilitySession({
    allowBroadAssignment,
    currentEmployeeId,
    reference,
    referenceError,
    referenceLoading,
    mutateReference,
    mutateTasks,
    onTaskSaved,
}: {
    allowBroadAssignment: boolean;
    currentEmployeeId?: number;
    reference: RoutineReferenceData | undefined;
    referenceError: Error | undefined;
    referenceLoading: boolean;
    mutateReference: KeyedMutator<RoutineReferenceData>;
    mutateTasks: KeyedMutator<PaginatedTasksResponse>;
    onTaskSaved: () => void;
}): ReactNode {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <Button type="button" size="sm" className="xl:justify-self-end" onClick={() => setIsOpen(true)}>
                <Plus aria-hidden="true" />
                สร้างแม่แบบงาน
            </Button>
            <RoutineTaskDialog
                open={isOpen}
                intent="create"
                allowBroadAssignment={allowBroadAssignment}
                currentEmployeeId={currentEmployeeId}
                canSubmit
                canChangeStatus
                reference={reference}
                task={null}
                error={referenceError}
                isLoading={referenceLoading || !reference}
                onRetry={() => void mutateReference()}
                onClose={() => setIsOpen(false)}
                onSaved={() => {
                    setIsOpen(false);
                    void mutateTasks();
                    onTaskSaved();
                }}
            />
        </>
    );
}

function RoutineTaskEditCapabilitySession({
    task,
    allowBroadAssignment,
    currentEmployeeId,
    reference,
    referenceError,
    referenceLoading,
    mutateReference,
    mutateTasks,
    onTaskSaved,
}: {
    task: RoutineTask;
    allowBroadAssignment: boolean;
    currentEmployeeId?: number;
    reference: RoutineReferenceData | undefined;
    referenceError: Error | undefined;
    referenceLoading: boolean;
    mutateReference: KeyedMutator<RoutineReferenceData>;
    mutateTasks: KeyedMutator<PaginatedTasksResponse>;
    onTaskSaved: () => void;
}): ReactNode {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(true)}
            >
                <Edit3 aria-hidden="true" />
                แก้ไข
            </Button>
            <RoutineTaskDialog
                open={isOpen}
                intent="edit"
                allowBroadAssignment={allowBroadAssignment}
                currentEmployeeId={currentEmployeeId}
                canSubmit
                canChangeStatus={task.canDelete === true}
                reference={reference}
                task={task}
                error={referenceError}
                isLoading={referenceLoading || !reference}
                onRetry={() => void mutateReference()}
                onClose={() => setIsOpen(false)}
                onSaved={() => {
                    setIsOpen(false);
                    void mutateTasks();
                    onTaskSaved();
                }}
            />
        </>
    );
}

function routineTabLifetimeKey(
    routineCapabilities: RoutinePresentationCapabilities | undefined,
): string {
    return [
        routineCapabilities?.canReadTasks === true ? "mine" : null,
        routineCapabilities?.canReadTasks === true
            && routineCapabilities.canReadAllTasks === true
            ? "all"
            : null,
        routineCapabilities?.canCreateTasks === true
            || routineCapabilities?.canUpdateTasks === true
            || routineCapabilities?.canDeleteTasks === true
            ? "manage"
            : null,
        routineCapabilities?.canManageImports === true ? "import" : null,
    ].filter((tab): tab is string => tab !== null).join("|") || "none";
}

export function RoutineSection() {
    return <RoutineSectionCapabilitySurface />;
}

function RoutineSectionCapabilitySurface() {
    const { user } = useDashboardDataContext();
    const routineCapabilities = user?.routineCapabilities;
    const canReadTasks = routineCapabilities?.canReadTasks === true;
    const canReadAllTasks = routineCapabilities?.canReadAllTasks === true;
    const canExportTasks = routineCapabilities?.canExportTasks === true;
    const canReadSummary = routineCapabilities?.canReadSummary === true;
    const canManageImports = routineCapabilities?.canManageImports === true;
    const canManageTasks = routineCapabilities?.canCreateTasks === true
        || routineCapabilities?.canUpdateTasks === true
        || routineCapabilities?.canDeleteTasks === true;
    const searchParams = useSearchParams();
    const taskIdValue = Number(searchParams.get("taskId"));
    const taskId = Number.isInteger(taskIdValue) && taskIdValue > 0
        ? taskIdValue
        : null;
    const occurrenceIdValue = Number(searchParams.get("occurrenceId"));
    const occurrenceId = Number.isInteger(occurrenceIdValue) && occurrenceIdValue > 0
        ? occurrenceIdValue
        : null;
    const visibleRoutineTabs = useMemo<ReadonlySet<string>>(
        () => new Set(
            [
                ...(canReadTasks ? ["mine"] : []),
                ...(canReadTasks && canReadAllTasks ? ["all"] : []),
                ...(canManageTasks ? ["manage"] : []),
                ...(canManageImports ? ["import"] : []),
            ],
        ),
        [canManageImports, canManageTasks, canReadAllTasks, canReadTasks],
    );
    const firstVisibleTab = ["mine", "all", "manage", "import"].find((tab) => visibleRoutineTabs.has(tab)) ?? "mine";
    const visibleTabKey = routineTabLifetimeKey(routineCapabilities);
    const [tabState, setTabState] = useState({
        activeTab: firstVisibleTab,
        visibleTabKey,
    });
    if (tabState.visibleTabKey !== visibleTabKey) {
        setTabState({
            activeTab: visibleRoutineTabs.has(tabState.activeTab)
                ? tabState.activeTab
                : firstVisibleTab,
            visibleTabKey,
        });
    }
    const activeTab = tabState.activeTab;
    const safeTab = visibleRoutineTabs.has(activeTab) ? activeTab : firstVisibleTab;
    const summaryScope = safeTab === "all" ? "all" : "mine";
    const summaryKey = `${API_ROUTES.routines.summary}?scope=${summaryScope}`;
    const canReadSummaryForScope = summaryScope === "all"
        ? routineCapabilities?.canReadAllSummary === true
        : canReadSummary;
    const {
        data: summaryData,
        error: summaryError,
        isLoading: summaryLoading,
        mutate: mutateSummary,
    } = useSWR<RoutineSummaryResponse, Error>(
        canReadTasks && canReadSummaryForScope ? summaryKey : null,
        fetchRoutine,
        {
            keepPreviousData: true,
        },
    );

    useEffect(() => {
        if (
            canReadTasks
            && canReadAllTasks
            && (taskId !== null || occurrenceId !== null)
        ) {
            setTabState((currentState) => ({ ...currentState, activeTab: "all" }));
        }
    }, [canReadAllTasks, canReadTasks, occurrenceId, taskId]);

    useEffect(() => {
        const requestedTab = searchParams.get("routineTab");
        if (requestedTab !== null && visibleRoutineTabs.has(requestedTab)) {
            setTabState((currentState) => ({ ...currentState, activeTab: requestedTab }));
        }
    }, [searchParams, visibleRoutineTabs]);

    if (visibleRoutineTabs.size === 0) {
        return null;
    }

    function handleTabChange(value: string): void {
        if (visibleRoutineTabs.has(value)) {
            setTabState((currentState) => ({ ...currentState, activeTab: value }));
        }
    }

    const tabs: SectionTabItem[] = [
        {
            value: "mine",
            label: "รายการของฉัน",
            group: "work",
            groupLabel: "รายการงาน",
            visible: visibleRoutineTabs.has("mine"),
            content: <RoutineOccurrencePanel scope="mine" canReadImportMetadata={canManageImports} currentEmployeeId={user?.employeeId} routineCapabilities={routineCapabilities} taskId={taskId} occurrenceId={occurrenceId} onTaskSaved={() => void mutateSummary()} summary={summaryScope === "mine" ? summaryData?.summary : undefined} summaryError={summaryScope === "mine" ? summaryError : undefined} summaryLoading={summaryScope === "mine" ? summaryLoading : false} />,
        },
        {
            value: "all",
            label: "รายการทั้งหมด",
            group: "work",
            visible: visibleRoutineTabs.has("all"),
            content: <RoutineOccurrencePanel scope="all" canReadImportMetadata={canManageImports} currentEmployeeId={user?.employeeId} routineCapabilities={routineCapabilities} taskId={taskId} occurrenceId={occurrenceId} onTaskSaved={() => void mutateSummary()} summary={summaryScope === "all" ? summaryData?.summary : undefined} summaryError={summaryScope === "all" ? summaryError : undefined} summaryLoading={summaryScope === "all" ? summaryLoading : false} />,
        },
        {
            value: "manage",
            label: "จัดการงาน",
            group: "manage",
            groupLabel: "จัดการ",
            visible: visibleRoutineTabs.has("manage"),
            content: <RoutineTaskSettings currentEmployeeId={user?.employeeId} routineCapabilities={routineCapabilities} onTaskSaved={() => void mutateSummary()} />,
        },
        {
            value: "import",
            label: "นำเข้าจาก Excel",
            group: "tools",
            groupLabel: "เครื่องมือ",
            visible: visibleRoutineTabs.has("import"),
            content: <RoutineImportPanel />,
        },
    ];

    return (
        <SectionShell className="routine-section border-brand-border/70 bg-surface lg:rounded-2xl">
            <SectionHeader
                title="NHF Routine"
                subtitle="รวมรายการ Routine ตามกำหนดเวลา ผู้รับผิดชอบ และการแจ้งเตือนที่เกี่ยวข้อง"
                extra={canExportTasks ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="border-brand-border text-brand-strong hover:bg-brand-surface-strong hover:text-brand-strong"
                        onClick={() => triggerDownload(`${API_ROUTES.routines.export}?format=xlsx`)}
                        aria-label="ส่งออก Excel รายการทั้งหมด"
                        title="ส่งออกรายการทั้งหมด"
                    >
                        <Download aria-hidden="true" />
                        ส่งออก Excel
                        <span className="text-xs font-normal text-content-muted">รายการทั้งหมด</span>
                    </Button>
                ) : null}
            />
            <SectionTabs
                value={safeTab}
                onValueChange={handleTabChange}
                tabs={tabs}
                activeColor="var(--module-routine-tab)"
                ariaLabel="แท็บ NHF Routine"
            />
        </SectionShell>
    );
}
