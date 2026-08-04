"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, FileSpreadsheet, List, Settings2, Users } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";

import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionShell } from "@/components/ui/section-shell";
import { SectionTabs, type SectionTabItem } from "@/components/ui/section-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/state";
import { API_ROUTES } from "@/lib/ssot/routes";
import { isAdminRole } from "@/lib/ssot/permissions";

import { RoutineKpiGrid } from "../routine/RoutineKpiGrid";
import { RoutineOccurrenceList } from "../routine/RoutineOccurrenceList";
import { RoutineTaskForm } from "../routine/RoutineTaskForm";
import { RoutineTaskList } from "../routine/RoutineTaskList";
import { RoutineImportPanel } from "../routine/RoutineImportPanel";
import type {
    PaginatedOccurrencesResponse,
    PaginatedTasksResponse,
    RoutineReferenceData,
    RoutineTimingStatus,
    RoutineSummaryResponse,
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
    occurrenceId,
}: {
    isAdmin: boolean;
    occurrenceId: number | null;
}) {
    const [search, setSearch] = useState("");
    const [timingStatus, setTimingStatus] = useState<RoutineTimingStatus | "">("");
    const [page, setPage] = useState(1);
    const scope = isAdmin ? "all" : "mine";
    const key = useMemo(() => {
        const params = new URLSearchParams({
            scope,
            page: String(page),
            limit: "12",
            view: "tasks",
        });
        if (occurrenceId !== null) params.set("occurrenceId", String(occurrenceId));
        if (search.trim()) params.set("search", search.trim());
        if (timingStatus) params.set("timingStatus", timingStatus);
        return `${API_ROUTES.routines.occurrences}?${params.toString()}`;
    }, [occurrenceId, page, scope, search, timingStatus]);
    const { data, error, isLoading, mutate } = useSWR<PaginatedOccurrencesResponse, Error>(key, fetchRoutine);
    const { data: reference } = useSWR<RoutineReferenceData, Error>(
        isAdmin ? API_ROUTES.routines.reference : null,
        fetchRoutine,
    );

    useEffect(() => {
        setPage(1);
    }, [search, timingStatus, isAdmin, occurrenceId]);

    return (
        <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4 md:grid-cols-[1fr_220px_auto] md:items-end">
                <label className="grid gap-1 text-sm font-medium text-content-body">ค้นหารายการ
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อรายการ หน่วยงาน หรือหมวดหมู่" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body">ช่วงเวลา
                    <select className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={timingStatus} onChange={(event) => setTimingStatus(event.target.value as RoutineTimingStatus | "")}>
                        <option value="">ทุกช่วงเวลา</option>
                        <option value="OVERDUE">เกินกำหนด</option>
                        <option value="DUE_TODAY">ถึงกำหนดวันนี้</option>
                        <option value="DUE_SOON">ใกล้ถึงกำหนด</option>
                        <option value="UPCOMING">ยังไม่ถึงกำหนด</option>
                    </select>
                </label>
                <Button type="button" variant="outline" onClick={() => void mutate()}>รีเฟรช</Button>
            </div>
            <RoutineOccurrenceList
                data={data}
                error={error}
                isLoading={isLoading}
                isAdmin={isAdmin}
                onRetry={() => void mutate()}
                onPageChange={setPage}
                mutate={mutate}
                employees={reference?.employees ?? []}
            />
        </div>
    );
}

function RoutineTaskSettings() {
    const [isCreating, setIsCreating] = useState(false);
    const [editingTask, setEditingTask] = useState<RoutineTask | null>(null);
    const [taskPage, setTaskPage] = useState(1);
    const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);
    const activeMutationLockRef = useRef<Set<number>>(new Set());
    const { data: reference, error: referenceError, isLoading: referenceLoading } = useSWR<RoutineReferenceData, Error>(API_ROUTES.routines.reference, fetchRoutine);
    const { data: tasks, error: tasksError, isLoading: tasksLoading, mutate: mutateTasks } = useSWR<PaginatedTasksResponse, Error>(
        `${API_ROUTES.routines.tasks}?activeOnly=0&page=${taskPage}&limit=20`,
        fetchRoutine,
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

    if (isCreating || editingTask) {
        if (referenceError) return <p className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-foreground" role="alert">{referenceError.message}</p>;
        if (referenceLoading || !reference) return <LoadingState label="กำลังโหลดข้อมูลสำหรับสร้างแม่แบบงาน..." compact />;
        return (
            <RoutineTaskForm
                reference={reference}
                initialTask={editingTask}
                onSaved={() => { setIsCreating(false); setEditingTask(null); void mutateTasks(); }}
                onCancel={() => { setIsCreating(false); setEditingTask(null); }}
            />
        );
    }

    return (
        <RoutineTaskList
            data={tasks}
            error={tasksError}
            isLoading={tasksLoading}
            onRetry={() => void mutateTasks()}
            onCreate={() => setIsCreating(true)}
            onEdit={(task) => setEditingTask(task)}
            onToggleActive={updateTaskActive}
            onDelete={deleteTask}
            pendingTaskId={pendingTaskId}
            onPageChange={setTaskPage}
        />
    );
}

export function RoutineSection() {
    const { user } = useDashboardDataContext();
    const isAdmin = isAdminRole(user?.role);
    const searchParams = useSearchParams();
    const occurrenceIdValue = Number(searchParams.get("occurrenceId"));
    const occurrenceId = Number.isInteger(occurrenceIdValue) && occurrenceIdValue > 0
        ? occurrenceIdValue
        : null;
    const [activeTab, setActiveTab] = useState("mine");
    const { data: summaryData, error: summaryError, isLoading: summaryLoading } = useSWR<RoutineSummaryResponse, Error>(API_ROUTES.routines.summary, fetchRoutine);
    const safeTab = isAdmin ? activeTab : "mine";

    useEffect(() => {
        if (isAdmin && occurrenceId !== null) setActiveTab("all");
    }, [isAdmin, occurrenceId]);

    useEffect(() => {
        const requestedTab = searchParams.get("routineTab");
        if (isAdmin && (requestedTab === "mine" || requestedTab === "all" || requestedTab === "settings" || requestedTab === "import")) {
            setActiveTab(requestedTab);
        }
    }, [isAdmin, searchParams]);

    const tabs: SectionTabItem[] = [
        {
            value: "mine",
            label: "รายการของฉัน",
            icon: List,
            content: <RoutineOccurrencePanel isAdmin={false} occurrenceId={occurrenceId} />,
        },
        {
            value: "all",
            label: "รายการทั้งหมด (Admin)",
            icon: Users,
            visible: isAdmin,
            content: <RoutineOccurrencePanel isAdmin occurrenceId={occurrenceId} />,
        },
        {
            value: "settings",
            label: "ตั้งค่างานประจำ",
            icon: Settings2,
            visible: isAdmin,
            content: <RoutineTaskSettings />,
        },
        {
            value: "import",
            label: "นำเข้าจาก Excel",
            icon: FileSpreadsheet,
            visible: isAdmin,
            content: <RoutineImportPanel />,
        },
    ];

    return (
        <SectionShell gradientFrom="transparent" gradientTo="transparent" className="border-border-subtle/70 bg-surface shadow-sm">
            <SectionHeader
                icon={CalendarClock}
                title="NHF Routine"
                subtitle="รวมรายการ Routine ตามกำหนดเวลา ผู้รับผิดชอบ และการแจ้งเตือนที่เกี่ยวข้อง"
                tone="brand"
            />
            <RoutineKpiGrid summary={summaryData?.summary} isLoading={summaryLoading} />
            {summaryError ? <p className="text-sm text-status-danger-foreground" role="alert">โหลดสรุปรายการไม่สำเร็จ: {summaryError.message}</p> : null}
            <SectionTabs value={safeTab} onValueChange={setActiveTab} tabs={tabs} activeColor="var(--primary)" ariaLabel="แท็บ NHF Routine" />
        </SectionShell>
    );
}
