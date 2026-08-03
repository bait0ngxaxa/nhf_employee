import { useState } from "react";
import {
    CalendarDays,
    Check,
    Play,
    RotateCcw,
    SkipForward,
    X,
} from "lucide-react";
import type { KeyedMutator } from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/ui/state";
import { API_ROUTES } from "@/lib/ssot/routes";

import {
    formatRoutineDueLabel,
    getRoutineStatusClass,
    ROUTINE_STATUS_LABELS,
} from "./labels";
import type {
    PaginatedOccurrencesResponse,
    RoutineAssigneeRole,
    RoutineEmployee,
    RoutineOccurrence,
} from "./types";

interface RoutineOccurrenceListProps {
    data: PaginatedOccurrencesResponse | undefined;
    error: Error | undefined;
    isLoading: boolean;
    isAdmin: boolean;
    onRetry: () => void;
    onPageChange: (page: number) => void;
    mutate: KeyedMutator<PaginatedOccurrencesResponse>;
    employees: RoutineEmployee[];
}

type AdminAction = "SKIPPED" | "CANCELLED" | "REOPEN" | "DUE_DATE" | "REASSIGN";

function employeeNames(occurrence: RoutineOccurrence): string {
    return occurrence.assignees
        .map((assignee) => assignee.employee.displayName
            ?? `${assignee.employee.firstName} ${assignee.employee.lastName}`)
        .join(", ");
}

function errorMessage(body: unknown): string {
    if (typeof body === "object" && body !== null && "error" in body) {
        const value = body.error;
        return typeof value === "string" ? value : "ดำเนินการไม่สำเร็จ";
    }
    return "ดำเนินการไม่สำเร็จ";
}

function displayEmployeeName(employee: RoutineEmployee): string {
    const name = `${employee.firstName} ${employee.lastName}`.trim();
    return employee.nickname ? `${name} (${employee.nickname})` : name;
}

async function sendRoutineMutation(
    url: string,
    method: "PATCH" | "POST",
    payload: unknown,
): Promise<void> {
    const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(body));
}

function formatDate(date: string): string {
    return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(`${date}T00:00:00+07:00`));
}

export function RoutineOccurrenceList({
    data,
    error,
    isLoading,
    isAdmin,
    onRetry,
    onPageChange,
    mutate,
    employees,
}: RoutineOccurrenceListProps) {
    const [busyId, setBusyId] = useState<number | null>(null);
    const [completionId, setCompletionId] = useState<number | null>(null);
    const [completionNote, setCompletionNote] = useState("");
    const [referenceNo, setReferenceNo] = useState("");
    const [adminAction, setAdminAction] = useState<{
        id: number;
        action: AdminAction;
    } | null>(null);
    const [reason, setReason] = useState("");
    const [newDueDate, setNewDueDate] = useState("");
    const [reassignment, setReassignment] = useState<Record<number, RoutineAssigneeRole>>({});
    const [actionError, setActionError] = useState<string | null>(null);

    async function runAction(
        occurrence: RoutineOccurrence,
        action: () => Promise<void>,
    ): Promise<void> {
        setBusyId(occurrence.id);
        setActionError(null);
        try {
            await action();
            await mutate();
            setCompletionId(null);
            setAdminAction(null);
            setReason("");
            setNewDueDate("");
            setReassignment({});
        } catch (actionFailure) {
            setActionError(
                actionFailure instanceof Error
                    ? actionFailure.message
                    : "ดำเนินการไม่สำเร็จ",
            );
        } finally {
            setBusyId(null);
        }
    }

    function beginReassignment(occurrence: RoutineOccurrence): void {
        const selected: Record<number, RoutineAssigneeRole> = {};
        occurrence.assignees.forEach((assignee) => {
            selected[assignee.employeeId] = assignee.role;
        });
        setAdminAction({ id: occurrence.id, action: "REASSIGN" });
        setReassignment(selected);
        setReason("");
    }

    function toggleReassignmentEmployee(employeeId: number): void {
        setReassignment((current) => {
            const next = { ...current };
            if (next[employeeId]) {
                delete next[employeeId];
            } else {
                next[employeeId] = Object.keys(next).length === 0
                    ? "OWNER"
                    : "CO_OWNER";
            }
            return next;
        });
    }

    if (isLoading) return <LoadingState label="กำลังโหลดรายการงานประจำ..." compact />;
    if (error) {
        return (
            <ErrorState
                compact
                action={{ label: "ลองใหม่", onClick: onRetry }}
                description={error.message}
            />
        );
    }
    if (!data || data.occurrences.length === 0) {
        return (
            <EmptyState
                compact
                title="ยังไม่มีงานในรายการ"
                description="เมื่อมีงานตามช่วงเวลาที่เลือก งานจะแสดงที่นี่"
            />
        );
    }

    return (
        <div className="space-y-3" aria-label="รายการงานประจำ">
            {actionError ? (
                <p className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-foreground" role="alert">
                    {actionError}
                </p>
            ) : null}
            {data.occurrences.map((occurrence) => {
                const isBusy = busyId === occurrence.id;
                const showCompletion = completionId === occurrence.id;
                const showAdminAction = adminAction?.id === occurrence.id;
                return (
                    <article
                        key={occurrence.id}
                        className="rounded-xl border border-border-subtle bg-surface-raised p-4 shadow-sm sm:p-5"
                    >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
                                    <span>{occurrence.task.unit.name}</span>
                                    <span aria-hidden="true">•</span>
                                    <span>{occurrence.task.category.name}</span>
                                </div>
                                <h3 className="text-base font-semibold text-content-heading">
                                    {occurrence.task.title}
                                </h3>
                                <div className="grid gap-2 text-sm text-content-secondary sm:grid-cols-2">
                                    <p>ผู้รับผิดชอบ: <span className="text-content-body">{employeeNames(occurrence)}</span></p>
                                    <p>กำหนด: <span className={occurrence.isOverdue ? "font-semibold text-status-danger-foreground" : "text-content-body"}>{formatDate(occurrence.dueDate)} ({formatRoutineDueLabel(occurrence)})</span></p>
                                </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRoutineStatusClass(occurrence.status)}`}>
                                    {ROUTINE_STATUS_LABELS[occurrence.status]}
                                </span>
                                <div className="flex flex-wrap gap-2 lg:justify-end">
                                    {occurrence.status === "TODO" ? (
                                        <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => void runAction(occurrence, () => sendRoutineMutation(API_ROUTES.routines.occurrenceStatusById(occurrence.id), "PATCH", { status: "IN_PROGRESS" }))}>
                                            <Play aria-hidden="true" /> เริ่มงาน
                                        </Button>
                                    ) : null}
                                    {occurrence.status === "TODO" || occurrence.status === "IN_PROGRESS" ? (
                                        <Button type="button" size="sm" disabled={isBusy} onClick={() => { setCompletionId(occurrence.id); setCompletionNote(occurrence.completionNote ?? ""); setReferenceNo(occurrence.referenceNo ?? ""); }}>
                                            <Check aria-hidden="true" /> ปิดงาน
                                        </Button>
                                    ) : null}
                                    {isAdmin && occurrence.status !== "COMPLETED" && occurrence.status !== "SKIPPED" && occurrence.status !== "CANCELLED" ? (
                                        <>
                                            <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => { setAdminAction({ id: occurrence.id, action: "SKIPPED" }); setReason(""); }}>
                                                <SkipForward aria-hidden="true" /> ข้ามงาน
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => { setAdminAction({ id: occurrence.id, action: "CANCELLED" }); setReason(""); }}>
                                                <X aria-hidden="true" /> ยกเลิก
                                            </Button>
                                        </>
                                    ) : null}
                                    {isAdmin ? (
                                        <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => { setAdminAction({ id: occurrence.id, action: "DUE_DATE" }); setNewDueDate(occurrence.dueDate); setReason(""); }}>
                                            <CalendarDays aria-hidden="true" /> เปลี่ยนวันกำหนด
                                        </Button>
                                    ) : null}
                                    {isAdmin ? (
                                        <Button type="button" size="sm" variant="outline" disabled={isBusy || employees.length === 0} onClick={() => beginReassignment(occurrence)}>
                                            เปลี่ยนผู้รับผิดชอบ
                                        </Button>
                                    ) : null}
                                    {isAdmin && (occurrence.status === "COMPLETED" || occurrence.status === "SKIPPED" || occurrence.status === "CANCELLED") ? (
                                        <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => { setAdminAction({ id: occurrence.id, action: "REOPEN" }); setReason(""); }}>
                                            <RotateCcw aria-hidden="true" /> เปิดงานอีกครั้ง
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {showCompletion ? (
                            <div className="mt-4 grid gap-3 rounded-lg border border-border-subtle bg-surface-subtle p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                                <label className="grid gap-1 text-sm font-medium text-content-body">
                                    โน้ตปิดงาน
                                    <Textarea value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} placeholder="สรุปผลการดำเนินงาน (ถ้ามี)" />
                                </label>
                                <label className="grid gap-1 text-sm font-medium text-content-body">
                                    เลขเอกสารอ้างอิง
                                    <Input value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} placeholder="เช่น NHF-2026-001" />
                                </label>
                                <Button type="button" disabled={isBusy} onClick={() => void runAction(occurrence, () => sendRoutineMutation(API_ROUTES.routines.occurrenceStatusById(occurrence.id), "PATCH", { status: "COMPLETED", completionNote, referenceNo }))}>
                                    ยืนยันปิดงาน
                                </Button>
                            </div>
                        ) : null}

                        {showAdminAction ? (
                            <div className="mt-4 grid gap-3 rounded-lg border border-border-subtle bg-surface-subtle p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                                {adminAction.action === "REASSIGN" ? (
                                    <fieldset className="grid gap-2 md:col-span-3">
                                        <legend className="text-sm font-medium text-content-body">ผู้รับผิดชอบใหม่</legend>
                                        {employees.length === 0 ? (
                                            <p className="text-sm text-content-secondary">ไม่พบพนักงานที่พร้อมรับผิดชอบ</p>
                                        ) : (
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {employees.map((employee) => {
                                                    const selectedRole = reassignment[employee.id];
                                                    return (
                                                        <div key={employee.id} className="flex items-center gap-3 rounded-lg border border-border-subtle bg-background px-3 py-2">
                                                            <input type="checkbox" checked={selectedRole !== undefined} onChange={() => toggleReassignmentEmployee(employee.id)} aria-label={`เลือก ${displayEmployeeName(employee)}`} />
                                                            <span className="min-w-0 flex-1 text-sm text-content-body">{displayEmployeeName(employee)}</span>
                                                            {selectedRole ? (
                                                                <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={selectedRole} onChange={(event) => setReassignment((current) => ({ ...current, [employee.id]: event.target.value as RoutineAssigneeRole }))} aria-label={`บทบาท ${displayEmployeeName(employee)}`}>
                                                                    <option value="OWNER">ผู้รับผิดชอบหลัก</option>
                                                                    <option value="CO_OWNER">ผู้ร่วมรับผิดชอบ</option>
                                                                </select>
                                                            ) : null}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </fieldset>
                                ) : null}
                                {adminAction.action === "DUE_DATE" ? (
                                    <label className="grid gap-1 text-sm font-medium text-content-body">
                                        วันกำหนดใหม่
                                        <Input type="date" value={newDueDate} onChange={(event) => setNewDueDate(event.target.value)} />
                                    </label>
                                ) : adminAction.action !== "REASSIGN" ? <label className="grid gap-1 text-sm font-medium text-content-body">
                                    เหตุผล
                                    <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" />
                                </label> : null}
                                {adminAction.action === "DUE_DATE" ? <label className="grid gap-1 text-sm font-medium text-content-body">
                                    เหตุผล
                                    <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" />
                                </label> : null}
                                <Button type="button" disabled={isBusy || (adminAction.action !== "REASSIGN" && reason.trim().length < 5) || (adminAction.action === "DUE_DATE" && !newDueDate) || (adminAction.action === "REASSIGN" && Object.values(reassignment).filter((role) => role === "OWNER").length !== 1)} onClick={() => void runAction(occurrence, () => {
                                    if (adminAction.action === "REASSIGN") {
                                        return sendRoutineMutation(
                                            API_ROUTES.routines.occurrenceAssigneesById(occurrence.id),
                                            "PATCH",
                                            { assignees: Object.entries(reassignment).map(([employeeId, role]) => ({ employeeId: Number(employeeId), role })) },
                                        );
                                    }
                                    if (adminAction.action === "DUE_DATE") {
                                        return sendRoutineMutation(
                                            API_ROUTES.routines.occurrenceDueDateById(occurrence.id),
                                            "PATCH",
                                            { dueDate: newDueDate, reason },
                                        );
                                    }
                                    return sendRoutineMutation(
                                        adminAction.action === "SKIPPED" ? API_ROUTES.routines.occurrenceSkipById(occurrence.id) : adminAction.action === "CANCELLED" ? API_ROUTES.routines.occurrenceCancelById(occurrence.id) : API_ROUTES.routines.occurrenceReopenById(occurrence.id),
                                        "POST",
                                        { reason },
                                    );
                                })}>
                                    ยืนยันการดำเนินการ
                                </Button>
                            </div>
                        ) : null}
                    </article>
                );
            })}
            {data.pagination.pages > 1 ? (
                <div className="flex items-center justify-between border-t border-border-subtle pt-4 text-sm text-content-secondary">
                    <span>หน้า {data.pagination.page} จาก {data.pagination.pages}</span>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={data.pagination.page <= 1} onClick={() => onPageChange(data.pagination.page - 1)}>ก่อนหน้า</Button>
                        <Button type="button" variant="outline" size="sm" disabled={data.pagination.page >= data.pagination.pages} onClick={() => onPageChange(data.pagination.page + 1)}>ถัดไป</Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
