"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, ListTodo, Settings2, Users } from "lucide-react";
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
import type {
    PaginatedOccurrencesResponse,
    PaginatedTasksResponse,
    RoutineReferenceData,
    RoutineStatus,
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
    const [status, setStatus] = useState<RoutineStatus | "">("");
    const [page, setPage] = useState(1);
    const scope = isAdmin ? "all" : "mine";
    const key = useMemo(() => {
        const params = new URLSearchParams({
            scope,
            page: String(page),
            limit: "12",
        });
        if (occurrenceId !== null) params.set("occurrenceId", String(occurrenceId));
        if (search.trim()) params.set("search", search.trim());
        if (status) params.set("status", status);
        return `${API_ROUTES.routines.occurrences}?${params.toString()}`;
    }, [occurrenceId, page, scope, search, status]);
    const { data, error, isLoading, mutate } = useSWR<PaginatedOccurrencesResponse, Error>(key, fetchRoutine);
    const { data: reference } = useSWR<RoutineReferenceData, Error>(
        isAdmin ? API_ROUTES.routines.reference : null,
        fetchRoutine,
    );

    useEffect(() => {
        setPage(1);
    }, [search, status, isAdmin, occurrenceId]);

    return (
        <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4 md:grid-cols-[1fr_220px_auto] md:items-end">
                <label className="grid gap-1 text-sm font-medium text-content-body">ค้นหางาน
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่องาน หน่วยงาน หรือหมวดหมู่" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body">สถานะ
                    <select className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as RoutineStatus | "")}>
                        <option value="">ทุกสถานะ</option>
                        <option value="TODO">รอดำเนินการ</option>
                        <option value="IN_PROGRESS">กำลังดำเนินการ</option>
                        <option value="COMPLETED">เสร็จแล้ว</option>
                        <option value="SKIPPED">ข้ามงาน</option>
                        <option value="CANCELLED">ยกเลิก</option>
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
    const { data: reference, error: referenceError, isLoading: referenceLoading } = useSWR<RoutineReferenceData, Error>(API_ROUTES.routines.reference, fetchRoutine);
    const { data: tasks, error: tasksError, isLoading: tasksLoading, mutate: mutateTasks } = useSWR<PaginatedTasksResponse, Error>(
        `${API_ROUTES.routines.tasks}?activeOnly=0&page=${taskPage}&limit=20`,
        fetchRoutine,
    );

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

    const tabs: SectionTabItem[] = [
        {
            value: "mine",
            label: "งานของฉัน",
            icon: ListTodo,
            content: <RoutineOccurrencePanel isAdmin={false} occurrenceId={occurrenceId} />,
        },
        {
            value: "all",
            label: "งานทั้งหมด (Admin)",
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
    ];

    return (
        <SectionShell gradientFrom="transparent" gradientTo="transparent" className="border-border-subtle/70 bg-surface shadow-sm">
            <SectionHeader
                icon={ClipboardCheck}
                title="NHF Routine"
                subtitle="บันทึกและติดตามงานประจำขององค์กรให้เห็นงานถัดไปและประวัติการดำเนินงานในที่เดียว"
                tone="brand"
            />
            <RoutineKpiGrid summary={summaryData?.summary} isLoading={summaryLoading} />
            {summaryError ? <p className="text-sm text-status-danger-foreground" role="alert">โหลดสรุปงานไม่สำเร็จ: {summaryError.message}</p> : null}
            <SectionTabs value={safeTab} onValueChange={setActiveTab} tabs={tabs} activeColor="var(--primary)" ariaLabel="แท็บ NHF Routine" />
        </SectionShell>
    );
}
